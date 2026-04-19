const User = require('../models/User');
const {
  buildContactFields,
  generateToken,
  getContactFromIdentifier,
  getPasswordStrength,
  validatePassword,
} = require('../utils/validators');
const { shouldUseMemoryStore } = require('../config/dbMode');
const memoryStore = require('../store/memoryStore');
const otpStore = require('../store/otpStore');
const { sendVerificationCode } = require('../utils/otpDelivery');
const { serializeUser } = require('../utils/userSerializer');
const {
  DEFAULT_STARTING_TOKENS,
  INVITE_REWARD,
  addTokensToUser,
  ensureUserTokenState,
  generateReferralCode,
  normalizeReferralCode,
} = require('../utils/tokenUtils');

const SIGNUP_CODE_PURPOSE = 'signup';
const RESET_CODE_PURPOSE = 'password-reset';

const findUserRecordByReferralCode = async (referralCode) => {
  const normalizedReferralCode = normalizeReferralCode(referralCode);
  if (!normalizedReferralCode) {
    return null;
  }

  if (shouldUseMemoryStore()) {
    return memoryStore.findUserRecordByReferralCode(normalizedReferralCode);
  }

  return User.findOne({ referralCode: normalizedReferralCode });
};

const generateUniqueReferralCode = async () => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const referralCode = generateReferralCode();
    const existingUser = await findUserRecordByReferralCode(referralCode);
    if (!existingUser) {
      return referralCode;
    }
  }

  throw new Error('Could not generate a unique referral code');
};

const getContactQuery = (contact) =>
  contact.type === 'email' ? { email: contact.value } : { phone: contact.value };

const getDuplicateQuery = (username, contact) => {
  const conditions = [{ username }];

  if (contact.type === 'email') {
    conditions.push({ email: contact.value });
  } else if (contact.type === 'phone') {
    conditions.push({ phone: contact.value });
  }

  return { $or: conditions };
};

const resolveContact = (identifier) => {
  const contact = getContactFromIdentifier(identifier);

  if (!contact) {
    const error = new Error('Please enter a valid email address or mobile number.');
    error.status = 400;
    throw error;
  }

  return contact;
};

const findUserRecordByContact = async (contact) => {
  if (shouldUseMemoryStore()) {
    return memoryStore.findUserRecordByIdentifier(contact.value);
  }

  return User.findOne(getContactQuery(contact));
};

const sendCodeAndRespond = async ({ res, purpose, contact, message }) => {
  const otp = otpStore.createCode({
    purpose,
    identifier: contact.value,
    channel: contact.type,
  });

  try {
    const deliveryResult = await sendVerificationCode({
      contact,
      code: otp.code,
      purpose,
    });

    const responseMessage = deliveryResult.delivered
      ? message
      : `${contact.type === 'email' ? 'Email' : 'SMS'} delivery is not configured in this environment, so use the dev code shown below.`;

    return res.json({
      message: responseMessage,
      delivery: {
        channel: contact.type,
        delivered: deliveryResult.delivered,
        mode: deliveryResult.mode,
        provider: deliveryResult.provider,
      },
      ...(deliveryResult.debugCode ? { debugCode: deliveryResult.debugCode } : {}),
    });
  } catch (error) {
    otpStore.clearCode({ purpose, identifier: contact.value });
    throw error;
  }
};

const respondWithError = (res, error, fallbackMessage) => {
  console.error(fallbackMessage, error);

  if (error.code === 11000) {
    return res.status(409).json({ error: 'Email, mobile number, or username already exists' });
  }

  return res.status(error.status || 500).json({
    error: error.message || fallbackMessage,
  });
};

exports.sendSignupCode = async (req, res) => {
  try {
    const contact = resolveContact(req.body.identifier);
    const existingUser = await findUserRecordByContact(contact);

    if (existingUser) {
      return res.status(409).json({ error: 'An account already exists with this email or mobile number' });
    }

    return await sendCodeAndRespond({
      res,
      purpose: SIGNUP_CODE_PURPOSE,
      contact,
      message: `Verification code sent to your ${contact.type}`,
    });
  } catch (error) {
    return respondWithError(res, error, 'Could not send signup code');
  }
};

