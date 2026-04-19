const normalizeId = (value) => {
  if (!value) return '';
  return String(value._id || value.id || value);
};

const normalizeIdList = (values = []) =>
  Array.isArray(values)
    ? values.map((value) => normalizeId(value)).filter(Boolean)
    : [];

const serializeUser = (user) => {
  if (!user) return null;

  const followers = normalizeIdList(user.followers || user.followerUserIds);
  const following = normalizeIdList(user.following || user.followingUserIds);

  return {
    _id: normalizeId(user),
    id: normalizeId(user),
    username: user.username,
    email: user.email || '',
    phone: user.phone || '',
    contactMethod: user.email ? 'email' : user.phone ? 'phone' : '',
    contactValue: user.email || user.phone || '',
    avatarUrl: user.avatarUrl || '',
    createdAt: user.createdAt,
    followersCount: followers.length,
    followingCount: following.length,
    followerUserIds: followers,
    followingUserIds: following,
    tokenBalance: Number.isFinite(Number(user.tokenBalance)) ? Number(user.tokenBalance) : 50,
    referralCode: user.referralCode || '',
    referredByUserId: normalizeId(user.referredByUserId),
    tokenHistory: Array.isArray(user.tokenHistory)
      ? user.tokenHistory.map((entry) => ({
          amount: Number(entry?.amount) || 0,
          type: entry?.type === 'debit' ? 'debit' : 'credit',
          reason: entry?.reason || 'manual',
          note: entry?.note || '',
          createdAt: entry?.createdAt || '',
        }))
      : [],
  };
};

module.exports = {
  normalizeId,
  normalizeIdList,
  serializeUser,
};
