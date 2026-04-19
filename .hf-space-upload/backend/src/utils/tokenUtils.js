const crypto = require('crypto');

const DEFAULT_STARTING_TOKENS = 50;
const IMAGE_GENERATION_TOKEN_COST = 1;
const GALLERY_UPLOAD_REWARD = 10;
const POST_LIKE_REWARD = 3;
const FOLLOW_REWARD = 15;
const INVITE_REWARD = 70;
const TOKEN_HISTORY_LIMIT = 30;

const normalizeStringList = (values = []) => (
  Array.isArray(values)
    ? [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
    : []
);

const normalizeTokenAmount = (value, fallback = DEFAULT_STARTING_TOKENS) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const normalizeReferralCode = (value = '') =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16);

const buildTokenHistoryEntry = ({ amount = 0, reason = '', note = '' } = {}) => ({
  amount: Number(amount) || 0,
  type: Number(amount) >= 0 ? 'credit' : 'debit',
  reason: String(reason || '').trim() || 'manual',
  note: String(note || '').trim(),
  createdAt: new Date().toISOString(),
});

const ensureUserTokenState = (user = {}) => {
  if (!user || typeof user !== 'object') {
    return user;
  }

  user.tokenBalance = normalizeTokenAmount(user.tokenBalance);
  user.referralCode = normalizeReferralCode(user.referralCode);
  user.rewardedLikePostIds = normalizeStringList(user.rewardedLikePostIds);
  user.rewardedFollowUserIds = normalizeStringList(user.rewardedFollowUserIds);
  user.tokenHistory = Array.isArray(user.tokenHistory)
    ? user.tokenHistory
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

const getUserTokenBalance = (user = {}) => ensureUserTokenState(user)?.tokenBalance ?? DEFAULT_STARTING_TOKENS;

const addTokenHistoryEntry = (user = {}, entry = {}) => {
  ensureUserTokenState(user);
  user.tokenHistory.unshift(buildTokenHistoryEntry(entry));
  user.tokenHistory = user.tokenHistory.slice(0, TOKEN_HISTORY_LIMIT);
};

const addTokensToUser = (user = {}, amount = 0, reason = '', note = '') => {
  ensureUserTokenState(user);
  const normalizedAmount = Number(amount) || 0;

  if (!normalizedAmount) {
    return user;
  }

  user.tokenBalance += normalizedAmount;
  addTokenHistoryEntry(user, {
    amount: normalizedAmount,
    reason,
    note,
  });
  return user;
};

const spendTokensFromUser = (user = {}, amount = 0, reason = '', note = '') => {
  ensureUserTokenState(user);
  const normalizedAmount = Math.abs(Number(amount) || 0);

  if (!normalizedAmount) {
    return user;
  }

  if (user.tokenBalance < normalizedAmount) {
    const error = new Error(`You need ${normalizedAmount} token${normalizedAmount === 1 ? '' : 's'} to continue`);
    error.status = 402;
    throw error;
  }

  user.tokenBalance -= normalizedAmount;
  addTokenHistoryEntry(user, {
    amount: normalizedAmount * -1,
    reason,
    note,
  });
  return user;
};

const hasRewardMarker = (user = {}, fieldName = '', value = '') => {
  ensureUserTokenState(user);
  const normalizedValue = String(value || '').trim();
  return Boolean(normalizedValue && normalizeStringList(user[fieldName]).includes(normalizedValue));
};

const addRewardMarker = (user = {}, fieldName = '', value = '') => {
  ensureUserTokenState(user);
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return user;
  }

  user[fieldName] = normalizeStringList([...(user[fieldName] || []), normalizedValue]);
  return user;
};

const generateReferralCode = () => normalizeReferralCode(`NC${crypto.randomBytes(4).toString('hex')}`);

module.exports = {
  DEFAULT_STARTING_TOKENS,
  FOLLOW_REWARD,
  GALLERY_UPLOAD_REWARD,
  IMAGE_GENERATION_TOKEN_COST,
  INVITE_REWARD,
  POST_LIKE_REWARD,
  addRewardMarker,
  addTokensToUser,
  ensureUserTokenState,
  generateReferralCode,
  getUserTokenBalance,
  hasRewardMarker,
  normalizeReferralCode,
  spendTokensFromUser,
};
