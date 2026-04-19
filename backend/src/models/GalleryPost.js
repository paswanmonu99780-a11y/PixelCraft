const mongoose = require('mongoose');

const galleryPostSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  username: {
    type: String,
    required: true,
    trim: true,
  },
  userAvatarUrl: {
    type: String,
    default: '',
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  },
  description: {
    type: String,
    default: '',
    trim: true,
    maxlength: 2000,
  },
  prompt: {
    type: String,
    default: '',
    trim: true,
    maxlength: 2000,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  source: {
    type: String,
    enum: ['upload', 'generated'],
    default: 'upload',
  },
  likedBy: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    default: [],
  },
  shareCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  authorFollowersCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('GalleryPost', galleryPostSchema);
