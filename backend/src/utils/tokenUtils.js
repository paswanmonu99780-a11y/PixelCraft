const crypto = require('crypto');

// Configurable credit economics
const DEFAULT_STARTING_CREDITS = Number(process.env.DEFAULT_STARTING_CREDITS) || 20;
const IMAGE_GENERATION_CREDIT_COST = Number(process.env.IMAGE_GENERATION_CREDIT_COST) || 1;
const DAILY_FREE_LIMIT = Number(process.env.DAILY_FREE_LIMIT) || 5;
const TOKEN_HISTORY_LIMIT = Number(process.env.TOKEN_HISTORY_LIMIT) || 30;

const normalizeStringList = (values = []) => (
  Array.isArray(values)
    ? [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
    : []
);

const normalizeCreditAmount = (value, fallback = DEFAULT_STARTING_CREDITS) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const normalizeReferralCode = (value = '') => 
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16);

const buildCreditHistoryEntry = ({ amount = 0, reason = '', note = '' } = {}) => ({
  amount: Number(amount) || 0,
  type: Number(amount) >= 0 ? 'credit' : 'debit',
  reason: String(reason || '').trim() || 'manual',
  note: String(note || '').trim(),
  createdAt: new Date().toISOString(),
});

const ensureUserCreditState = (user = {}) => {
  if (!user || typeof user !== 'object') {
    return user;
  }

  user.credits = normalizeCreditAmount(user.credits);
  user.referralCode = normalizeReferralCode(user.referralCode);
  user.rewardedLikePostIds = normalizeStringList(user.rewardedLikePostIds);
  user.rewardedFollowUserIds = normalizeStringList(user.rewardedFollowUserIds);
  user.creditHistory = Array.isArray(user.creditHistory)
    ? user.creditHistory
        .map((entry) => ({
          amount: Number(entry?.amount) || 0,
          type: entry?.type === 'debit' ? 'debit' : 'credit',
          reason: String(entry?.reason || '').trim() || 'manual',
          note: String(entry?.note || '').trim(),
          createdAt: entry?.createdAt || new Date().toISOString(),
        }))
        .slice(0, TOKEN_HISTORY_LIMIT)
    : [];

  if (!user.referredByUserId) {
    user.referredByUserId = '';
  } else {
    user.referredByUserId = String(user.referredByUserId);
  }

  return user;
};

const getUserCreditBalance = (user = {}) => ensureUserCreditState(user)?.credits ?? DEFAULT_STARTING_CREDITS;

const addCreditHistoryEntry = (user = {}, entry = {}) => {
  ensureUserCreditState(user);
  user.creditHistory.unshift(buildCreditHistoryEntry(entry));
  user.creditHistory = user.creditHistory.slice(0, TOKEN_HISTORY_LIMIT);
};

const addCreditsToUser = (user = {}, amount = 0, reason = '', note = '') => {
  ensureUserCreditState(user);
  const normalizedAmount = Number(amount) || 0;

  if (!normalizedAmount) {
    return user;
  }

  user.credits += normalizedAmount;
  addCreditHistoryEntry(user, {
    amount: normalizedAmount,
    reason,
    note,
  });
  return user;
};

const spendCreditsFromUser = (user = {}, amount = 0, reason = '', note = '') => {
  ensureUserCreditState(user);
  const normalizedAmount = Math.abs(Number(amount) || 0);

  if (!normalizedAmount) {
    return user;
  }

  if (user.credits < normalizedAmount) {
    const error = new Error(`You need ${normalizedAmount} credit${normalizedAmount === 1 ? '' : 's'} to continue`);
    error.status = 402;
    throw error;
  }

  user.credits -= normalizedAmount;
  addCreditHistoryEntry(user, {
    amount: normalizedAmount * -1,
    reason,
    note,
  });
  return user;
};

const hasRewardMarker = (user = {}, fieldName = '', value = '') => {
  ensureUserCreditState(user);
  const normalizedValue = String(value || '').trim();
  return Boolean(normalizedValue && normalizeStringList(user[fieldName]).includes(normalizedValue));
};

const addRewardMarker = (user = {}, fieldName = '', value = '') => {
  ensureUserCreditState(user);
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return user;
  }

  user[fieldName] = normalizeStringList([...(user[fieldName] || []), normalizedValue]);
  return user;
};

const generateReferralCode = () => normalizeReferralCode(`PC${crypto.randomBytes(4).toString('hex')}`);

module.exports = {
  DEFAULT_STARTING_CREDITS,
  IMAGE_GENERATION_CREDIT_COST,
  DAILY_FREE_LIMIT,
  TOKEN_HISTORY_LIMIT,
  normalizeReferralCode,
  addRewardMarker,
  addCreditsToUser,
  ensureUserCreditState,
  generateReferralCode,
  getUserCreditBalance,
  hasRewardMarker,
  spendCreditsFromUser,
};

