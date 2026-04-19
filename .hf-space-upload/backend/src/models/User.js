const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { normalizeEmail, normalizePhone, validateEmail, validatePhone } = require('../utils/validators');
const { DEFAULT_STARTING_TOKENS, normalizeReferralCode } = require('../utils/tokenUtils');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: (value) => !value || validateEmail(value),
      message: 'Please enter a valid email',
    },
  },
  phone: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    validate: {
      validator: (value) => !value || validatePhone(value),
      message: 'Please enter a valid mobile number',
    },
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
  },
  avatarUrl: {
    type: String,
    default: '',
  },
  followers: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    default: [],
  },
  following: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    default: [],
  },
  tokenBalance: {
    type: Number,
    default: DEFAULT_STARTING_TOKENS,
    min: 0,
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true,
  },
  referredByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  rewardedLikePostIds: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GalleryPost',
    }],
    default: [],
  },
  rewardedFollowUserIds: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    default: [],
  },
  tokenHistory: {
    type: [{
      amount: {
        type: Number,
        required: true,
      },
      type: {
        type: String,
        enum: ['credit', 'debit'],
        required: true,
      },
      reason: {
        type: String,
        required: true,
        trim: true,
      },
      note: {
        type: String,
        default: '',
        trim: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    }],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
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
