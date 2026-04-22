const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { normalizeEmail, normalizePhone, validateEmail, validatePhone } = require('../utils/validators');
const tokenUtils = require('../utils/tokenUtils');
const DEFAULT_STARTING_TOKENS = tokenUtils.DEFAULT_STARTING_CREDITS;
const normalizeReferralCode = tokenUtils.normalizeReferralCode;

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  credits: {
    type: Number,
    default: 10 // New users get 10 free credits
  },
  dailyLimit: {
    type: Number,
    default: 5 // Free users: 5 images per day
  },
  usedToday: {
    type: Number,
    default: 0
  },
  lastReset: {
    type: Date,
    default: Date.now
  },
  isPremium: {
    type: Boolean,
    default: false
  }
});

userSchema.pre('validate', function (next) {
  if (typeof this.email === 'string') {
    const nextEmail = normalizeEmail(this.email);
    this.email = nextEmail || undefined;
  }

  if (typeof this.phone === 'string') {
    const nextPhone = normalizePhone(this.phone);
    this.phone = nextPhone || undefined;
  }

  if (typeof this.referralCode === 'string') {
    this.referralCode = normalizeReferralCode(this.referralCode) || undefined;
  }

  next();
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (passwordAttempt) {
  return await bcrypt.compare(passwordAttempt, this.password);
};

module.exports = mongoose.model('User', userSchema);
