import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX, Bot, X, Minimize2, Maximize2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../utils/api';
import '../styles/AiHelpperWidget.css';

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content: 'Hello! I am your AI Assistant. I can help you with:\n\n• Generating images and exploring the website\n• Answer questions about any topic\n• Chatting naturally in any language\n• Controlling website features\n\nHow can I help you today?'
};

const DEFAULT_ADVANCED_WELCOME_MESSAGE = 'Hello! I am your advanced AI Assistant.\n\nI can help you with:\n\n- Technology, coding, business, study, and general questions\n- Step-by-step explanations in simple language\n- Full code examples and debugging help\n- Hindi, English, or Hinglish conversations\n- Website guidance and feature support\n\nTell me what you want to do, and I will help properly.';
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
  const { token } = useAuth();
  const [isOpen, setIsOpen] = useState(() => {
    return false;
  });
  const [isMinimized, setIsMinimized] = useState(() => {
    const saved = localStorage.getItem('ai-assistant-minimized');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([{ ...WELCOME_MESSAGE, content: DEFAULT_ADVANCED_WELCOME_MESSAGE }]);
  const [input, setInput] = useState('');
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
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
    localStorage.setItem('ai-assistant-minimized', JSON.stringify(isMinimized));
  }, [isMinimized]);

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
    utterance.lang = 'en-IN';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.8;
    
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
    setMessages([{ ...WELCOME_MESSAGE, content: DEFAULT_ADVANCED_WELCOME_MESSAGE }]);
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
    <div className={`ai-assistant-container ${isMinimized ? 'minimized' : ''}`}>
      <div className="ai-assistant-header">
        <div className="ai-header-left">
          <Bot size={20} />
          <span>AI Assistant</span>
        </div>
        <div className="ai-header-actions">
          <button onClick={() => setIsMinimized(!isMinimized)} title={isMinimized ? 'Expand' : 'Minimize'}>
            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
          <button onClick={clearChat} title="New chat">
            <X size={16} />
          </button>
          <button onClick={() => setIsOpen(false)} title="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="ai-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`ai-message ${msg.role}`}>
                <div className="message-role">
                  {msg.role === 'assistant' ? <Bot size={14} /> : 'You'}
                </div>
                <div className="message-content">{msg.content}</div>
              </div>
            ))}
            {isLoading && (
              <div className="ai-message assistant loading">
                <div className="message-role"><Bot size={14} /></div>
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
                  style={{ height: isListening ? `${20 + Math.random() * 40}px` : '4px' }}
                />
              ))}
            </div>
            <div className="ai-buttons">
              <button 
                className={`ai-btn ${isListening ? 'listening' : ''}`}
                onClick={toggleListening}
                title={isListening ? 'Stop' : 'Voice input'}
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <button 
                className={`ai-btn ${isSpeaking ? 'speaking' : ''}`}
                onClick={toggleVoice}
                title={isSpeaking ? 'Stop' : 'Listen'}
                disabled={!messages.filter(m => m.role === 'assistant').length}
              >
                {isSpeaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
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
              <Send size={18} />
            </button>
          </form>

          {error && <div className="ai-error">{error}</div>}
        </>
      )}
    </div>
  );
};

export default AiAssistant;
