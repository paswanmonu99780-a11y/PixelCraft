const mongoose = require('mongoose');

const memorySchema = new mongoose.Schema({
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
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 280,
  },
  type: {
    type: String,
    enum: ['personal', 'preference', 'fact', 'reminder'],
    default: 'personal',
  },
  isActive: {
    type: Boolean,
    default: true,
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
memorySchema.index({ userId: 1, isActive: 1 });
memorySchema.index({ assistantClientId: 1 });
memorySchema.index({ createdAt: -1 });

// Update updatedAt on save
memorySchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Memory', memorySchema);