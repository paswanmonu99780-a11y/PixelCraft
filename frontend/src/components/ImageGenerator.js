import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiUrl, getJson, checkGenerationLimit, fetchUserCreditsData } from '../utils/api';
import { downloadAsset, resolveDownloadUrl } from '../utils/downloadAsset';
import {
  ASSISTANT_ACTION_EVENT_NAME,
  clearPendingAssistantAction,
  readPendingAssistantAction,
} from '../utils/assistantActions';
import CreditsDisplay from './CreditsDisplay';
import LoginModal from './LoginModal';
import PaymentModal from './PaymentModal';
import '../styles/ImageGenerator.css';

const GENERATION_MODES = [
  { value: 'text-to-image', label: 'Image' },
  { value: 'text-to-video', label: 'Video' },
  { value: 'image-to-video', label: 'Animate' },
];

const RATIO_OPTIONS = [
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
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
    reader.onerror = () => reject(new Error('Could not load image'));
    reader.readAsDataURL(file);
  });

const getStoredSetting = (settingKey, fallbackValue, options) => {
  if (typeof window === 'undefined') return fallbackValue;
  try {
    const storedSettings = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
    const storedValue = storedSettings[settingKey];
    return options.some(o => o.value === storedValue) ? storedValue : fallbackValue;
  } catch {
    return fallbackValue;
  }
};

const isDataUrl = (assetUrl = '') => assetUrl.startsWith('data:');
const isRemoteUrl = (assetUrl = '') => /^https?:\/\//i.test(assetUrl);
const isProxyPreviewUrl = (assetUrl = '') => assetUrl.includes('/api/image/preview?');

