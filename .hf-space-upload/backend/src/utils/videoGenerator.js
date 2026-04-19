const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const axios = require('axios');
const { InferenceClient } = require('@huggingface/inference');
const { isImageDataUrl } = require('./imageValidation');

const GENERATED_MEDIA_DIR = path.join(__dirname, '..', '..', 'generated-media');
const DEFAULT_TEXT_TO_VIDEO_MODEL = process.env.TEXT_TO_VIDEO_MODEL || 'Wan-AI/Wan2.2-T2V-A14B';
const DEFAULT_IMAGE_TO_VIDEO_MODEL = process.env.IMAGE_TO_VIDEO_MODEL || 'Wan-AI/Wan2.2-I2V-A14B';
const DEFAULT_VIDEO_PROVIDER = process.env.HUGGING_FACE_VIDEO_PROVIDER || 'fal-ai';
const DEFAULT_VIDEO_BACKEND = String(process.env.VIDEO_GENERATION_BACKEND || 'auto').trim().toLowerCase();
const VIDEO_ACCESS_TOKEN = String(
  process.env.HUGGING_FACE_VIDEO_API_KEY ||
    process.env.VIDEO_INFERENCE_API_KEY ||
    process.env.HUGGING_FACE_API_KEY ||
    ''
).trim();
const PIAPI_ACCESS_TOKEN = String(
  process.env.PIAPI_API_KEY ||
    process.env.PI_API_KEY ||
    ''
).trim();
const PIAPI_BASE_URL = String(process.env.PIAPI_BASE_URL || 'https://api.piapi.ai')
  .trim()
  .replace(/\/$/, '');
const PIAPI_VIDEO_MODEL = process.env.PIAPI_VIDEO_MODEL || 'Qubico/wanx';
const PIAPI_TEXT_TO_VIDEO_TASK_TYPE = process.env.PIAPI_TEXT_TO_VIDEO_TASK_TYPE || 'wan22-txt2video-14b';
const PIAPI_IMAGE_TO_VIDEO_TASK_TYPE = process.env.PIAPI_IMAGE_TO_VIDEO_TASK_TYPE || 'wan22-img2video-14b';
const PIAPI_DEFAULT_ASPECT_RATIO = process.env.PIAPI_VIDEO_ASPECT_RATIO || '16:9';
const PIAPI_POLL_INTERVAL_MS = Math.max(2000, Number(process.env.PIAPI_POLL_INTERVAL_MS) || 5000);
const PIAPI_MAX_POLL_ATTEMPTS = Math.max(24, Number(process.env.PIAPI_MAX_POLL_ATTEMPTS) || 90);
const MIME_TYPE_TO_EXTENSION = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-m4v': 'm4v',
};
const ALLOWED_MEDIA_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v']);
const SUPPORTED_VIDEO_BACKENDS = new Set(['auto', 'huggingface', 'piapi']);
const FALLBACK_TEXT_TO_VIDEO_MODELS = [
  DEFAULT_TEXT_TO_VIDEO_MODEL,
  'Wan-AI/Wan2.2-T2V-A14B',
  'Wan-AI/Wan2.2-TI2V-5B',
  'Wan-AI/Wan2.1',
];
const FALLBACK_IMAGE_TO_VIDEO_MODELS = [
  DEFAULT_IMAGE_TO_VIDEO_MODEL,
  'Wan-AI/Wan2.2-I2V-A14B',
  'Wan-AI/Wan2.2-TI2V-5B',
  'Wan-AI/Wan2.1-I2V-14B-720P',
];

const ensureGeneratedMediaDir = () => {
  fs.mkdirSync(GENERATED_MEDIA_DIR, { recursive: true });
};

