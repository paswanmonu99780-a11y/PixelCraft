import React, { useEffect, useRef, useState } from 'react';
import { Mic, Phone, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../utils/api';
import '../styles/AiVoiceAssistant.css';

const CLEAR_INPUT_MESSAGE = 'Please provide a clear input';
const VOICE_NOISE_ONLY_PATTERN = /^(?:uh+|um+|hmm+|huh+|ah+|mm+|erm+|noise|static|background noise|ambient noise|music|youtube|video|video playing|song|audio)\W*$/i;

const createAssistantSessionId = () =>
  `assistant-session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const normalizeAssistantText = (value = '') => String(value).replace(/\s+/g, ' ').trim();
const hasMeaningfulAssistantText = (value = '') => /[A-Za-z0-9\u0900-\u097F]/.test(value);

const isClearAssistantInput = (value = '') => {
  const normalizedValue = normalizeAssistantText(value);
  return Boolean(
    normalizedValue &&
    hasMeaningfulAssistantText(normalizedValue) &&
    !VOICE_NOISE_ONLY_PATTERN.test(normalizedValue)
  );
};

const AiVoiceAssistant = () => {
  const { token } = useAuth();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);
  const assistantClientIdRef = useRef(createAssistantSessionId());
  const lastVoiceInputRef = useRef({ text: '', timestamp: 0 });

  const isDuplicateVoiceInput = (value) => {
    const normalizedValue = normalizeAssistantText(value).toLowerCase();
    const now = Date.now();

    if (
      normalizedValue &&
      lastVoiceInputRef.current.text === normalizedValue &&
      now - lastVoiceInputRef.current.timestamp < 4000
    ) {
      return true;
    }

    lastVoiceInputRef.current = {
      text: normalizedValue,
      timestamp: now,
    };

    return false;
  };

  const getSpeechRecognition = () => {
    if (typeof window === 'undefined') return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  };

  const startListening = async () => {
    if (window.speechSynthesis?.speaking || isSpeaking) {
      return;
    }

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    try {
      setError('');
      const recognition = new SpeechRecognition();
      recognition.lang = navigator.language || 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setMicLevel(0.3);
      };

      recognition.onresult = async (event) => {
        const transcript = normalizeAssistantText(event.results?.[0]?.[0]?.transcript || '');
        setMicLevel(0.8);

        if (window.speechSynthesis?.speaking || isSpeaking) {
          return;
        }

        if (isDuplicateVoiceInput(transcript)) {
          return;
        }

        if (!isClearAssistantInput(transcript)) {
          setError(CLEAR_INPUT_MESSAGE);
          speakResponse(CLEAR_INPUT_MESSAGE);
          return;
        }

        // Send transcript to AI and get response
        try {
          const response = await fetch(apiUrl('/api/assistant/chat'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              messages: [{ role: 'user', content: transcript }],
              inputSource: 'voice',
              assistantClientId: assistantClientIdRef.current,
            }),
          });

          const data = await response.json();
          if (response.ok && data.reply) {
            speakResponse(data.reply);
          }
        } catch (err) {
          console.error('AI response error:', err);
          speakResponse('Sorry, I could not process your request.');
        }
      };

      recognition.onerror = (event) => {
        setError(event?.error === 'no-speech' ? CLEAR_INPUT_MESSAGE : 'Speech recognition error: ' + event.error);
        setIsListening(false);
        setMicLevel(0);
      };

      recognition.onend = () => {
        setIsListening(false);
        setMicLevel(0);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setError('Failed to start speech recognition');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setMicLevel(0);
  };

  const speakResponse = (text) => {
    if (!text || isSpeaking) return;

    stopListening();
    setIsSpeaking(true);

    // Try to use browser speech synthesis first
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new window.SpeechSynthesisUtterance(text);
      utterance.lang = navigator.language || 'en-IN';
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;

      utterance.onend = () => {
        setIsSpeaking(false);
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
      return;
    }

    // Fallback to API speech synthesis
    fetch(apiUrl('/api/assistant/speak'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text }),
    })
      .then(response => response.json())
      .then(data => {
        if (data.audioBase64) {
          const audio = new Audio(`data:${data.contentType || 'audio/mpeg'};base64,${data.audioBase64}`);
          audio.onended = () => setIsSpeaking(false);
          audio.onerror = () => setIsSpeaking(false);
          audio.play().catch(() => setIsSpeaking(false));
        } else {
          setIsSpeaking(false);
        }
      })
      .catch(() => {
        setIsSpeaking(false);
      });
  };

  const toggleConnection = () => {
    if (isConnected) {
      stopListening();
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
      setIsConnected(false);
    } else {
      assistantClientIdRef.current = createAssistantSessionId();
      lastVoiceInputRef.current = { text: '', timestamp: 0 };
      setIsConnected(true);
      startListening();
    }
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopListening();
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <div className="ai-voice-assistant">
      <div className="voice-assistant-header">
        <h1>AI Voice Assistant</h1>
        <p>Click the call button and speak naturally</p>
      </div>

      <div className="voice-assistant-main">
        <div className="assistant-avatar">
          <div className={`avatar-circle ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}>
            {isConnected ? (
              isListening ? <Mic size={48} /> : <Volume2 size={48} />
            ) : (
              <Phone size={48} />
            )}
          </div>

          <div className="mic-visualizer">
            {[0, 1, 2, 3, 4].map((bar) => (
              <span
                key={bar}
                className={`visualizer-bar ${isListening ? 'active' : ''}`}
                style={{
                  height: isListening ? `${20 + micLevel * 60}px` : '4px',
                  animationDelay: `${bar * 0.1}s`
                }}
              />
            ))}
          </div>
        </div>

        <div className="voice-status">
          {isConnected ? (
            <div className="connected-status">
              {isListening ? (
                <><Mic size={16} /> Listening...</>
              ) : isSpeaking ? (
                <><Volume2 size={16} /> Speaking...</>
              ) : (
                <><VolumeX size={16} /> Ready to listen</>
              )}
            </div>
          ) : (
            <div className="disconnected-status">
              <PhoneOff size={16} /> Disconnected
            </div>
          )}
        </div>

        {error && (
          <div className="voice-error">
            {error}
          </div>
        )}

        <div className="voice-controls">
          <button
            className={`call-button ${isConnected ? 'connected' : ''}`}
            onClick={toggleConnection}
          >
            {isConnected ? <PhoneOff size={24} /> : <Phone size={24} />}
            {isConnected ? 'End Call' : 'Start Call'}
          </button>
        </div>

        <div className="voice-instructions">
          <h3>How to use:</h3>
          <ul>
            <li>Click "Start Call" to begin voice conversation</li>
            <li>Speak clearly when the microphone is active</li>
            <li>The AI will respond with voice</li>
            <li>Click "End Call" to stop the conversation</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AiVoiceAssistant;
