import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX, Bot, X, Minimize2, Maximize2, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../utils/api';
import '../styles/AiHelpperWidget.css';

const WELCOME_MESSAGE = (userName = '') => ({
  id: 'welcome',
  role: 'assistant',
  content: `Namaste${userName ? ` ${userName}` : ''}! I am your AI assistant.\n\n` +
    'I know everything about this website and can guide you through every feature.\n\n' +
    'You can ask me:\n' +
    '• How to generate images and videos\n' +
    '• How tokens work (5 tokens per image)\n' +
    '• About any button, setting, or feature\n' +
    '• Anything else you need help with\n\n' +
    'Feel free to chat in Hindi, English, or Hinglish!'
});

const CLEAR_INPUT_MESSAGE = 'Please provide a clear input';
const VOICE_NOISE_ONLY_PATTERN = /^(?:uh+|um+|hmm+|huh+|ah+|mm+|erm+|noise|static|background noise|ambient noise|music|youtube|video|video playing|song|audio)\W*$/i;

const createAssistantSessionId = () =>
  `assistant-session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const normalizeAssistantText = (value = '') => String(value).replace(/\s+/g, ' ').trim();

const hasMeaningfulAssistantText = (value = '') => /[A-Za-z0-9\u0900-\u097F]/.test(value);

const isClearAssistantInput = (value = '', { source = 'text' } = {}) => {
  const normalizedValue = normalizeAssistantText(value);

  if (!normalizedValue || !hasMeaningfulAssistantText(normalizedValue)) {
    return false;
  }

  if (source === 'voice' && VOICE_NOISE_ONLY_PATTERN.test(normalizedValue)) {
    return false;
  }

  return true;
};

const AiAssistant = () => {
  const { token, user } = useAuth();
  const [isOpen, setIsOpen] = useState(() => {
    return false;
  });
  const [isMinimized, setIsMinimized] = useState(() => {
    const saved = localStorage.getItem('ai-assistant-minimized');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [isFullscreen, setIsFullscreen] = useState(() => {
    const saved = localStorage.getItem('ai-assistant-fullscreen');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentUserName, setCurrentUserName] = useState(user?.username || '');
  const [messages, setMessages] = useState([WELCOME_MESSAGE(currentUserName)]);
  const [input, setInput] = useState('');
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInCall, setIsInCall] = useState(false);

  useEffect(() => {
    if (user?.username) {
      setCurrentUserName(user.username);
    }
  }, [user]);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(null);
  const assistantClientIdRef = useRef(createAssistantSessionId());
  const lastVoiceInputRef = useRef({ text: '', timestamp: 0 });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    localStorage.setItem('ai-assistant-open', JSON.stringify(isOpen));
  }, [isOpen]);

  useEffect(() => {
    if (user?.username) {
      setCurrentUserName(user.username);
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem('ai-assistant-minimized', JSON.stringify(isMinimized));
  }, [isMinimized]);

  useEffect(() => {
    localStorage.setItem('ai-assistant-fullscreen', JSON.stringify(isFullscreen));
  }, [isFullscreen]);

  // Update isInCall when speaking or listening changes
  useEffect(() => {
    setIsInCall(isSpeaking || isListening);
  }, [isSpeaking, isListening]);

  const appendAssistantMessage = (content) => {
    setMessages(prev => [...prev, { id: `asst-${Date.now()}`, role: 'assistant', content }]);
  };

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
    return window.SpeechRecognition || window.webkitSpeechRecognition;
  };

  const handleSend = async (textToSend = null, { source = 'text' } = {}) => {
    const text = normalizeAssistantText(textToSend ?? input);
    if (isLoading) return;

    if (!isClearAssistantInput(text, { source })) {
      if (textToSend === null) {
        setInput('');
      }
      setError(CLEAR_INPUT_MESSAGE);
      appendAssistantMessage(CLEAR_INPUT_MESSAGE);
      return;
    }

    const userMessage = { id: `user-${Date.now()}`, role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/assistant/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: text }],
          context: 'general-chat',
          inputSource: source,
          assistantClientId: assistantClientIdRef.current,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.reply) {
        appendAssistantMessage(data.reply);
        
        if (isSpeaking) {
          speakText(data.reply);
        }
      } else {
        throw new Error(data.error || 'AI response failed');
      }
    } catch (err) {
      appendAssistantMessage('I am having trouble connecting right now. Please try again in a moment. You can also send a shorter version of your question and I will try again.');
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

   const speakText = (text) => {
     if (!window.speechSynthesis) return;

     window.speechSynthesis.cancel();

     const utterance = new SpeechSynthesisUtterance(text);
     synthRef.current = utterance;

     // Try to find an Indian English voice, fallback to any English voice
     const voices = window.speechSynthesis.getVoices();
     let selectedVoice = voices.find(voice =>
       voice.lang.includes('en-IN') ||
       voice.name.toLowerCase().includes('indian')
     );

     if (!selectedVoice) {
       selectedVoice = voices.find(voice =>
         voice.lang.startsWith('en-') && voice.lang !== 'en-US'
       );
     }

     if (selectedVoice) {
       utterance.voice = selectedVoice;
       utterance.lang = selectedVoice.lang;
     } else {
       utterance.lang = 'en-US'; // Final fallback
     }

     utterance.rate = 0.92;
     utterance.pitch = 1.0;
     utterance.volume = 0.9;

     utterance.onstart = () => setIsSpeaking(true);
     utterance.onend = () => setIsSpeaking(false);
     utterance.onerror = () => setIsSpeaking(false);

     window.speechSynthesis.speak(utterance);
   };

  const toggleListening = async () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsListening(false);
      setMicLevel(0);
      return;
    }

    if (window.speechSynthesis?.speaking || isSpeaking) {
      return;
    }

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setError('Speech recognition not supported. Use text input.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        setMicLevel(0.3);
      };

      recognition.onresult = (event) => {
        const transcript = normalizeAssistantText(event.results?.[0]?.[0]?.transcript || '');
        setMicLevel(0.8);

        if (window.speechSynthesis?.speaking || isSpeaking) {
          return;
        }

        if (!isClearAssistantInput(transcript, { source: 'voice' })) {
          setError(CLEAR_INPUT_MESSAGE);
          appendAssistantMessage(CLEAR_INPUT_MESSAGE);
          return;
        }

        if (isDuplicateVoiceInput(transcript)) {
          return;
        }

        handleSend(transcript, { source: 'voice' });
      };

      recognition.onerror = (event) => {
        if (event?.error === 'no-speech') {
          setError(CLEAR_INPUT_MESSAGE);
        }
        setIsListening(false);
        setMicLevel(0);
      };

      recognition.onend = () => {
        setIsListening(false);
        setMicLevel(0);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsConnected(true);
    } catch (err) {
      setError('Could not start microphone');
    }
  };

  const toggleVoice = () => {
    if (isSpeaking) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    } else {
      const lastMessage = messages.filter(m => m.role === 'assistant').pop();
      if (lastMessage) {
        speakText(lastMessage.content);
      }
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const clearChat = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    window.speechSynthesis?.cancel();
    assistantClientIdRef.current = createAssistantSessionId();
    lastVoiceInputRef.current = { text: '', timestamp: 0 };
    setInput('');
    setError('');
    setIsListening(false);
    setIsSpeaking(false);
    setIsConnected(false);
    setMicLevel(0);
     setMessages([WELCOME_MESSAGE(currentUserName)]);
  };

  if (!isOpen) {
    return (
      <button
        className="ai-assistant-toggle"
        onClick={() => setIsOpen(true)}
      >
        <Bot size={24} />
        <span>AI Assistant</span>
      </button>
    );
  }

  return (
    <div className={`ai-assistant-container ${isMinimized ? 'minimized' : ''} ${isFullscreen ? 'fullscreen' : ''}`}>
      <div className="ai-assistant-header">
        <div className="ai-header-left">
          <Bot size={18} />
          <span>{currentUserName ? `${currentUserName}'s AI Assistant` : 'AI Assistant'}</span>
        </div>
        <div className="ai-header-actions">
          <button onClick={clearChat} className="new-chat-btn" title="New chat">
            <Plus size={16} />
          </button>
          <button onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button onClick={() => setIsOpen(false)} title="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Live Call Overlay - Shows when voice is active */}
      {isInCall && !isMinimized && (
        <div className="live-call-overlay">
          <div className="call-background-effect" />
          <div className="call-interface">
            <div className="ai-face-circle">
              <div className={`ai-face-pulse ${isSpeaking ? 'speaking' : isListening ? 'listening' : ''}`}>
                <Bot size={isFullscreen ? 64 : 48} />
              </div>
              <div className="call-status">
                {isSpeaking ? 'AI is speaking...' : isListening ? 'Listening...' : 'Connected'}
              </div>
            </div>
            <button
              className="call-end-btn"
              onClick={() => {
                if (isListening) toggleListening();
                if (isSpeaking) toggleVoice();
              }}
              title="End call"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {!isMinimized && (
        <>
          <div className="ai-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`ai-message ${msg.role}`}>
                <div className="message-role">
                  {msg.role === 'assistant' ? <Bot size={12} /> : 'You'}
                </div>
                <div className="message-content">{msg.content}</div>
              </div>
            ))}
            {isLoading && (
              <div className="ai-message assistant loading">
                <div className="message-role"><Bot size={12} /></div>
                <div className="message-content">Thinking...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="ai-controls">
            <div className="mic-visualizer">
              {[0,1,2,3,4].map(i => (
                <span
                  key={i}
                  className={`bar ${isListening ? 'active' : ''}`}
                  style={{ height: isListening ? `${16 + Math.random() * 30}px` : '3px' }}
                />
              ))}
            </div>
            <div className="ai-buttons">
              <button
                className={`ai-btn ${isListening ? 'listening' : ''}`}
                onClick={toggleListening}
                title={isListening ? 'Stop' : 'Voice input'}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button
                className={`ai-btn ${isSpeaking ? 'speaking' : ''}`}
                onClick={toggleVoice}
                title={isSpeaking ? 'Stop' : 'Listen'}
                disabled={!messages.filter(m => m.role === 'assistant').length}
              >
                {isSpeaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            </div>
          </div>

          <form className="ai-input-form" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type or speak..."
              disabled={isLoading}
            />
            <button type="submit" disabled={!input.trim() || isLoading}>
              <Send size={16} />
            </button>
          </form>

          {error && <div className="ai-error">{error}</div>}
        </>
      )}
    </div>
  );
};

export default AiAssistant;
