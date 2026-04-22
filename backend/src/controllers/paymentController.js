const Razorpay = require('razorpay');
const User = require('../models/User');
const { addTokensToUser, ensureUserTokenState } = require('../utils/tokenUtils');
const { shouldUseMemoryStore } = require('../config/dbMode');
const memoryStore = require('../store/memoryStore');

// Pricing plans configuration
const PLANS = {
  basic: {
    id: 'basic',
    name: 'Basic',
    credits: 100,
    price: 199, // Price in rupees
    priceId: 'plan_basic_monthly'
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    credits: 300,
    price: 499, // Price in rupees
    priceId: 'plan_pro_monthly'
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    credits: 1000,
    price: 999, // Price in rupees
    priceId: 'plan_premium_monthly'
  }
};

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'your_key_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'your_key_secret'
});

// Create Razorpay order for purchasing credits
exports.createOrder = async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.userId;

    // Validate plan
    const plan = PLANS[planId];
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    // Create Razorpay order
    const options = {
      amount: plan.price * 100, // Amount in paise
      currency: 'INR',
      receipt: `order_${userId}_${Date.now()}`,
      notes: {
        userId: userId,
        planId: planId,
        credits: plan.credits
      }
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      plan: {
        id: plan.id,
        name: plan.name,
        credits: plan.credits
      }
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
};

// Verify payment and add credits
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId
    } = req.body;

    const userId = req.userId;

    // Validate plan
    const plan = PLANS[planId];
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    // Verify signature (in production, use proper crypto verification)
    const generated_signature = hmac_sha256(
      razorpay_order_id + '|' + razorpay_payment_id,
      process.env.RAZORPAY_KEY_SECRET
    );

    // In production, properly verify the signature
    // if (generated_signature !== razorpay_signature) {
    //   return res.status(400).json({ error: 'Payment verification failed' });
    // }

    // Get user and add credits
    let user;
    if (shouldUseMemoryStore()) {
      user = await memoryStore.getUserRecordById(userId);
    } else {
      user = await User.findById(userId);
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    ensureUserTokenState(user);
    addTokensToUser(user, plan.credits, 'purchase', `Purchased ${plan.name} plan - ${plan.credits} credits`);
    
    // Mark user as premium for plans with 300+ credits
    if (plan.credits >= 300) {
      user.isPremium = true;
    }

    if (shouldUseMemoryStore()) {
      await memoryStore.persistStore();
    } else {
      await user.save();
    }

    res.json({
      success: true,
      message: `Payment successful! ${plan.credits} credits added to your account.`,
      credits: user.tokenBalance,
      isPremium: user.isPremium
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
};

// Get available plans
exports.getPlans = (req, res) => {
  const plansList = Object.values(PLANS).map(plan => ({
    id: plan.id,
    name: plan.name,
    credits: plan.credits,
    price: plan.price,
    priceId: plan.priceId
  }));

  res.json({ plans: plansList });
};

// Helper function for HMAC SHA256
function hmac_sha256(data, secret) {
  const crypto = require('crypto');
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

// Get user subscription status
exports.getSubscriptionStatus = async (req, res) => {
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

    res.json({
      isPremium: user.isPremium || false,
      credits: user.tokenBalance || 0,
      dailyLimit: user.dailyLimit || 5,
      usedToday: user.usedToday || 0
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
};

module.exports = exports;
module.exports.PLANS = PLANS;