const getResolvedImageUrl = (imageUrl = '') => {
  if (!imageUrl || isDataUrl(imageUrl)) return imageUrl;
  if (isProxyPreviewUrl(imageUrl)) return isRemoteUrl(imageUrl) ? imageUrl : apiUrl(imageUrl);
  if (isRemoteUrl(imageUrl)) return apiUrl(`/api/image/preview?source=${encodeURIComponent(imageUrl)}`);
  return apiUrl(imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`);
};

const getPreviewUrl = (imageUrl = '', retryCount = 0) => {
  const resolvedImageUrl = getResolvedImageUrl(imageUrl);
  if (!resolvedImageUrl || isDataUrl(resolvedImageUrl)) return resolvedImageUrl;
  try {
    const url = new URL(resolvedImageUrl, window.location.origin);
    url.searchParams.set('previewAttempt', String(retryCount));
    return url.toString();
  } catch {
    const separator = resolvedImageUrl.includes('?') ? '&' : '?';
    return `${resolvedImageUrl}${separator}previewAttempt=${retryCount}`;
  }
};

const getFileExtension = (assetUrl = '', assetType = 'image') => {
  if (assetType === 'video') return assetUrl.includes('.webm') ? 'webm' : 'mp4';
  return assetUrl.includes('image/png') ? 'png' : 'jpg';
};

const getPromptPlaceholder = (mode) => {
  if (mode === 'text-to-video') return 'Describe your video...';
  if (mode === 'image-to-video') return 'Describe animation...';
  return 'Describe your image...';
};

const getGenerateButtonLabel = (mode, loading) => {
  if (loading) return mode === 'text-to-image' ? 'Generating...' : 'Processing...';
  if (mode === 'text-to-video') return 'Generate Video';
  if (mode === 'image-to-video') return 'Animate';
  return 'Generate';
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
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [userCreditsData, setUserCreditsData] = useState(null);
  const [canGenerate, setCanGenerate] = useState(true);
  const { token, user, setUser } = useAuth();
  const previewRetryTimeoutRef = useRef(null);
  const lastAssistantActionIdRef = useRef('');

  useEffect(() => () => {
    if (previewRetryTimeoutRef.current) window.clearTimeout(previewRetryTimeoutRef.current);
  }, []);

  useEffect(() => {
    let interval;
    if (token) {
      const loadCreditsData = async () => {
        try {
          const data = await fetchUserCreditsData(token);
          setUserCreditsData(data);
          setCanGenerate(data.canGenerate !== false);
        } catch (err) {
          console.error('Credits check failed:', err);
        }
      };
      loadCreditsData();
      interval = setInterval(loadCreditsData, 30000);
    }
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ratio, quality }));
  }, [ratio, quality]);

  useEffect(() => {
    if (previewRetryTimeoutRef.current) window.clearTimeout(previewRetryTimeoutRef.current);
    setPreviewRetryCount(0);
    setImgStatus(result?.assetType === 'image' ? 'loading' : 'idle');
  }, [result?.id, result?.assetType]);

  useEffect(() => {
    setError('');
    setResult(null);
    setVideoStatus(null);
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
        const data = await getJson('/api/image/video-status', { headers: { Authorization: `Bearer ${token}` } });
        if (!isCancelled) setVideoStatus(data.video || null);
      } catch {
        if (!isCancelled) setVideoStatus({ canGenerate: true });
      } finally {
        if (!isCancelled) setVideoStatusLoading(false);
      }
    };

    loadVideoStatus();
    return () => { isCancelled = true; };
  }, [mode, token]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const applyAssistantAction = async (action) => {
      if (!action?.id || action.id === lastAssistantActionIdRef.current) return;
      if (action.type !== 'generate-image' && action.type !== 'generate-video') return;

      lastAssistantActionIdRef.current = action.id;
      const nextMode = action.type === 'generate-video' ? 'text-to-video' : 'text-to-image';
      const nextPrompt = action.prompt || '';

      setMode(nextMode);
      setPrompt(nextPrompt);
      setError('');

      if (action.ratio && RATIO_OPTIONS.some(o => o.value === action.ratio)) setRatio(action.ratio);
      if (action.quality && QUALITY_OPTIONS.some(o => o.value === action.quality)) setQuality(action.quality);

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
          await generateImage(nextPrompt, { ratio: action.ratio || ratio, quality: action.quality || quality });
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
    const handleAssistantAction = (event) => void applyAssistantAction(event.detail);
    window.addEventListener(ASSISTANT_ACTION_EVENT_NAME, handleAssistantAction);

    return () => window.removeEventListener(ASSISTANT_ACTION_EVENT_NAME, handleAssistantAction);
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

    if (!data?.image?.imageUrl) throw new Error('Invalid response');
    if (data.currentUser) setUser(data.currentUser);

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
      body: JSON.stringify({ prompt: promptText }),
    });

    if (!data?.video?.videoUrl) throw new Error('Invalid response');

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
      body: JSON.stringify({ prompt: promptText, sourceImage: imageDataUrl }),
    });

    if (!data?.video?.videoUrl) throw new Error('Invalid response');

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

  const runGenerationRequest = async () => {
    if (!token) {
      setError('Session expired');
      return false;
    }

    try {
      const limitData = await checkGenerationLimit(token);
      setCanGenerate(limitData.canGenerate);
      if (!limitData.canGenerate) {
        setError('Daily limit reached');
        setShowPaymentModal(true);
        return false;
      }
    } catch {
      console.error('Limit check failed');
    }

    const trimmedPrompt = prompt.trim();
    if (mode !== 'image-to-video' && !trimmedPrompt) {
      setError('Enter a prompt');
      return false;
    }

    if (mode === 'image-to-video' && !sourceImage) {
      setError('Upload an image');
      return false;
    }

    setLoading(true);
    setError('');
    setImgStatus(mode === 'text-to-image' ? 'loading' : 'idle');

    try {
      if (mode === 'text-to-video') {
        await generateTextToVideo(trimmedPrompt);
      } else if (mode === 'image-to-video') {
        await animateImage(trimmedPrompt, sourceImage, sourceImageName);
      } else {
        await generateImage(trimmedPrompt, { ratio, quality });
      }

      if (mode !== 'image-to-video') setPrompt('');
      return true;
    } catch (err) {
      if (err.status === 429) setShowPaymentModal(true);
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
      setError(err.message || 'Could not load image');
    }
  };

  const handleDownloadAsset = () => {
    if (!token) {
      setShowLoginModal(true);
      setError('Please log in');
      return;
    }
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
      const resolvedUrl = resolveDownloadUrl(result.assetUrl, result.assetType);
      await navigator.clipboard.writeText(resolvedUrl);
    } catch {
      setError('Could not copy link');
    }
  };

  const handleRegenerate = async () => {
    if (!result || !token) return;
    setLoading(true);
    setError('');
    try {
      if (result.generationMode === 'text-to-video') {
        await generateTextToVideo(result.prompt);
      } else if (result.generationMode === 'image-to-video') {
        await animateImage(result.prompt || '', result.sourceImagePreview || sourceImage, result.sourceImageName || sourceImageName);
      } else {
        await generateImage(result.prompt, { ratio: result.ratio || ratio, quality: result.quality || quality });
      }
    } catch (err) {
      setError(err.message || 'Could not regenerate');
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
          prompt: result.prompt || '',
          imageUrl: result.assetUrl,
          source: 'generated',
        }),
      });

      if (data.currentUser) setUser(data.currentUser);
      setPublishMessage('Published!');
    } catch {
      setPublishMessage('Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  const isTextToImageMode = mode === 'text-to-image';
  const isImageToVideoMode = mode === 'image-to-video';
  const videoGenerationBlocked = !isTextToImageMode && !videoStatusLoading && videoStatus?.canGenerate === false;

  return (
    <div className="image-generator">
      <div className="mode-tabs">
        {GENERATION_MODES.map((modeOption) => (
          <button
            key={modeOption.value}
            type="button"
            className={`mode-tab ${mode === modeOption.value ? 'active' : ''}`}
            onClick={() => setMode(modeOption.value)}
          >
            {modeOption.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleGenerate} className="generator-form">
        {isImageToVideoMode && (
          <div className="upload-section">
            <label className="upload-box">
              <span>Upload Image</span>
              <input type="file" accept="image/*" onChange={handleSourceImageChange} disabled={loading} />
            </label>
            {sourceImage && <img src={sourceImage} className="upload-preview" alt="Source" />}
          </div>
        )}

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={getPromptPlaceholder(mode)}
          maxLength={MAX_PROMPT_LENGTH}
          rows={3}
          disabled={loading}
          className="prompt-input"
        />

        {isTextToImageMode && (
          <div className="controls-row">
            <div className="control-group">
              <span>Aspect Ratio</span>
              <div className="pill-group">
                {RATIO_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`pill ${ratio === option.value ? 'active' : ''}`}
                    onClick={() => setRatio(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group">
              <span>Quality</span>
              <div className="pill-group">
                {QUALITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`pill ${quality === option.value ? 'active' : ''}`}
                    onClick={() => setQuality(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && <div className="error-text">{error}</div>}

        <button
          type="submit"
          className="generate-button"
          disabled={loading || !canGenerate || (!prompt.trim() && !isImageToVideoMode) || (isImageToVideoMode && !sourceImage) || videoGenerationBlocked}
        >
          {loading ? <span className="spinner"></span> : null}
          {getGenerateButtonLabel(mode, loading)}
        </button>
      </form>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} onLoginSuccess={setUser} />
      <PaymentModal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} userToken={token} />

      {loading && <div className="loader-container"><div className="loader"></div></div>}

      {result && !loading && (
        <div className="result-card">
          {result.assetType === 'image' ? (
            <img src={getPreviewUrl(result.assetUrl, previewRetryCount)} alt={result.prompt} className="result-media" />
          ) : (
            <video src={getResolvedImageUrl(result.assetUrl)} controls playsInline className="result-media" />
          )}

          <div className="result-actions">
            <button onClick={handleDownloadAsset} className="action-button">Download</button>
            <button onClick={handleCopyLink} className="action-button">Copy Link</button>
            <button onClick={handleRegenerate} className="action-button">Regenerate</button>
            {result.assetType === 'image' && (
              <button onClick={handlePublishToExplore} className="action-button" disabled={publishing}>
                {publishing ? 'Publishing...' : 'Publish'}
              </button>
            )}
          </div>

          {publishMessage && <div className="success-text">{publishMessage}</div>}
        </div>
      )}
    </div>
  );
};

export default ImageGenerator;