const createConfigurationError = (message) => {
  const error = new Error(message);
  error.status = 503;
  return error;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const uniqueValues = (values = []) => [...new Set(values.filter(Boolean))];

const getVideoBackend = () =>
  SUPPORTED_VIDEO_BACKENDS.has(DEFAULT_VIDEO_BACKEND) ? DEFAULT_VIDEO_BACKEND : 'auto';

const getInferenceClient = () => {
  if (!VIDEO_ACCESS_TOKEN) {
    throw createConfigurationError(
      'Video generation requires HUGGING_FACE_VIDEO_API_KEY or HUGGING_FACE_API_KEY in backend/.env.'
    );
  }

  return new InferenceClient(VIDEO_ACCESS_TOKEN);
};

const getPiApiHeaders = () => {
  if (!PIAPI_ACCESS_TOKEN) {
    throw createConfigurationError(
      'Video generation requires PIAPI_API_KEY when VIDEO_GENERATION_BACKEND=piapi or when using PiAPI fallback.'
    );
  }

  return {
    'x-api-key': PIAPI_ACCESS_TOKEN,
    'Content-Type': 'application/json',
  };
};

const buildTaskArgs = (baseArgs, model) => {
  const taskArgs = {
    ...baseArgs,
    model,
  };

  if (DEFAULT_VIDEO_PROVIDER) {
    taskArgs.provider = DEFAULT_VIDEO_PROVIDER;
  }

  return taskArgs;
};

const dataUrlToBlob = (value) => {
  if (!isImageDataUrl(value)) {
    throw new Error('Please upload a valid image file');
  }

  const [metadata = '', base64Payload = ''] = String(value).split(',', 2);
  const mimeType = metadata.match(/^data:([^;]+);base64$/i)?.[1] || 'image/png';
  return new Blob([Buffer.from(base64Payload, 'base64')], { type: mimeType });
};

const getNormalizedErrorMessage = (error) => String(error?.message || error || '');

const normalizeVideoError = (error, taskLabel) => {
  const message = getNormalizedErrorMessage(error);

  if (/monthly included credits|purchase pre-paid credits|subscribe to pro/i.test(message)) {
    const normalizedError = new Error(
      'Video generation is blocked because this account has no video inference credits left. Add Hugging Face credits, or configure PIAPI_API_KEY in backend/.env so the app can fall back to PiAPI Wan 2.2 generation.'
    );
    normalizedError.status = 402;
    return normalizedError;
  }

  if (/not supported for task/i.test(message)) {
    const normalizedError = new Error(
      `${taskLabel} is misconfigured for the current provider. Update TEXT_TO_VIDEO_MODEL, IMAGE_TO_VIDEO_MODEL, or HUGGING_FACE_VIDEO_PROVIDER in backend/.env.`
    );
    normalizedError.status = 503;
    return normalizedError;
  }

  if (/provider is 'auto'|specifying a model is required/i.test(message)) {
    const normalizedError = new Error(
      'Video generation is missing a compatible model configuration. Set TEXT_TO_VIDEO_MODEL or IMAGE_TO_VIDEO_MODEL in backend/.env.'
    );
    normalizedError.status = 503;
    return normalizedError;
  }

  if (/invalid username or password|authentication/i.test(message)) {
    const normalizedError = new Error(
      'Video generation authentication failed. Check HUGGING_FACE_VIDEO_API_KEY, HUGGING_FACE_API_KEY, or PIAPI_API_KEY in backend/.env.'
    );
    normalizedError.status = 401;
    return normalizedError;
  }

  return error;
};

const isRetryableHuggingFaceModelError = (error) => {
  const message = getNormalizedErrorMessage(error);
  return /not supported for task|provider is 'auto'|specifying a model is required|missing a compatible model configuration/i.test(
    message
  );
};

const shouldFallbackToPiApi = (error) => {
  if (!PIAPI_ACCESS_TOKEN) {
    return false;
  }

  const message = getNormalizedErrorMessage(error);
  return (
    error?.status === 401 ||
    error?.status === 402 ||
    error?.status === 503 ||
    /no video inference credits|authentication failed|requires HUGGING_FACE_VIDEO_API_KEY|requires HUGGING_FACE_API_KEY/i.test(
      message
    )
  );
};

const getFileExtension = (contentType = '') =>
  MIME_TYPE_TO_EXTENSION[String(contentType).split(';')[0].trim().toLowerCase()] || 'mp4';

const saveGeneratedVideoBuffer = async (buffer, contentType = 'video/mp4', prefix = 'video') => {
  ensureGeneratedMediaDir();

  const normalizedContentType = String(contentType || 'video/mp4');
  const extension = getFileExtension(normalizedContentType);
  const fileName = `${prefix}-${Date.now()}-${randomUUID()}.${extension}`;
  const filePath = path.join(GENERATED_MEDIA_DIR, fileName);

  fs.writeFileSync(filePath, Buffer.from(buffer));

  return {
    fileName,
    relativePath: `/api/image/media/${encodeURIComponent(fileName)}`,
    contentType: normalizedContentType,
  };
};

const saveGeneratedVideo = async (blob, prefix = 'video') => {
  const contentType = String(blob?.type || 'video/mp4');
  const arrayBuffer = await blob.arrayBuffer();
  return saveGeneratedVideoBuffer(Buffer.from(arrayBuffer), contentType, prefix);
};

const saveGeneratedRemoteVideo = async (videoUrl, prefix = 'video') => {
  const response = await axios.get(videoUrl, {
    responseType: 'arraybuffer',
    timeout: 180000,
    maxRedirects: 5,
  });

  const contentType = String(response.headers['content-type'] || 'video/mp4')
    .split(';')[0]
    .trim();

  return saveGeneratedVideoBuffer(Buffer.from(response.data), contentType, prefix);
};

const createPiApiTask = async (payload) => {
  const response = await axios.post(`${PIAPI_BASE_URL}/api/v1/task`, payload, {
    headers: getPiApiHeaders(),
    timeout: 60000,
  });

  const taskData = response.data?.data || response.data;
  const taskId = taskData?.task_id;

  if (!taskId) {
    throw new Error('PiAPI returned an invalid task response');
  }

  return taskId;
};

const getPiApiTask = async (taskId) => {
  const response = await axios.get(`${PIAPI_BASE_URL}/api/v1/task/${encodeURIComponent(taskId)}`, {
    headers: getPiApiHeaders(),
    timeout: 60000,
  });

  return response.data?.data || response.data;
};

const extractPiApiVideoUrl = (taskData) =>
  taskData?.output?.video_url ||
  taskData?.output?.video?.url ||
  taskData?.output?.url ||
  '';

const pollPiApiTask = async (taskId) => {
  for (let attempt = 0; attempt < PIAPI_MAX_POLL_ATTEMPTS; attempt += 1) {
    const taskData = await getPiApiTask(taskId);
    const status = String(taskData?.status || '').toLowerCase();

    if (['completed', 'success', 'succeeded'].includes(status)) {
      return taskData;
    }

    if (['failed', 'error', 'canceled', 'cancelled'].includes(status)) {
      const errorMessage =
        taskData?.error?.message ||
        taskData?.error?.raw_message ||
        'PiAPI video generation failed';
      const error = new Error(errorMessage);
      error.status = 502;
      throw error;
    }

    await sleep(PIAPI_POLL_INTERVAL_MS);
  }

  const error = new Error('PiAPI video generation timed out while waiting for completion');
  error.status = 504;
  throw error;
};

const generateWithHuggingFaceModels = async (taskLabel, models, generator) => {
  let lastError = null;

  for (const model of uniqueValues(models)) {
    try {
      return await generator(model);
    } catch (error) {
      const normalizedError = normalizeVideoError(error, taskLabel);

      if (!isRetryableHuggingFaceModelError(normalizedError)) {
        throw normalizedError;
      }

      lastError = normalizedError;
    }
  }

  throw lastError || new Error(`${taskLabel} failed`);
};

const generateTextToVideoWithHuggingFace = async (prompt) => {
  const client = getInferenceClient();

  return generateWithHuggingFaceModels('Text to video', FALLBACK_TEXT_TO_VIDEO_MODELS, async (model) => {
    const videoBlob = await client.textToVideo(
      buildTaskArgs(
        {
          inputs: prompt,
        },
        model
      )
    );

    return saveGeneratedVideo(videoBlob, 'text-to-video');
  });
};

const generateImageToVideoWithHuggingFace = async ({ sourceImage, prompt = '' }) => {
  const client = getInferenceClient();
  const baseTaskArgs = {
    inputs: dataUrlToBlob(sourceImage),
  };

  if (prompt.trim()) {
    baseTaskArgs.parameters = {
      prompt: prompt.trim(),
    };
  }

  return generateWithHuggingFaceModels('Image to video', FALLBACK_IMAGE_TO_VIDEO_MODELS, async (model) => {
    const videoBlob = await client.imageToVideo(buildTaskArgs(baseTaskArgs, model));
    return saveGeneratedVideo(videoBlob, 'image-to-video');
  });
};

const generateTextToVideoWithPiApi = async (prompt) => {
  const taskId = await createPiApiTask({
    model: PIAPI_VIDEO_MODEL,
    task_type: PIAPI_TEXT_TO_VIDEO_TASK_TYPE,
    input: {
      prompt,
      negative_prompt: '',
      aspect_ratio: PIAPI_DEFAULT_ASPECT_RATIO,
    },
    config: {
      webhook_config: {
        endpoint: '',
        secret: '',
      },
    },
  });

  const taskData = await pollPiApiTask(taskId);
  const videoUrl = extractPiApiVideoUrl(taskData);

  if (!videoUrl) {
    throw new Error('PiAPI returned an invalid video response');
  }

  return saveGeneratedRemoteVideo(videoUrl, 'text-to-video');
};

const generateImageToVideoWithPiApi = async ({ sourceImage, prompt = '' }) => {
  const taskId = await createPiApiTask({
    model: PIAPI_VIDEO_MODEL,
    task_type: PIAPI_IMAGE_TO_VIDEO_TASK_TYPE,
    input: {
      prompt: prompt.trim() || 'Animate this image with realistic cinematic motion',
      negative_prompt: '',
      image: sourceImage,
    },
    config: {
      webhook_config: {
        endpoint: '',
        secret: '',
      },
    },
  });

  const taskData = await pollPiApiTask(taskId);
  const videoUrl = extractPiApiVideoUrl(taskData);

  if (!videoUrl) {
    throw new Error('PiAPI returned an invalid video response');
  }

  return saveGeneratedRemoteVideo(videoUrl, 'image-to-video');
};

const generateTextToVideo = async (prompt) => {
  const backend = getVideoBackend();

  try {
    if (backend === 'piapi') {
      return await generateTextToVideoWithPiApi(prompt);
    }

    if (backend === 'huggingface') {
      return await generateTextToVideoWithHuggingFace(prompt);
    }

    if (!VIDEO_ACCESS_TOKEN && PIAPI_ACCESS_TOKEN) {
      return await generateTextToVideoWithPiApi(prompt);
    }

    try {
      return await generateTextToVideoWithHuggingFace(prompt);
    } catch (error) {
      if (shouldFallbackToPiApi(error)) {
        return await generateTextToVideoWithPiApi(prompt);
      }

      throw error;
    }
  } catch (error) {
    throw normalizeVideoError(error, 'Text to video');
  }
};

const generateImageToVideo = async ({ sourceImage, prompt = '' }) => {
  const backend = getVideoBackend();

  try {
    if (backend === 'piapi') {
      return await generateImageToVideoWithPiApi({ sourceImage, prompt });
    }

    if (backend === 'huggingface') {
      return await generateImageToVideoWithHuggingFace({ sourceImage, prompt });
    }

    if (!VIDEO_ACCESS_TOKEN && PIAPI_ACCESS_TOKEN) {
      return await generateImageToVideoWithPiApi({ sourceImage, prompt });
    }

    try {
      return await generateImageToVideoWithHuggingFace({ sourceImage, prompt });
    } catch (error) {
      if (shouldFallbackToPiApi(error)) {
        return await generateImageToVideoWithPiApi({ sourceImage, prompt });
      }

      throw error;
    }
  } catch (error) {
    throw normalizeVideoError(error, 'Image to video');
  }
};

const resolveGeneratedMediaPath = (fileName) => {
  const safeFileName = path.basename(String(fileName || ''));
  const extension = path.extname(safeFileName).toLowerCase();

  if (!safeFileName || !ALLOWED_MEDIA_EXTENSIONS.has(extension)) {
    const error = new Error('Media file not found');
    error.status = 404;
    throw error;
  }

  return path.join(GENERATED_MEDIA_DIR, safeFileName);
};

const getVideoGenerationStatus = () => {
  const backend = getVideoBackend();
  const hasHuggingFace = Boolean(VIDEO_ACCESS_TOKEN);
  const hasPiApi = Boolean(PIAPI_ACCESS_TOKEN);

  if (backend === 'huggingface') {
    return {
      canGenerate: hasHuggingFace,
      level: hasHuggingFace ? 'warning' : 'error',
      selectedBackend: backend,
      provider: DEFAULT_VIDEO_PROVIDER,
      hasHuggingFace,
      hasPiApi,
      message: hasHuggingFace
        ? 'Video generation is using Hugging Face only. If requests fail because of missing video credits, add PIAPI_API_KEY in backend/.env and switch VIDEO_GENERATION_BACKEND to auto for fallback.'
        : 'Video generation is set to Hugging Face, but no Hugging Face video key is configured. Add HUGGING_FACE_VIDEO_API_KEY or HUGGING_FACE_API_KEY in backend/.env.',
    };
  }

  if (backend === 'piapi') {
    return {
      canGenerate: hasPiApi,
      level: hasPiApi ? 'ready' : 'error',
      selectedBackend: backend,
      provider: 'piapi',
      hasHuggingFace,
      hasPiApi,
      message: hasPiApi
        ? 'Video generation is using PiAPI.'
        : 'Video generation is set to PiAPI, but PIAPI_API_KEY is missing in backend/.env.',
    };
  }

  if (hasHuggingFace && hasPiApi) {
    return {
      canGenerate: true,
      level: 'ready',
      selectedBackend: backend,
      provider: DEFAULT_VIDEO_PROVIDER,
      hasHuggingFace,
      hasPiApi,
      message:
        'Video generation is configured with Hugging Face plus PiAPI fallback.',
    };
  }

  if (hasHuggingFace) {
    return {
      canGenerate: true,
      level: 'warning',
      selectedBackend: backend,
      provider: DEFAULT_VIDEO_PROVIDER,
      hasHuggingFace,
      hasPiApi,
      message:
        'Video generation currently depends on Hugging Face video credits. Add PIAPI_API_KEY in backend/.env for fallback if credits run out.',
    };
  }

  if (hasPiApi) {
    return {
      canGenerate: true,
      level: 'ready',
      selectedBackend: backend,
      provider: 'piapi',
      hasHuggingFace,
      hasPiApi,
      message: 'Video generation is configured through PiAPI.',
    };
  }

  return {
    canGenerate: false,
    level: 'error',
    selectedBackend: backend,
    provider: DEFAULT_VIDEO_PROVIDER,
    hasHuggingFace,
    hasPiApi,
    message:
      'Video generation is not configured. Add HUGGING_FACE_VIDEO_API_KEY, HUGGING_FACE_API_KEY, or PIAPI_API_KEY in backend/.env.',
  };
};

module.exports = {
  generateImageToVideo,
  getVideoGenerationStatus,
  generateTextToVideo,
  resolveGeneratedMediaPath,
};
