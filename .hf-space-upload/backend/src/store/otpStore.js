const crypto = require('crypto');

const otpState = new Map();

const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 10);
const OTP_COOLDOWN_SECONDS = Number(process.env.OTP_COOLDOWN_SECONDS || 60);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);

const getKey = ({ purpose, identifier }) => `${purpose}:${identifier}`;

const hashCode = (code) =>
  crypto.createHash('sha256').update(String(code || '').trim()).digest('hex');

const generateCode = () => `${crypto.randomInt(0, 1000000)}`.padStart(6, '0');

const clearExpiredCodes = () => {
  const now = Date.now();

  for (const [key, entry] of otpState.entries()) {
    if (entry.expiresAt <= now) {
      otpState.delete(key);
    }
  }
};

const createCode = ({ purpose, identifier, channel }) => {
  clearExpiredCodes();

  const key = getKey({ purpose, identifier });
  const existingEntry = otpState.get(key);
  const now = Date.now();

  if (existingEntry?.cooldownUntil > now) {
    const retryAfterSeconds = Math.ceil((existingEntry.cooldownUntil - now) / 1000);
    const error = new Error(`Please wait ${retryAfterSeconds} seconds before requesting a new code.`);
    error.status = 429;
    throw error;
  }

  const code = generateCode();
  const expiresAt = now + OTP_EXPIRY_MINUTES * 60 * 1000;
  const cooldownUntil = now + OTP_COOLDOWN_SECONDS * 1000;

  otpState.set(key, {
    channel,
    attempts: 0,
    codeHash: hashCode(code),
    createdAt: now,
    cooldownUntil,
    expiresAt,
  });

  return {
    code,
    expiresAt,
  };
};

const validateCode = ({ purpose, identifier, code }) => {
  clearExpiredCodes();

  const key = getKey({ purpose, identifier });
  const entry = otpState.get(key);

  if (!entry) {
    return {
      ok: false,
      status: 400,
      error: 'Code not found. Please request a new one.',
    };
  }

  if (entry.expiresAt <= Date.now()) {
    otpState.delete(key);
    return {
      ok: false,
      status: 400,
      error: 'Code expired. Please request a new one.',
    };
  }

  if (entry.attempts >= OTP_MAX_ATTEMPTS) {
    otpState.delete(key);
    return {
      ok: false,
      status: 400,
      error: 'Too many incorrect attempts. Please request a new code.',
    };
  }

  if (entry.codeHash !== hashCode(code)) {
    entry.attempts += 1;
    otpState.set(key, entry);

    const attemptsLeft = OTP_MAX_ATTEMPTS - entry.attempts;
    if (attemptsLeft <= 0) {
      otpState.delete(key);
      return {
        ok: false,
        status: 400,
        error: 'Too many incorrect attempts. Please request a new code.',
      };
    }

    return {
      ok: false,
      status: 400,
      error: `Invalid code. ${attemptsLeft} attempt(s) remaining.`,
    };
  }

  return {
    ok: true,
    expiresAt: entry.expiresAt,
  };
};

const clearCode = ({ purpose, identifier }) => {
  otpState.delete(getKey({ purpose, identifier }));
};

module.exports = {
  clearCode,
  createCode,
  validateCode,
};
