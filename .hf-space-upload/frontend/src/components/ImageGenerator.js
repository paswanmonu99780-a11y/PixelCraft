import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiUrl, getJson } from '../utils/api';
import { downloadAsset, resolveDownloadUrl } from '../utils/downloadAsset';
import {
  ASSISTANT_ACTION_EVENT_NAME,
  clearPendingAssistantAction,
  readPendingAssistantAction,
} from '../utils/assistantActions';
import '../styles/ImageGenerator.css';

const GENERATION_MODES = [
  {
    value: 'text-to-image',
    label: 'Text to Image',
    description: 'Create images from prompts.',
  },
  {
    value: 'text-to-video',
    label: 'Text to Video',
    description: 'Turn prompts into short videos.',
  },
  {
    value: 'image-to-video',
    label: 'Image to Video',
    description: 'Animate an uploaded image.',
  },
];

const RATIO_OPTIONS = [
  { value: '1:1', label: '1:1 Square' },
  { value: '16:9', label: '16:9 Landscape' },
  { value: '9:16', label: '9:16 Portrait' },
  { value: '4:3', label: '4:3 Classic' },
  { value: '3:4', label: '3:4 Portrait Classic' },
];

const QUALITY_OPTIONS = [
  { value: 'fast', label: 'Fast' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'high', label: 'High' },
];

const MAX_PROMPT_LENGTH = 2000;
const MAX_PREVIEW_RETRIES = 2;
const PREVIEW_RETRY_DELAY_MS = 1500;
const SETTINGS_STORAGE_KEY = 'image-generator-settings';

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not load the selected image'));
    reader.readAsDataURL(file);
  });

const findOptionLabel = (options, value) =>
  options.find((option) => option.value === value)?.label || value;

const findModeLabel = (mode) =>
  GENERATION_MODES.find((option) => option.value === mode)?.label || mode;

const isValidOption = (options, value) => options.some((option) => option.value === value);

