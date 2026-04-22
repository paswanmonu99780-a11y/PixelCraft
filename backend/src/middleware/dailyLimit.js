const User = require('../models/User');
const { shouldUseMemoryStore } = require('../config/dbMode');
const memoryStore = require('../store/memoryStore');
const creditsController = require('../controllers/creditsController');

// Reset daily usage if 24 hours have passed
// This middleware checks and resets the daily usage counter for non-premium users
const dailyLimitReset = async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return next();
    }

    let user;
    if (shouldUseMemoryStore()) {
      user = await memoryStore.getUserRecordById(userId);
    } else {
      user = await User.findById(userId);
    }

    if (!user) {
      return next();
    }

    // Skip reset for premium users
    if (user.isPremium) {
      return next();
    }

    // Check if 24 hours have passed since last reset
    const now = new Date();
    const lastReset = new Date(user.lastReset || now);
    const hoursDiff = (now - lastReset) / (1000 * 60 * 60);

    if (hoursDiff >= 24) {
      user.usedToday = 0;
      user.lastReset = now;

      if (shouldUseMemoryStore()) {
        await memoryStore.persistStore();
      } else {
        await user.save();
      }
    }

    next();
  } catch (error) {
    console.error('Daily limit reset middleware error:', error);
    next();
  }
};

// Middleware to check if user has exceeded daily limit
const checkDailyLimit = async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let user;
    if (shouldUseMemoryStore()) {
      user = await memoryStore.getUserRecordById(userId);
    } else {
      user = await User.findById(userId);
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    creditsController.resetDailyUsageIfNeeded(user);

    // Premium users have unlimited generation
    if (user.isPremium) {
      return next();
    }

    // Check daily limit
    const dailyLimit = user.dailyLimit || 5;
    const usedToday = user.usedToday || 0;

    if (usedToday >= dailyLimit) {
      return res.status(429).json({
        error: 'Daily limit exceeded',
        message: 'You have reached your daily generation limit. Upgrade to Premium for unlimited generations.',
        upgradeRequired: true,
        dailyLimit,
        usedToday
      });
    }

    next();
  } catch (error) {
    console.error('Check daily limit middleware error:', error);
    next();
  }
};

module.exports = {
  dailyLimitReset,
  checkDailyLimit
};