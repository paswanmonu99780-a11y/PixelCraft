const Image = require('../models/Image');
const imageGenerator = require('../utils/imageGenerator');
const tokenUtils = require('../utils/tokenUtils');
const spendTokensFromUser = tokenUtils.spendCreditsFromUser;
const ensureUserTokenState = tokenUtils.ensureUserCreditState;
const IMAGE_GENERATION_CREDIT_COST = tokenUtils.IMAGE_GENERATION_CREDIT_COST;
const User = require('../models/User');
const { shouldUseMemoryStore } = require('../config/dbMode');
const memoryStore = require('../store/memoryStore');
const creditsController = require('./creditsController');

// Preview image from external source
exports.previewImage = async (req, res) => {
  try {
    const { source } = req.query;
    if (!source) {
      return res.status(400).json({ error: 'Source URL required' });
    }

    const { fetchImageBuffer, isAllowedPreviewSource } = require('../utils/imageGenerator');
    if (!isAllowedPreviewSource(source)) {
      return res.status(400).json({ error: 'Invalid source URL' });
    }

    const { buffer, contentType } = await fetchImageBuffer(source);
    res.set('Content-Type', contentType);
    res.send(buffer);
  } catch (error) {
    console.error('Preview error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
};

// Serve generated media file
exports.serveGeneratedMedia = async (req, res) => {
  try {
    const { fileName } = req.params;
    const filePath = path.join(__dirname, '../../uploads', fileName);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Serve media error:', error);
    res.status(404).json({ error: 'Media not found' });
  }
};

// Get video generation status
exports.getVideoStatus = async (req, res) => {
  const videoGenerator = require('../utils/videoGenerator');
  res.json(videoGenerator.getStatus());
};

// Generate image (main endpoint)
exports.generateImage = async (req, res) => {
  try {
    const { prompt, ratio, quality } = req.body;
    const userId = req.userId;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
      return res.status(400).json({ error: 'Valid prompt required (min 3 chars)' });
    }

    // Get user
    let user;
    if (shouldUseMemoryStore()) {
      user = await memoryStore.getUserRecordById(userId);
    } else {
      user = await User.findById(userId);
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate image URL FIRST
    console.log('GEN REQ:', { prompt, ratio, quality, userId });

    const generationOptions = { ratio: ratio || '1:1', quality: quality || 'balanced' };
    const imageUrl = await imageGenerator.generateImageWithHuggingFace(prompt, generationOptions);
    console.log('GEN IMG URL:', imageUrl);

    if (!imageUrl || !imageUrl.startsWith('http')) {
      return res.status(500).json({ error: 'Invalid image URL generated' });
    }

    // Deduct tokens ONLY AFTER success
tokenUtils.spendCreditsFromUser(user, IMAGE_GENERATION_CREDIT_COST, 'image_generation', `Prompt: ${prompt.slice(0, 50)}`);

    // Save image record

    let image;
    if (shouldUseMemoryStore()) {
      image = await memoryStore.createImage({
        userId,
        prompt: prompt.trim(),
        imageUrl,
        ratio: generationOptions.ratio,
        quality: generationOptions.quality,
      });
    } else {
      image = new Image({
        userId,
        prompt: prompt.trim(),
        imageUrl,
        ratio: generationOptions.ratio,
        quality: generationOptions.quality,
      });

      await image.save();
    }

    // Increment daily usage
    await creditsController.incrementDailyUsage(userId);

    // Save user if using DB
    if (!shouldUseMemoryStore()) {
      await user.save();
    } else {
      await memoryStore.persistStore();
    }

    // Return success with updated user
    res.json({
      image: {
        id: image._id,
        prompt: image.prompt,
        imageUrl: image.imageUrl,
        ratio: image.ratio,
        quality: image.quality,
        generatedAt: image.generatedAt,
      },
currentUser: tokenUtils.ensureUserCreditState(user),
    });
  } catch (error) {
    console.error('Generate image error:', error);
    if (error.status === 402) {
      res.status(402).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Image generation failed' });
    }
  }
};

// Generate text-to-video
exports.generateTextToVideo = async (req, res) => {
  try {
    // Similar logic but for video - tokens deducted separately or skipped
    res.status(501).json({ error: 'Video generation not implemented' });
  } catch (error) {
    res.status(500).json({ error: 'Video generation failed' });
  }
};

// Generate image-to-video
exports.generateImageToVideo = async (req, res) => {
  try {
    res.status(501).json({ error: 'Image-to-video not implemented' });
  } catch (error) {
    res.status(500).json({ error: 'Image-to-video failed' });
  }
};

// Get user image history
exports.getUserHistory = async (req, res) => {
  try {
    const userId = req.userId;
    let images;

    if (shouldUseMemoryStore()) {
      const result = await memoryStore.getImagesByUserId(userId, 1, 50);
      images = result.images;
    } else {
      images = await Image.find({ userId }).sort({ generatedAt: -1 }).limit(50);
    }

    res.json(images);
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Could not fetch history' });
  }
};

// Delete image
exports.deleteImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    const userId = req.userId;

    let image;
    if (shouldUseMemoryStore()) {
      const existingImage = await memoryStore.findImageById(imageId);
      if (!existingImage || existingImage.userId !== userId) {
        return res.status(404).json({ error: 'Image not found' });
      }

      image = await memoryStore.deleteImageById(imageId);
    } else {
      image = await Image.findOneAndDelete({ _id: imageId, userId });
    }

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    res.json({ message: 'Image deleted' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Could not delete image' });
    }
};

module.exports = exports;

