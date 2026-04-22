import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiUrl, getJson } from '../utils/api';
import { downloadAsset } from '../utils/downloadAsset';
import LoginModal from './LoginModal';
import '../styles/ImageGenerator.css';

const STYLE_OPTIONS = [
  { value: 'anime', label: 'Anime' },
  { value: 'realistic', label: 'Realistic' },
  { value: '3d', label: '3D' },
  { value: 'digital', label: 'Digital Art' },
];

const RATIO_BUTTONS = [
  { value: '1:1', label: 'Square' },
  { value: '16:9', label: 'Wide' },
  { value: '9:16', label: 'Vertical' },
  { value: '4:3', label: 'Classic' },
];

const ImageGenerator = () => {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('realistic');
  const [ratio, setRatio] = useState('1:1');
  const [credits, setCredits] = useState(20);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const { token } = useAuth();

  const generateImage = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return setError('Enter a prompt');
    if (credits <= 0) return setError('No credits left');
    if (!token) return setShowLogin(true);

    setLoading(true);
    setError('');

    try {
      const data = await getJson('/api/image/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          prompt: `${prompt.trim()}, ${style} style`, 
          ratio, 
          quality: 'high' 
        }),
      });

      setResult({
        url: data.image.imageUrl,
        prompt: data.image.prompt,
        ratio,
        style,
      });
      setPrompt('');
      setCredits(c => Math.max(0, c - 1));
    } catch (err) {
      setError(err.message || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    if (result && token) {
      downloadAsset({ assetUrl: result.url, assetType: 'image', fileName: `pixelcraft-${Date.now()}.jpg` });
    }
  };

  return (
    <div className="generator glass-card">
      <div className="credits-header">
        <span>⚡ Credits: {credits}</span>
      </div>
      
      <form onSubmit={generateImage} className="generator-form">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what you want to create..."
          rows="4"
          className="prompt-input glass-input"
          disabled={loading}
        />

        <div className="tabs-row">
          <div className="tab-row">
            <button className="tab active glow-tab">Image</button>
            <button className="tab">Video</button>
          </div>
        </div>

        <div className="controls-grid">
          <div className="control">
  <span className="control-label">Style</span>
            <div className="pills">
              {STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`pill ${style === opt.value ? 'active glow-btn' : ''}`}
                  onClick={() => setStyle(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="control">
            <span>Aspect Ratio</span>
            <div className="pills">
              {RATIO_BUTTONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`pill ${ratio === opt.value ? 'active glow-btn' : ''}`}
                  onClick={() => setRatio(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button 
          className="generate-btn gradient-glow" 
          disabled={loading || !prompt.trim() || credits <= 0}
        >
          {loading ? (
            <>
              <span className="spinner"></span>
              ⚡ Generating...
            </>
          ) : (
            '⚡ Generate Image (1 Credit)'
          )}
        </button>

        {error && <div className="error glass-card">{error}</div>}
      </form>

      {result && (
        <div className="result glass-card">
          <img src={result.url} alt={result.prompt} className="result-img" />
          <div className="result-actions">
            <button className="glow-btn" onClick={download}>Download</button>
            <button className="glow-btn" onClick={() => setResult(null)}>New Image</button>
          </div>
        </div>
      )}

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
};

export default ImageGenerator;