const getStoredSetting = (settingKey, fallbackValue, options) => {
  if (typeof window === 'undefined') {
    return fallbackValue;
  }

  try {
    const storedSettings = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
    const storedValue = storedSettings[settingKey];
    return isValidOption(options, storedValue) ? storedValue : fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
};

const isDataUrl = (assetUrl = '') => assetUrl.startsWith('data:');
const isRemoteUrl = (assetUrl = '') => /^https?:\/\//i.test(assetUrl);
const isProxyPreviewUrl = (assetUrl = '') => assetUrl.includes('/api/image/preview?');

const getResolvedAssetUrl = (assetUrl = '') => {
  if (!assetUrl || isDataUrl(assetUrl) || isRemoteUrl(assetUrl)) {
    return assetUrl;
  }

  return apiUrl(assetUrl.startsWith('/') ? assetUrl : `/${assetUrl}`);
};

const getResolvedImageUrl = (imageUrl = '') => {
  if (!imageUrl || isDataUrl(imageUrl)) {
    return imageUrl;
  }

  if (isProxyPreviewUrl(imageUrl)) {
    return isRemoteUrl(imageUrl) ? imageUrl : apiUrl(imageUrl);
  }

  if (isRemoteUrl(imageUrl)) {
    return apiUrl(`/api/image/preview?source=${encodeURIComponent(imageUrl)}`);
  }

  return apiUrl(imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`);
};

const canRetryPreview = (imageUrl = '') => Boolean(imageUrl) && !isDataUrl(imageUrl);

const getPreviewUrl = (imageUrl = '', retryCount = 0) => {
  const resolvedImageUrl = getResolvedImageUrl(imageUrl);

  if (!resolvedImageUrl || isDataUrl(resolvedImageUrl)) {
    return resolvedImageUrl;
  }

  try {
    const url = new URL(resolvedImageUrl, window.location.origin);
    url.searchParams.set('previewAttempt', String(retryCount));
    return url.toString();
  } catch (error) {
    const separator = resolvedImageUrl.includes('?') ? '&' : '?';
    return `${resolvedImageUrl}${separator}previewAttempt=${retryCount}`;
  }
};

const getFileExtension = (assetUrl = '', assetType = 'image') => {
  if (assetType === 'video') {
    if (assetUrl.includes('.webm') || assetUrl.includes('video/webm')) return 'webm';
    if (assetUrl.includes('.mov') || assetUrl.includes('video/quicktime')) return 'mov';
    if (assetUrl.includes('.m4v') || assetUrl.includes('video/x-m4v')) return 'm4v';
    return 'mp4';
  }

  if (assetUrl.includes('image/svg+xml')) return 'svg';
  if (assetUrl.includes('image/png')) return 'png';
  if (assetUrl.includes('image/webp')) return 'webp';
  return 'jpg';
};

const getPromptPlaceholder = (mode) => {
  if (mode === 'text-to-video') {
    return 'Describe the video you want to create... (e.g., a neon cyberpunk street with camera motion)';
  }

  if (mode === 'image-to-video') {
    return 'Optional: describe how the image should animate...';
  }

  return 'Describe the image you want to create... (e.g., a futuristic city at sunset)';
};

const getGenerateButtonLabel = (mode, loading) => {
  if (loading) {
    if (mode === 'text-to-image') return 'Generating Image...';
    return 'Generating Video...';
  }

  if (mode === 'text-to-video') return 'Generate Video';
  if (mode === 'image-to-video') return 'Animate Image';
  return 'Generate Image';
};

const ImageGenerator = () => {
  const [mode, setMode] = useState('text-to-image');
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState(() => getStoredSetting('ratio', '1:1', RATIO_OPTIONS));
  const [quality, setQuality] = useState(() => getStoredSetting('quality', 'balanced', QUALITY_OPTIONS));
  const [sourceImage, setSourceImage] = useState('');
  const [sourceImageName, setSourceImageName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [imgStatus, setImgStatus] = useState('idle');
  const [previewRetryCount, setPreviewRetryCount] = useState(0);
  const [error, setError] = useState('');
  const [videoStatus, setVideoStatus] = useState(null);
  const [videoStatusLoading, setVideoStatusLoading] = useState(false);
  const [publishMessage, setPublishMessage] = useState('');
  const [publishing, setPublishing] = useState(false);
  const { token, user, setUser } = useAuth();
  const previewRetryTimeoutRef = useRef(null);
  const lastAssistantActionIdRef = useRef('');

  useEffect(() => () => {
    if (previewRetryTimeoutRef.current) {
      window.clearTimeout(previewRetryTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ ratio, quality })
    );
  }, [ratio, quality]);

  useEffect(() => {
    if (previewRetryTimeoutRef.current) {
      window.clearTimeout(previewRetryTimeoutRef.current);
    }

    setPreviewRetryCount(0);
    setImgStatus(result?.assetType === 'image' ? 'loading' : 'idle');
  }, [result?.id, result?.assetType]);

  useEffect(() => {
    setError('');
    setPublishMessage('');
    setResult(null);
    setPublishing(false);
    setVideoStatus(null);
    setVideoStatusLoading(false);

    if (mode !== 'image-to-video') {
      setSourceImage('');
      setSourceImageName('');
    }
  }, [mode]);

  useEffect(() => {
    let isCancelled = false;

    if (mode === 'text-to-image' || !token) {
      setVideoStatus(null);
      setVideoStatusLoading(false);
      return undefined;
    }

    const loadVideoStatus = async () => {
      setVideoStatusLoading(true);

      try {
        const data = await getJson('/api/image/video-status', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!isCancelled) {
          setVideoStatus(data.video || null);
        }
      } catch (err) {
        if (!isCancelled) {
          setVideoStatus({
            canGenerate: true,
            level: 'warning',
            message: err.message || 'Could not load video setup details.',
          });
        }
      } finally {
        if (!isCancelled) {
          setVideoStatusLoading(false);
        }
      }
    };

    loadVideoStatus();

    return () => {
      isCancelled = true;
    };
  }, [mode, token]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const applyAssistantAction = async (action) => {
      if (!action?.id || action.id === lastAssistantActionIdRef.current) {
        return;
      }

      if (action.type !== 'generate-image' && action.type !== 'generate-video') {
        return;
      }

      lastAssistantActionIdRef.current = action.id;
      const nextMode = action.type === 'generate-video' ? 'text-to-video' : 'text-to-image';
      const nextPrompt = action.prompt || '';

      setMode(nextMode);
      setPrompt(nextPrompt);
      setError('');
      setPublishMessage('');

      if (action.ratio && isValidOption(RATIO_OPTIONS, action.ratio)) {
        setRatio(action.ratio);
      }

      if (action.quality && isValidOption(QUALITY_OPTIONS, action.quality)) {
        setQuality(action.quality);
      }

      if (!action.autoRun || !nextPrompt) {
        clearPendingAssistantAction(action.id);
        return;
      }

      setLoading(true);
      setImgStatus(nextMode === 'text-to-image' ? 'loading' : 'idle');

      try {
        if (nextMode === 'text-to-video') {
          await generateTextToVideo(nextPrompt);
        } else {
          await generateImage(nextPrompt, {
            ratio: isValidOption(RATIO_OPTIONS, action.ratio) ? action.ratio : ratio,
            quality: isValidOption(QUALITY_OPTIONS, action.quality) ? action.quality : quality,
          });
        }
      } catch (err) {
        setError(err.message || 'Generation failed');
        setImgStatus('error');
      } finally {
        setLoading(false);
      }

      clearPendingAssistantAction(action.id);
    };

    void applyAssistantAction(readPendingAssistantAction());

    const handleAssistantAction = (event) => {
      void applyAssistantAction(event.detail);
    };

    window.addEventListener(ASSISTANT_ACTION_EVENT_NAME, handleAssistantAction);

    return () => {
      window.removeEventListener(ASSISTANT_ACTION_EVENT_NAME, handleAssistantAction);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality, ratio, token]);

  const generateImage = async (promptText, options = { ratio, quality }) => {
    const data = await getJson('/api/image/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        prompt: promptText,
        ratio: options.ratio,
        quality: options.quality,
      }),
    });

    if (!data?.image?.imageUrl) {
      throw new Error('Image service returned an invalid response');
    }

    if (data.currentUser) {
      setUser(data.currentUser);
    }

    setResult({
      id: data.image.id || Date.now(),
      assetType: 'image',
      generationMode: 'text-to-image',
      prompt: data.image.prompt || promptText,
      assetUrl: data.image.imageUrl,
      ratio: data.image.ratio || options.ratio,
      quality: data.image.quality || options.quality,
      generatedAt: data.image.generatedAt || new Date().toISOString(),
    });
  };

  const generateTextToVideo = async (promptText) => {
    const data = await getJson('/api/image/generate-video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        prompt: promptText,
      }),
    });

    if (!data?.video?.videoUrl) {
      throw new Error('Video service returned an invalid response');
    }

    setResult({
      id: data.video.id || Date.now(),
      assetType: 'video',
      generationMode: 'text-to-video',
      prompt: data.video.prompt || promptText,
      assetUrl: data.video.videoUrl,
      generatedAt: data.video.generatedAt || new Date().toISOString(),
    });
  };

  const animateImage = async (promptText, imageDataUrl, imageName) => {
    const data = await getJson('/api/image/animate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        prompt: promptText,
        sourceImage: imageDataUrl,
      }),
    });

    if (!data?.video?.videoUrl) {
      throw new Error('Video service returned an invalid response');
    }

    setResult({
      id: data.video.id || Date.now(),
      assetType: 'video',
      generationMode: 'image-to-video',
      prompt: data.video.prompt || promptText,
      assetUrl: data.video.videoUrl,
      generatedAt: data.video.generatedAt || new Date().toISOString(),
      sourceImagePreview: imageDataUrl,
      sourceImageName: imageName,
    });
  };

  const runGenerationRequest = async ({
    nextMode = mode,
    promptText = prompt.trim(),
    nextRatio = ratio,
    nextQuality = quality,
    imageDataUrl = sourceImage,
    imageName = sourceImageName,
    clearPromptAfter = true,
  } = {}) => {
    if (!token) {
      setError('Session expired. Please log in again.');
      return false;
    }

    const trimmedPrompt = promptText.trim();

    if (nextMode !== 'image-to-video' && !trimmedPrompt) {
      setError('Please enter a prompt');
      return false;
    }

    if (nextMode === 'image-to-video' && !imageDataUrl) {
      setError('Please upload a source image first');
      return false;
    }

    setLoading(true);
    setError('');
    setPublishMessage('');
    setImgStatus(nextMode === 'text-to-image' ? 'loading' : 'idle');

    try {
      if (nextMode === 'text-to-video') {
        await generateTextToVideo(trimmedPrompt);
      } else if (nextMode === 'image-to-video') {
        await animateImage(trimmedPrompt, imageDataUrl, imageName);
      } else {
        await generateImage(trimmedPrompt, {
          ratio: nextRatio,
          quality: nextQuality,
        });
      }

      if (clearPromptAfter && nextMode !== 'image-to-video') {
        setPrompt('');
      }

      return true;
    } catch (err) {
      setError(err.message || 'Generation failed');
      setImgStatus('error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    await runGenerationRequest();
  };

  const handleSourceImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setSourceImage(dataUrl);
      setSourceImageName(file.name);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load the selected image');
    }
  };

  const handleDownloadAsset = () => {
    if (!result) return;

    downloadAsset({
      assetUrl: result.assetUrl,
      assetType: result.assetType,
      fileName: `${result.generationMode}-${Date.now()}.${getFileExtension(result.assetUrl, result.assetType)}`,
    }).catch((err) => {
      setError(err.message || 'Download failed');
    });
  };

  const handleCopyLink = async () => {
    if (!result) return;

    try {
      const resolvedUrl = result.assetType === 'image'
        ? resolveDownloadUrl(result.assetUrl, 'image')
        : resolveDownloadUrl(result.assetUrl, result.assetType);
      await navigator.clipboard.writeText(resolvedUrl);
      alert(`${result.assetType === 'image' ? 'Image' : 'Video'} link copied to clipboard!`);
    } catch (err) {
      setError(`Could not copy the ${result?.assetType || 'asset'} link`);
    }
  };

  const handleRegenerate = async () => {
    if (!result || !token) return;

    setLoading(true);
    setError('');
    setPublishMessage('');

    try {
      if (result.generationMode === 'text-to-video') {
        await generateTextToVideo(result.prompt);
      } else if (result.generationMode === 'image-to-video') {
        await animateImage(
          result.prompt || '',
          result.sourceImagePreview || sourceImage,
          result.sourceImageName || sourceImageName
        );
      } else {
        await generateImage(result.prompt, {
          ratio: result.ratio || ratio,
          quality: result.quality || quality,
        });
      }
    } catch (err) {
      setError(err.message || 'Could not regenerate the asset');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishToExplore = async () => {
    if (!result || result.assetType !== 'image' || !token) return;

    setPublishing(true);
    setPublishMessage('');

    try {
      const data = await getJson('/api/gallery/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: (result.prompt || 'Generated image').slice(0, 120),
          description: result.prompt || '',
          prompt: result.prompt || '',
          imageUrl: result.assetUrl,
          source: 'generated',
        }),
      });

      if (data.currentUser) {
        setUser(data.currentUser);
      }

      setPublishMessage(data.message || 'Image published to Explore!');
    } catch (err) {
      setPublishMessage(err.message || 'Could not publish image');
    } finally {
      setPublishing(false);
    }
  };

  const isTextToImageMode = mode === 'text-to-image';
  const isImageToVideoMode = mode === 'image-to-video';
  const videoGenerationBlocked =
    !isTextToImageMode && !videoStatusLoading && videoStatus?.canGenerate === false;
  const videoStatusToneClass = videoStatusLoading
    ? 'is-loading'
    : videoStatus?.level === 'error'
      ? 'is-error'
      : videoStatus?.level === 'warning'
        ? 'is-warning'
        : 'is-ready';

  return (
    <div className="image-generator">
      <div className="generator-form">
        <div className="studio-intro">
          <div className="studio-intro-copy">
            <p className="studio-kicker">Create Media</p>
            <h2>Design stills, motion concepts, and publish-ready visuals</h2>
            <p className="studio-subtitle">
              Switch between image and video modes, fine-tune the output, and keep your best results ready for download or sharing.
            </p>
          </div>
          <div className="studio-pulse-board" aria-hidden="true">
            <span>Image</span>
            <span>Motion</span>
            <span>Export</span>
          </div>
        </div>

        <div className="token-banner">
          <strong>{user?.tokenBalance ?? 0} tokens available</strong>
          <span>Text-to-image ke liye 1 token use hota hai. Signup bonus 50 tokens milte hain.</span>
        </div>

        <div className="mode-selector" aria-label="Generation mode">
          {GENERATION_MODES.map((modeOption) => (
            <button
              key={modeOption.value}
              type="button"
              className={`mode-card ${mode === modeOption.value ? 'active' : ''}`}
              onClick={() => setMode(modeOption.value)}
              aria-pressed={mode === modeOption.value}
            >
              <strong>{modeOption.label}</strong>
              <span>{modeOption.description}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleGenerate}>
          {isImageToVideoMode && (
            <div className="source-upload-section">
              <label className="source-upload-box">
                <span>Upload Source Image</span>
                <input type="file" accept="image/*" onChange={handleSourceImageChange} disabled={loading} />
              </label>

              {sourceImage && (
                <div className="source-preview">
                  <img src={sourceImage} alt={sourceImageName || 'Source preview'} />
                  <div>
                    <strong>{sourceImageName || 'Source image selected'}</strong>
                    <p>This image will be animated into a short video.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="input-group">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={getPromptPlaceholder(mode)}
              maxLength={MAX_PROMPT_LENGTH}
              rows={4}
              disabled={loading}
            />
            <div className="char-count">
              {prompt.length}/{MAX_PROMPT_LENGTH}
            </div>
          </div>

          <p className="input-helper">
            {isTextToImageMode
              ? 'Text to Image is ready to use now.'
              : 'Video modes use the backend video inference configuration. For the best chance of success, set backend/.env with HUGGING_FACE_VIDEO_API_KEY or PIAPI_API_KEY. The backend now auto-falls back between supported Wan video providers.'}
          </p>

          {!isTextToImageMode && (
            <div className={`video-status-banner ${videoStatusToneClass}`}>
              <strong>{videoStatusLoading ? 'Checking video setup...' : 'Video Setup Status'}</strong>
              <span>
                {videoStatusLoading
                  ? 'Reading backend video configuration for this environment.'
                  : videoStatus?.message || 'Video setup details are unavailable right now.'}
              </span>
              {!videoStatusLoading && videoStatus && (
                <small className="video-status-meta">
                  Backend: {videoStatus.selectedBackend || 'auto'}
                  {videoStatus.provider ? ` | Provider: ${videoStatus.provider}` : ''}
                </small>
              )}
            </div>
          )}

          {isTextToImageMode && (
            <div className="generator-controls">
              <div className="control-group">
                <label htmlFor="ratio-select">Aspect Ratio</label>
                <select
                  id="ratio-select"
                  value={ratio}
                  onChange={(e) => setRatio(e.target.value)}
                  disabled={loading}
                >
                  {RATIO_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="control-group">
                <label htmlFor="quality-select">Quality</label>
                <select
                  id="quality-select"
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  disabled={loading}
                >
                  {QUALITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="generate-btn"
            disabled={
              loading ||
              (!prompt.trim() && !isImageToVideoMode) ||
              (isImageToVideoMode && !sourceImage) ||
              videoGenerationBlocked
            }
          >
            {loading ? (
              <>
                <span className="spinner"></span> {getGenerateButtonLabel(mode, true)}
              </>
            ) : (
              getGenerateButtonLabel(mode, false)
            )}
          </button>
        </form>
      </div>

      {loading && (
        <div className="skeleton-loader">
          <div className="skeleton-image"></div>
        </div>
      )}

      {result && !loading && (
        <div className="image-preview">
          {result.assetType === 'image' ? (
            <>
              <img
                key={result.id}
                src={getPreviewUrl(result.assetUrl, previewRetryCount)}
                alt={result.prompt}
                onLoad={() => {
                  if (previewRetryTimeoutRef.current) {
                    window.clearTimeout(previewRetryTimeoutRef.current);
                  }
                  setImgStatus('loaded');
                }}
                onError={() => {
                  if (previewRetryTimeoutRef.current) {
                    window.clearTimeout(previewRetryTimeoutRef.current);
                  }

                  if (canRetryPreview(result.assetUrl) && previewRetryCount < MAX_PREVIEW_RETRIES) {
                    const nextRetryCount = previewRetryCount + 1;
                    setImgStatus('loading');
                    setError(`Preview is taking longer than usual. Retrying (${nextRetryCount}/${MAX_PREVIEW_RETRIES})...`);
                    previewRetryTimeoutRef.current = window.setTimeout(() => {
                      setPreviewRetryCount(nextRetryCount);
                    }, PREVIEW_RETRY_DELAY_MS);
                    return;
                  }

                  setImgStatus('error');
                  setError('Generated image preview could not be loaded. Please try a shorter prompt or regenerate.');
                }}
                style={{ border: imgStatus === 'error' ? '2px solid red' : undefined }}
              />
              {imgStatus === 'loading' && (
                <div className="prompt-label">Loading image preview...</div>
              )}
              {imgStatus === 'error' && (
                <div className="error-message">
                  Failed to load image preview.
                </div>
              )}
            </>
          ) : (
            <video
              key={result.id}
              className="generated-video"
              src={getResolvedAssetUrl(result.assetUrl)}
              controls
              playsInline
            />
          )}

          {result.generationMode === 'image-to-video' && result.sourceImagePreview && (
            <div className="source-preview result-source-preview">
              <img src={result.sourceImagePreview} alt={result.sourceImageName || 'Source image'} />
              <div>
                <strong>{result.sourceImageName || 'Source image'}</strong>
                <p>Animated into the video above.</p>
              </div>
            </div>
          )}

          <div className="image-info">
            <div className="image-meta">
              <span className="meta-pill">
                Mode: {findModeLabel(result.generationMode)}
              </span>
              {result.assetType === 'image' && (
                <>
                  <span className="meta-pill">
                    Ratio: {findOptionLabel(RATIO_OPTIONS, result.ratio)}
                  </span>
                  <span className="meta-pill">
                    Quality: {findOptionLabel(QUALITY_OPTIONS, result.quality)}
                  </span>
                </>
              )}
            </div>

            {result.prompt ? (
              <>
                <p className="prompt-label">Prompt:</p>
                <p className="prompt-text">{result.prompt}</p>
              </>
            ) : (
              <p className="generator-note">No animation prompt was provided for this image-to-video generation.</p>
            )}

            {result.assetType === 'video' && (
              <p className="generator-note">
                Video outputs can be downloaded or shared by link. Explore and history remain image-only for now.
              </p>
            )}

            <div className="image-actions">
              <button type="button" onClick={handleDownloadAsset} className="action-btn">
                Download
              </button>
              <button type="button" onClick={handleCopyLink} className="action-btn">
                Copy Link
              </button>
              <button type="button" onClick={handleRegenerate} className="action-btn">
                Regenerate
              </button>
              {result.assetType === 'image' && (
                <button
                  type="button"
                  onClick={handlePublishToExplore}
                  className="action-btn"
                  disabled={publishing}
                >
                  {publishing ? 'Publishing...' : 'Publish to Explore'}
                </button>
              )}
            </div>
            {publishMessage && <div className="success-message">{publishMessage}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageGenerator;
