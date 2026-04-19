const Image = require('../models/Image');
const User = require('../models/User');
const fs = require('fs');
const {
  buildImagePreviewPath,
  fetchImageBuffer,
  generateImageWithHuggingFace,
  isAllowedPreviewSource,
  normalizeGenerationOptions,
} = require('../utils/imageGenerator');
const {
  generateImageToVideo: createImageToVideo,
  generateTextToVideo: createTextToVideo,
  getVideoGenerationStatus,
  resolveGeneratedMediaPath,
} = require('../utils/videoGenerator');
const { shouldUseMemoryStore } = require('../config/dbMode');
const memoryStore = require('../store/memoryStore');
const { isValidVideoSourceInput } = require('../utils/imageValidation');
const { serializeUser } = require('../utils/userSerializer');
const {
  IMAGE_GENERATION_TOKEN_COST,
  ensureUserTokenState,
  getUserTokenBalance,
  spendTokensFromUser,
} = require('../utils/tokenUtils');
const MAX_PROMPT_LENGTH = 2000;

const buildAbsoluteUrl = (req, path) => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const forwardedProtocol = req.headers['x-forwarded-proto']?.split(',')[0];
  const protocol = forwardedProtocol || req.protocol || 'http';
  const host = req.get('host');

  return `${protocol}://${host}${path.startsWith('/') ? path : `/${path}`}`;
};

// Generate Image
exports.generateImage = async (req, res) => {
  try {
    const { prompt, ratio, quality } = req.body;
    const userId = req.userId;

    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return res.status(400).json({ error: `Prompt must be less than ${MAX_PROMPT_LENGTH} characters` });
    }

    const currentUser = shouldUseMemoryStore()
      ? await memoryStore.getUserRecordById(userId)
      : await User.findById(userId).select('-password');

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    ensureUserTokenState(currentUser);

    if (getUserTokenBalance(currentUser) < IMAGE_GENERATION_TOKEN_COST) {
      return res.status(402).json({
        error: `You need at least ${IMAGE_GENERATION_TOKEN_COST} token to generate an image`,
      });
    }

    const generationOptions = normalizeGenerationOptions({ ratio, quality });
    const sourceImageUrl = await generateImageWithHuggingFace(prompt, generationOptions);
    const imageUrl = buildAbsoluteUrl(req, buildImagePreviewPath(sourceImageUrl));
    spendTokensFromUser(currentUser, IMAGE_GENERATION_TOKEN_COST, 'generate-image', 'Image generation cost');

    // Save to database
    const image = shouldUseMemoryStore()
      ? await memoryStore.createImage({
          userId,
          prompt,
          imageUrl,
          ratio: generationOptions.ratio,
          quality: generationOptions.quality,
        })
      : await (async () => {
          const createdImage = new Image({
            userId,
            prompt,
            imageUrl,
            ratio: generationOptions.ratio,
            quality: generationOptions.quality,
          });
          await createdImage.save();
          return createdImage;
        })();

    if (shouldUseMemoryStore()) {
      await memoryStore.persistStore();
    } else {
      await currentUser.save();
    }

    res.json({
      message: `Image generated successfully. ${IMAGE_GENERATION_TOKEN_COST} token used.`,
      image: {
        id: image._id,
        prompt: image.prompt,
        imageUrl: image.imageUrl,
        ratio: image.ratio || generationOptions.ratio,
        quality: image.quality || generationOptions.quality,
        generatedAt: image.generatedAt,
      },
      currentUser: serializeUser(currentUser),
    });
  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate image' });
  }
};

exports.generateTextToVideo = async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return res.status(400).json({ error: `Prompt must be less than ${MAX_PROMPT_LENGTH} characters` });
    }

    const video = await createTextToVideo(prompt.trim());

    res.json({
      message: 'Video generated successfully',
      video: {
        id: video.fileName,
        prompt: prompt.trim(),
        videoUrl: buildAbsoluteUrl(req, video.relativePath),
        generatedAt: new Date().toISOString(),
        format: video.contentType,
      },
    });
  } catch (error) {
    console.error('Text-to-video generation error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to generate video' });
  }
};

exports.generateImageToVideo = async (req, res) => {
  try {
    const { prompt = '', sourceImage } = req.body;

    if (!isValidVideoSourceInput(sourceImage)) {
      return res.status(400).json({ error: 'Please upload a valid source image' });
    }

    if (typeof prompt === 'string' && prompt.length > MAX_PROMPT_LENGTH) {
      return res.status(400).json({ error: `Prompt must be less than ${MAX_PROMPT_LENGTH} characters` });
    }

    const video = await createImageToVideo({
      prompt: String(prompt || ''),
      sourceImage,
    });

    res.json({
      message: 'Video generated successfully',
      video: {
        id: video.fileName,
        prompt: String(prompt || '').trim(),
        videoUrl: buildAbsoluteUrl(req, video.relativePath),
        generatedAt: new Date().toISOString(),
        format: video.contentType,
      },
    });
  } catch (error) {
    console.error('Image-to-video generation error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to generate video' });
  }
};

exports.getVideoStatus = async (req, res) => {
  try {
    return res.json({
      video: getVideoGenerationStatus(),
    });
  } catch (error) {
    console.error('Video status error:', error);
    return res.status(error.status || 500).json({
      error: error.message || 'Failed to load video status',
    });
  }
};

exports.previewImage = async (req, res) => {
  try {
    const { source } = req.query;

    if (!isAllowedPreviewSource(source)) {
      return res.status(400).json({ error: 'Invalid image preview source' });
    }

    const { buffer, contentType } = await fetchImageBuffer(source);

    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (error) {
    console.error('Image preview proxy error:', error);

    if (isAllowedPreviewSource(req.query.source)) {
      console.warn('Falling back to direct image source for preview');
      return res.redirect(req.query.source);
    }

    res.status(error.status || 502).json({
      error: error.message || 'Failed to load generated image preview',
    });
  }
};

exports.serveGeneratedMedia = async (req, res) => {
  try {
    const filePath = resolveGeneratedMediaPath(req.params.fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Media file not found' });
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('Generated media serve error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to load media file' });
  }
};

// Get User History
exports.getUserHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 10 } = req.query;

    let result;

    if (shouldUseMemoryStore()) {
      result = await memoryStore.getImagesByUserId(userId, page, limit);
    } else {
      const images = await Image.find({ userId })
        .sort({ generatedAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Image.countDocuments({ userId });

      result = {
        images,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
        currentPage: Number(page),
      };
    }

    res.json({
      images: result.images,
      total: result.total,
      pages: result.pages,
      currentPage: result.currentPage,
    });
  } catch (error) {
    console.error('History retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve history' });
  }
};

// Delete Image from History
exports.deleteImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    const userId = req.userId;

    const image = shouldUseMemoryStore()
      ? await memoryStore.findImageById(imageId)
      : await Image.findById(imageId);

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    if (image.userId.toString() !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (shouldUseMemoryStore()) {
      await memoryStore.deleteImageById(imageId);
    } else {
      await Image.findByIdAndDelete(imageId);
    }

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
};
