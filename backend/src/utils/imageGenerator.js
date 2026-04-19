const axios = require('axios');
const { randomInt } = require('crypto');

const DEFAULT_MODEL = 'stabilityai/stable-diffusion-3-medium-diffusers';
const DEFAULT_PROVIDER = 'hf-inference';
const DEFAULT_RATIO = '1:1';
const DEFAULT_QUALITY = 'balanced';
const PREVIEW_FETCH_TIMEOUT_MS = 45000;
const MAX_PREVIEW_FETCH_RETRIES = 2;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const ALLOWED_PREVIEW_HOSTNAMES = new Set(['image.pollinations.ai']);

const ASPECT_RATIO_PRESETS = {
  '1:1': { width: 1024, height: 1024, label: 'Square' },
  '16:9': { width: 1344, height: 768, label: 'Landscape' },
  '9:16': { width: 768, height: 1344, label: 'Portrait' },
  '4:3': { width: 1152, height: 896, label: 'Classic landscape' },
  '3:4': { width: 896, height: 1152, label: 'Classic portrait' },
};

const QUALITY_PRESETS = {
  fast: { label: 'Fast', numInferenceSteps: 12 },
  balanced: { label: 'Balanced', numInferenceSteps: 20 },
  high: { label: 'High', numInferenceSteps: 28 },
};

const normalizeGenerationOptions = (options = {}) => {
  const ratio = ASPECT_RATIO_PRESETS[options.ratio] ? options.ratio : DEFAULT_RATIO;
  const quality = QUALITY_PRESETS[options.quality] ? options.quality : DEFAULT_QUALITY;
  const ratioPreset = ASPECT_RATIO_PRESETS[ratio];
  const qualityPreset = QUALITY_PRESETS[quality];
  const normalizedSeed = Number.isInteger(options.seed) && options.seed > 0
    ? options.seed
    : randomInt(1, 2147483647);

  return {
    ratio,
    quality,
    seed: normalizedSeed,
    width: ratioPreset.width,
    height: ratioPreset.height,
    ratioLabel: ratioPreset.label,
    qualityLabel: qualityPreset.label,
    numInferenceSteps: qualityPreset.numInferenceSteps,
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildPollinationsUrl = (prompt, generationOptions) =>
  `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${Math.min(generationOptions.width, 1024)}&height=${Math.min(generationOptions.height, 1024)}&seed=${generationOptions.seed}&nologo=true`;

const buildImagePreviewPath = (sourceUrl) =>
  `/api/image/preview?source=${encodeURIComponent(sourceUrl)}`;

const isAllowedPreviewSource = (sourceUrl = '') => {
  try {
    const parsedUrl = new URL(sourceUrl);
    return (
      (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:') &&
      ALLOWED_PREVIEW_HOSTNAMES.has(parsedUrl.hostname)
    );
  } catch (error) {
    return false;
  }
};

const fetchImageBuffer = async (sourceUrl, attempt = 0) => {
  try {
    const response = await axios.get(sourceUrl, {
      responseType: 'arraybuffer',
      timeout: PREVIEW_FETCH_TIMEOUT_MS,
      validateStatus: (status) => status >= 200 && status < 300,
    });

    const contentType = String(response.headers['content-type'] || '').split(';')[0].trim() || 'image/jpeg';
    return {
      buffer: Buffer.from(response.data),
      contentType: contentType.startsWith('image/') ? contentType : 'image/jpeg',
    };
  } catch (error) {
    const status = error.response?.status;
    const shouldRetry = attempt < MAX_PREVIEW_FETCH_RETRIES && RETRYABLE_STATUS_CODES.has(status);

    if (shouldRetry) {
      await sleep((attempt + 1) * 1500);
      return fetchImageBuffer(sourceUrl, attempt + 1);
    }

    const previewError = new Error(
      status === 429
        ? 'Image provider is busy right now. Please try again in a few seconds.'
        : 'Could not load generated image preview.'
    );

    previewError.status = status || 502;
    throw previewError;
  }
};

const generateImageWithHuggingFace = async (prompt, options = {}) => {
  const generationOptions = normalizeGenerationOptions(options);
  return buildPollinationsUrl(prompt, generationOptions);
};

module.exports = {
  ASPECT_RATIO_PRESETS,
  DEFAULT_QUALITY,
  DEFAULT_RATIO,
  QUALITY_PRESETS,
  buildImagePreviewPath,
  fetchImageBuffer,
  generateImageWithHuggingFace,
  isAllowedPreviewSource,
  normalizeGenerationOptions,
};