exports.signup = async (req, res) => {
  try {
    const { username, identifier, password, confirmPassword, code, referralCode } = req.body;
    const normalizedUsername = String(username || '').trim();

    if (!normalizedUsername || !identifier || !password || !confirmPassword || !code) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (normalizedUsername.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long' });
    }

    const contact = resolveContact(identifier);

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters with uppercase, lowercase, and number',
      });
    }

    const otpValidation = otpStore.validateCode({
      purpose: SIGNUP_CODE_PURPOSE,
      identifier: contact.value,
      code,
    });

    if (!otpValidation.ok) {
      return res.status(otpValidation.status).json({ error: otpValidation.error });
    }

    const normalizedReferralCode = normalizeReferralCode(referralCode);
    const referrer = normalizedReferralCode
      ? await findUserRecordByReferralCode(normalizedReferralCode)
      : null;

    if (normalizedReferralCode && !referrer) {
      return res.status(400).json({ error: 'Invalid referral code' });
    }

    const uniqueReferralCode = await generateUniqueReferralCode();
    let user;

    if (shouldUseMemoryStore()) {
      user = await memoryStore.createUser({
        username: normalizedUsername,
        ...buildContactFields(contact),
        password,
        tokenBalance: DEFAULT_STARTING_TOKENS,
        referralCode: uniqueReferralCode,
        referredByUserId: referrer?._id || referrer?.id || '',
      });
    } else {
      const existingUser = await User.findOne(getDuplicateQuery(normalizedUsername, contact));
      if (existingUser) {
        return res.status(409).json({ error: 'Email, mobile number, or username already exists' });
      }

      const createdUser = new User({
        username: normalizedUsername,
        ...buildContactFields(contact),
        password,
        tokenBalance: DEFAULT_STARTING_TOKENS,
        referralCode: uniqueReferralCode,
        referredByUserId: referrer?._id || null,
        rewardedLikePostIds: [],
        rewardedFollowUserIds: [],
        tokenHistory: [],
      });
      await createdUser.save();
      user = createdUser;
    }

    if (referrer) {
      addTokensToUser(referrer, INVITE_REWARD, 'invite-referral', `New signup used referral code ${normalizedReferralCode}`);

      if (shouldUseMemoryStore()) {
        await memoryStore.persistStore();
      } else {
        ensureUserTokenState(referrer);
        await referrer.save();
      }
    }

    otpStore.clearCode({
      purpose: SIGNUP_CODE_PURPOSE,
      identifier: contact.value,
    });

    const token = generateToken(user.id || user._id);

    return res.status(201).json({
      message: `User created successfully. ${DEFAULT_STARTING_TOKENS} signup tokens added.`,
      token,
      user: serializeUser(user),
    });
  } catch (error) {
    return respondWithError(res, error, 'Signup failed');
  }
};

exports.login = async (req, res) => {
  try {
    const { identifier, email, phone, password, rememberMe } = req.body;
    const rawIdentifier = identifier || email || phone;

    if (!rawIdentifier || !password) {
      return res.status(400).json({ error: 'Email/mobile number and password are required' });
    }

    const contact = resolveContact(rawIdentifier);
    const user = await findUserRecordByContact(contact);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email/mobile number or password' });
    }

    const isPasswordValid = shouldUseMemoryStore()
      ? await memoryStore.comparePassword(user, password)
      : await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email/mobile number or password' });
    }

    if (!user.referralCode) {
      user.referralCode = await generateUniqueReferralCode();

      if (shouldUseMemoryStore()) {
        await memoryStore.persistStore();
      } else {
        await user.save();
      }
    }

    const token = generateToken(user.id || user._id);

    return res.json({
      message: 'Login successful',
      token,
      user: serializeUser(user),
      rememberMe,
    });
  } catch (error) {
    return respondWithError(res, error, 'Login failed');
  }
};

exports.sendPasswordResetCode = async (req, res) => {
  try {
    const contact = resolveContact(req.body.identifier);
    const user = await findUserRecordByContact(contact);

    if (!user) {
      return res.status(404).json({ error: 'No account found with this email or mobile number' });
    }

    return await sendCodeAndRespond({
      res,
      purpose: RESET_CODE_PURPOSE,
      contact,
      message: `Password reset code sent to your ${contact.type}`,
    });
  } catch (error) {
    return respondWithError(res, error, 'Could not send password reset code');
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { identifier, code, password, confirmPassword } = req.body;

    if (!identifier || !code || !password || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const contact = resolveContact(identifier);

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters with uppercase, lowercase, and number',
      });
    }

    const user = await findUserRecordByContact(contact);

    if (!user) {
      return res.status(404).json({ error: 'No account found with this email or mobile number' });
    }

    const otpValidation = otpStore.validateCode({
      purpose: RESET_CODE_PURPOSE,
      identifier: contact.value,
      code,
    });

    if (!otpValidation.ok) {
      return res.status(otpValidation.status).json({ error: otpValidation.error });
    }

    if (shouldUseMemoryStore()) {
      await memoryStore.updateUserPassword(user._id, password);
    } else {
      user.password = password;
      await user.save();
    }

    otpStore.clearCode({
      purpose: RESET_CODE_PURPOSE,
      identifier: contact.value,
    });

    return res.json({ message: 'Password reset successful. Please log in with your new password.' });
  } catch (error) {
    return respondWithError(res, error, 'Password reset failed');
  }
};

exports.checkPasswordStrength = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const strength = getPasswordStrength(password);

    return res.json({ strength });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to check password strength' });
  }
};
