const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  provider: {
    type: String,
    default: '',
  },
  model: {
    type: String,
    default: '',
  },
});

const conversationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  assistantClientId: {
    type: String,
    default: '',
    trim: true,
  },
  sessionId: {
    type: String,
    required: true,
    trim: true,
  },
  messages: {
    type: [messageSchema],
    default: [],
  },
  context: {
    pagePath: {
      type: String,
      default: '',
    },
    pageTitle: {
      type: String,
      default: '',
    },
    pageSummary: {
      type: String,
      default: '',
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for efficient queries
conversationSchema.index({ userId: 1, sessionId: 1 });
conversationSchema.index({ assistantClientId: 1 });
conversationSchema.index({ updatedAt: -1 });

// Update updatedAt on save
conversationSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Conversation', conversationSchema);