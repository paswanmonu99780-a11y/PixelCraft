const User = require('../models/User');
const { shouldUseMemoryStore } = require('../config/dbMode');
const memoryStore = require('../store/memoryStore');
const { DAILY_FREE_LIMIT } = require('../utils/tokenUtils');

// Get user data with credits and daily usage info
exports.getUserData = async (req, res) => {
  try {
    const userId = req.userId;

    let user;
    if (shouldUseMemoryStore()) {
      user = await memoryStore.getUserRecordById(userId);
    } else {
      user = await User.findById(userId).select('-password');
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Reset daily usage if 24 hours have passed
    resetDailyUsageIfNeeded(user);

    res.json({
      email: user.email,
      credits: user.tokenBalance || 0,
      isPremium: user.isPremium || false,
      dailyLimit: user.dailyLimit || DAILY_FREE_LIMIT,
      usedToday: user.usedToday || 0,
      lastReset: user.lastReset
    });
  } catch (error) {
    console.error('Get user data error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
};

// Check if user can generate image
exports.checkGenerationLimit = async (req, res) => {
  try {
    const userId = req.userId;

    let user;
    if (shouldUseMemoryStore()) {
      user = await memoryStore.getUserRecordById(userId);
    } else {
      user = await User.findById(userId);
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Reset daily usage if needed
    resetDailyUsageIfNeeded(user);

    // Check daily limit for non-premium users
    const canGenerate = user.isPremium || (user.usedToday < (user.dailyLimit || DAILY_FREE_LIMIT));

    res.json({
      canGenerate,
      credits: user.tokenBalance || 0,
      isPremium: user.isPremium || false,
      dailyLimit: user.dailyLimit || DAILY_FREE_LIMIT,
      usedToday: user.usedToday || 0,
      remainingDaily: Math.max(0, (user.dailyLimit || DAILY_FREE_LIMIT) - (user.usedToday || 0))
    });
  } catch (error) {
    console.error('Check limit error:', error);
    res.status(500).json({ error: 'Failed to check generation limit' });
  }
};

// Increment daily usage after successful generation
exports.incrementDailyUsage = async (userId) => {
  try {
    let user;
    if (shouldUseMemoryStore()) {
      user = await memoryStore.getUserRecordById(userId);
    } else {
      user = await User.findById(userId);
    }

    if (!user) return;

    resetDailyUsageIfNeeded(user);
    user.usedToday = (user.usedToday || 0) + 1;

    if (shouldUseMemoryStore()) {
      await memoryStore.persistStore();
    } else {
      await user.save();
    }

    return user;
  } catch (error) {
    console.error('Increment daily usage error:', error);
  }
};

// Reset daily usage if 24 hours have passed since last reset
function resetDailyUsageIfNeeded(user) {
  if (!user.lastReset) {
    user.lastReset = new Date();
    return;
  }

  const now = new Date();
  const lastReset = new Date(user.lastReset);
  const hoursDiff = (now - lastReset) / (1000 * 60 * 60);

  if (hoursDiff >= 24) {
    user.usedToday = 0;
    user.lastReset = now;
  }
}

// Get credits balance
exports.getCreditsBalance = async (req, res) => {
  try {
    const userId = req.userId;

    let user;
    if (shouldUseMemoryStore()) {
      user = await memoryStore.getUserRecordById(userId);
    } else {
      user = await User.findById(userId);
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      credits: user.tokenBalance || 0,
      isPremium: user.isPremium || false
    });
  } catch (error) {
    console.error('Get credits error:', error);
    res.status(500).json({ error: 'Failed to get credits balance' });
  }
};

module.exports.resetDailyUsageIfNeeded = resetDailyUsageIfNeeded;
