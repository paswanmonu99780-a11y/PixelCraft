import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bot,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
  Maximize,
  Minimize,
  ZoomIn,
  ZoomOut,
  Phone,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dispatchAssistantAction } from '../utils/assistantActions';
import { apiUrl } from '../utils/api';
import '../styles/AiHelpperWidget.css';

const WELCOME_MESSAGE = {
  id: 'welcome-message',
  role: 'assistant',
  content:
    'Main AI Helpper hoon. Mujhe Monu ne banaya hai. Monu 18 saal ke hain aur unki date of birth 14 April 2008 hai. Main alag-alag languages me jawab dene, website ke sections control karne, aur jo important baat aap bataoge use yaad rakhne ki koshish karta hoon.',
};

const QUICK_PROMPTS = [
  'Image kaise generate karun?',
  'Video banane ka option kahan hai?',
  'Explore me image publish kaise hoti hai?',
  'Profile update kaise karun?',
];

const BACKGROUND_MODE_STORAGE_KEY = 'ai-helpper-background-interaction';
const PANEL_FRAME_STORAGE_KEY = 'ai-helpper-panel-frame';
const HELPPER_CLIENT_ID_STORAGE_KEY = 'ai-helpper-client-id';
const PANEL_EDGE_GAP = 12;
const PANEL_DEFAULT_WIDTH = 580;
const PANEL_DEFAULT_HEIGHT = 860;
const PANEL_MIN_WIDTH = 360;
const PANEL_MIN_HEIGHT = 560;
const PANEL_MAX_WIDTH = 780;
const PANEL_MAX_HEIGHT = 960;
const CHAT_HISTORY_STORAGE_KEY = 'ai-helpper-chat-history';
const MAX_CHAT_HISTORY_MESSAGES = 60;
const QUESTION_WORD_PATTERN = /\b(how|where|what|why|kaise|kahan|kyun|kya)\b/i;
const IMPERATIVE_ACTION_PATTERN = /\b(open|show|go|take me|navigate|switch|start|run|launch|generate|create|make|build|do|karo|kar do|karna|banao|banado|bnao|khol|khol do|dikhao|dikha do|le chalo|switch karo|chal|control)\b/i;
const IMAGE_COMMAND_PATTERN = /\b(generate|create|make|build|banao|banado|bnao|karo|kar do)\b.*\b(image|photo|picture|pic|poster|wallpaper|art|tasveer)\b|\b(image|photo|picture|pic|poster|wallpaper|art|tasveer)\b.*\b(generate|create|make|build|banao|banado|bnao|karo|kar do)\b/i;
const VIDEO_COMMAND_PATTERN = /\b(generate|create|make|build|banao|banado|bnao|karo|kar do)\b.*\b(video|animation|clip)\b|\b(video|animation|clip)\b.*\b(generate|create|make|build|banao|banado|bnao|karo|kar do)\b/i;

const createMessage = (role, content, extra = {}) => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  ...extra,
});

const trimText = (value = '') => String(value).trim();

const getStoredBackgroundInteraction = () => {
  if (typeof window === 'undefined') {
    return true;
  }

  const storedValue = window.localStorage.getItem(BACKGROUND_MODE_STORAGE_KEY);
  return storedValue === null ? true : storedValue === 'true';
};

const createLocalId = () => {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `helpper-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const getOrCreateHelperClientId = () => {
  if (typeof window === 'undefined') {
    return 'helpper-server';
  }

  const storedValue = window.localStorage.getItem(HELPPER_CLIENT_ID_STORAGE_KEY);
  if (storedValue) {
    return storedValue;
  }

  const nextValue = createLocalId();
  window.localStorage.setItem(HELPPER_CLIENT_ID_STORAGE_KEY, nextValue);
  return nextValue;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getViewportSize = () => {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 900 };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
};

const getPanelBounds = () => {
  const viewport = getViewportSize();
  const maxWidth = Math.max(300, viewport.width - PANEL_EDGE_GAP * 2);
  const maxHeight = Math.max(420, viewport.height - PANEL_EDGE_GAP * 2);

  return {
    viewport,
    minWidth: Math.min(PANEL_MIN_WIDTH, maxWidth),
    minHeight: Math.min(PANEL_MIN_HEIGHT, maxHeight),
    maxWidth: Math.min(PANEL_MAX_WIDTH, maxWidth),
    maxHeight: Math.min(PANEL_MAX_HEIGHT, maxHeight),
  };
};

const sanitizePanelFrame = (frame = {}) => {
  const bounds = getPanelBounds();
  const width = clamp(
    Number(frame.width) || Math.min(PANEL_DEFAULT_WIDTH, bounds.maxWidth),
    bounds.minWidth,
    bounds.maxWidth
  );
  const height = clamp(
    Number(frame.height) || Math.min(PANEL_DEFAULT_HEIGHT, bounds.maxHeight),
    bounds.minHeight,
    bounds.maxHeight
  );

  return {
    width,
    height,
    x: clamp(
      Number(frame.x) || bounds.viewport.width - width - PANEL_EDGE_GAP,
      PANEL_EDGE_GAP,
      Math.max(PANEL_EDGE_GAP, bounds.viewport.width - width - PANEL_EDGE_GAP)
    ),
    y: clamp(
      Number(frame.y) || bounds.viewport.height - height - PANEL_EDGE_GAP,
      PANEL_EDGE_GAP,
      Math.max(PANEL_EDGE_GAP, bounds.viewport.height - height - PANEL_EDGE_GAP)
    ),
  };
};

const getStoredPanelFrame = () => {
  if (typeof window === 'undefined') {
    return sanitizePanelFrame();
  }

  try {
    const storedValue = window.localStorage.getItem(PANEL_FRAME_STORAGE_KEY);
    if (!storedValue) {
      return sanitizePanelFrame();
    }

    return sanitizePanelFrame(JSON.parse(storedValue));
  } catch (error) {
    return sanitizePanelFrame();
  }
};

const sanitizeStoredMessage = (message = {}) => {
  const role = ['assistant', 'user', 'system'].includes(message?.role) ? message.role : '';
  const content = trimText(message?.content).slice(0, 6000);

  if (!role || !content) {
    return null;
  }

  return {
    id: trimText(message?.id) || `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
  };
};

const getStoredMessages = () => {
  if (typeof window === 'undefined') {
    return [WELCOME_MESSAGE];
  }

  try {
    const storedValue = window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
    if (!storedValue) {
      return [WELCOME_MESSAGE];
    }

    const parsedMessages = JSON.parse(storedValue);
    if (!Array.isArray(parsedMessages)) {
      return [WELCOME_MESSAGE];
    }

    const sanitizedMessages = parsedMessages
      .map((message) => sanitizeStoredMessage(message))
      .filter(Boolean)
      .slice(-MAX_CHAT_HISTORY_MESSAGES);

    return sanitizedMessages.length ? sanitizedMessages : [WELCOME_MESSAGE];
  } catch (error) {
    return [WELCOME_MESSAGE];
  }
};

const hasActionIntent = (prompt = '') => {
  const normalizedPrompt = trimText(prompt);
  if (!normalizedPrompt) {
    return false;
  }

  if (!IMPERATIVE_ACTION_PATTERN.test(normalizedPrompt)) {
    return false;
  }

  return !(QUESTION_WORD_PATTERN.test(normalizedPrompt) && /[?\u061F]$/.test(normalizedPrompt));
};

const extractGenerationPrompt = (prompt = '', kind = 'image') => {
  const normalizedPrompt = trimText(prompt);
  const kindWord = kind === 'video'
    ? '(?:video|animation|clip)'
    : '(?:image|photo|picture|pic|poster|wallpaper|art|tasveer)';
  const patterns = [
    new RegExp(`(?:generate|create|make|build|banao|banado|bnao)\\s+(?:an?\\s+)?${kindWord}\\s*(?:of|for|with|about)?\\s*(.+)$`, 'i'),
    new RegExp(`${kindWord}\\s*(?:generate|create|make|build|banao|banado|bnao)\\s*(?:of|for|with|about)?\\s*(.+)$`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = normalizedPrompt.match(pattern);
    if (trimText(match?.[1])) {
      return trimText(match[1]);
    }
  }

  return trimText(
    normalizedPrompt
      .replace(/^(please|abhi|zara|jara|turant)\s+/i, '')
      .replace(kind === 'video' ? VIDEO_COMMAND_PATTERN : IMAGE_COMMAND_PATTERN, '')
      .replace(/\s+/g, ' ')
  );
};

const parseLocalAssistantAction = (prompt = '') => {
  const normalizedPrompt = trimText(prompt);
  const compactPrompt = normalizedPrompt.toLowerCase();

  if (!hasActionIntent(normalizedPrompt)) {
    return null;
  }

  if (IMAGE_COMMAND_PATTERN.test(normalizedPrompt)) {
    const imagePrompt = extractGenerationPrompt(normalizedPrompt, 'image');

    return {
      type: 'generate-image',
      route: '/dashboard',
      tab: 'generate',
      prompt: imagePrompt,
      autoRun: Boolean(imagePrompt),
      requiresAuth: true,
      reply: imagePrompt
        ? `Theek hai, main "${imagePrompt}" ke liye image generate kar raha hoon.`
        : 'Main image generator khol raha hoon. Prompt likh do, main turant generate kar dunga.',
    };
  }

  if (VIDEO_COMMAND_PATTERN.test(normalizedPrompt)) {
    const videoPrompt = extractGenerationPrompt(normalizedPrompt, 'video');

    return {
      type: 'generate-video',
      route: '/dashboard',
      tab: 'generate',
      prompt: videoPrompt,
      autoRun: Boolean(videoPrompt),
      requiresAuth: true,
      reply: videoPrompt
        ? `Theek hai, main "${videoPrompt}" ke liye video generation start kar raha hoon.`
        : 'Main video generator khol raha hoon. Prompt do aur main usse start kar dunga.',
    };
  }

  const dashboardTabConfigs = [
    {
      pattern: /\b(history|archive|old images|past results|purane results|history dikhao)\b/i,
      tab: 'history',
      reply: 'Main history section khol raha hoon taaki aap purane results dekh sako.',
    },
    {
      pattern: /\b(profile|account|avatar|mera profile|account kholo)\b/i,
      tab: 'profile',
      reply: 'Main profile section khol raha hoon.',
    },
    {
      pattern: /\b(community|explore creators|public feed|gallery dashboard|community kholo)\b/i,
      tab: 'community',
      reply: 'Main community section khol raha hoon.',
    },
    {
      pattern: /\b(generate|create media|studio|generator|image generator|media studio)\b/i,
      tab: 'generate',
      reply: 'Main generate section khol raha hoon.',
    },
  ];

  for (const config of dashboardTabConfigs) {
    if (config.pattern.test(normalizedPrompt)) {
      return {
        type: 'dashboard-tab',
        route: '/dashboard',
        tab: config.tab,
        requiresAuth: true,
        reply: config.reply,
      };
    }
  }

  const routeConfigs = [
    {
      pattern: /\b(explore|gallery|public gallery|explore kholo|gallery kholo)\b/i,
      route: '/explore',
      reply: 'Main Explore page khol raha hoon.',
    },
    {
      pattern: /\b(login|sign in)\b/i,
      route: '/login',
      reply: 'Main login page khol raha hoon.',
    },
    {
      pattern: /\b(sign up|signup|register)\b/i,
      route: '/signup',
      reply: 'Main signup page khol raha hoon.',
    },
    {
      pattern: /\b(forgot password|reset password)\b/i,
      route: '/forgot-password',
      reply: 'Main forgot password page khol raha hoon.',
    },
    {
      pattern: /\b(home|landing|home kholo)\b/i,
      route: '/',
      reply: 'Main home page khol raha hoon.',
    },
  ];

  for (const config of routeConfigs) {
    if (config.pattern.test(normalizedPrompt)) {
      return {
        type: 'navigate-route',
        route: config.route,
        reply: config.reply,
      };
    }
  }

  if (compactPrompt.includes('dashboard')) {
    return {
      type: 'navigate-route',
      route: '/dashboard',
      requiresAuth: true,
      reply: 'Main dashboard khol raha hoon.',
    };
  }

  return null;
};

const getSpeechRecognitionConstructor = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

const getPageContext = (pathname) => {
  if (pathname === '/') {
    return {
      path: pathname,
      title: 'Landing page',
      summary: 'Platform overview with hero section, feature highlights, and login or signup links.',
    };
  }

  if (pathname === '/explore') {
    return {
      path: pathname,
      title: 'Explore gallery',
      summary: 'Public creator gallery with image search, creator discovery, and sharing actions.',
    };
  }

  if (pathname === '/login') {
    return {
      path: pathname,
      title: 'Login',
      summary: 'Existing users can sign in and reach the protected dashboard.',
    };
  }

  if (pathname === '/signup') {
    return {
      path: pathname,
      title: 'Signup',
      summary: 'New users can create an account and access the creator studio.',
    };
  }

  if (pathname === '/forgot-password') {
    return {
      path: pathname,
      title: 'Forgot password',
      summary: 'Password reset flow with verification code support.',
    };
  }

  if (pathname === '/dashboard') {
    return {
      path: pathname,
      title: 'Creator dashboard',
      summary: 'Protected studio with generate, history, community, and profile sections.',
    };
  }

  if (pathname.startsWith('/users/')) {
    return {
      path: pathname,
      title: 'Public profile',
      summary: 'Public creator profile and public gallery view.',
    };
  }

  return {
    path: pathname,
    title: 'Current page',
    summary: 'The user is navigating within the Nova Canvas website.',
  };
};

const monitorStreamLevel = (stream, onLevel) => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass || !stream) {
    return () => {};
  }

  const audioContext = new AudioContextClass();
  const analyser = audioContext.createAnalyser();
  const source = audioContext.createMediaStreamSource(stream);
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  let frameId = 0;

  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.72;

  source.connect(analyser);

  const tick = () => {
    analyser.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((sum, value) => sum + value, 0) / (dataArray.length || 1);
    onLevel(Math.min(1, average / 135));
    frameId = window.requestAnimationFrame(tick);
  };

  tick();

  return () => {
    if (frameId) {
      window.cancelAnimationFrame(frameId);
    }
    onLevel(0);
    try {
      source.disconnect();
      analyser.disconnect();
    } catch (error) {
      // Ignore cleanup disconnect errors.
    }
    audioContext.close().catch(() => {});
  };
};

const extractEventTranscript = (event) => {
  if (!event || typeof event !== 'object') {
    return '';
  }

  return (
    event.transcript ||
    event.text ||
    event.delta ||
    event.item?.content?.[0]?.transcript ||
    event.item?.content?.[0]?.text ||
    event.response?.output?.[0]?.content?.[0]?.transcript ||
    ''
  );
};

const AiHelpperWidget = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = useAuth();
  const assistantClientId = useMemo(() => getOrCreateHelperClientId(), []);
  const initialMessages = useMemo(() => getStoredMessages(), []);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [assistantStatus, setAssistantStatus] = useState(null);
  const [panelError, setPanelError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [voiceRepliesEnabled, setVoiceRepliesEnabled] = useState(false);
  const [allowBackgroundInteraction, setAllowBackgroundInteraction] = useState(getStoredBackgroundInteraction);
  const [isVoiceReplyLoading, setIsVoiceReplyLoading] = useState(false);
  const [liveState, setLiveState] = useState('idle');
  const [liveNote, setLiveNote] = useState('Live talk band hai.');
  const [liveEngine, setLiveEngine] = useState('none');
  const [micLevel, setMicLevel] = useState(0);
  const [speakerLevel, setSpeakerLevel] = useState(0);
  const [panelFrame, setPanelFrame] = useState(getStoredPanelFrame);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isCallMode, setIsCallMode] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesRef = useRef(initialMessages);
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const micStreamRef = useRef(null);
  const liveAudioRef = useRef(null);
  const speechAudioRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const stopMicMonitorRef = useRef(() => {});
  const stopSpeakerMonitorRef = useRef(() => {});
  const latestAssistantReplyRef = useRef('');
  const liveEngineRef = useRef('none');
  const browserLiveActiveRef = useRef(false);
  const browserReplyPendingRef = useRef(false);
  const browserRestartTimerRef = useRef(null);
  const dragStateRef = useRef(null);
  const resizeStateRef = useRef(null);

  const pageContext = useMemo(() => getPageContext(location.pathname), [location.pathname]);

  const openAiLiveSupportedInBrowser = typeof window !== 'undefined'
    && Boolean(window.RTCPeerConnection)
    && Boolean(navigator.mediaDevices?.getUserMedia);
  const browserLiveSupported = typeof window !== 'undefined'
    && Boolean(getSpeechRecognitionConstructor());
  const browserSpeechSupported = typeof window !== 'undefined'
    && Boolean(window.speechSynthesis);

  const avatarMode = useMemo(() => {
    if (speakerLevel > 0.14 || isVoiceReplyLoading) {
      return 'speaking';
    }

    if (liveState === 'connecting' || liveState === 'thinking' || isSending) {
      return 'thinking';
    }

    if (liveState === 'active' || micLevel > 0.08) {
      return 'listening';
    }

    return 'calm';
  }, [isSending, isVoiceReplyLoading, liveState, micLevel, speakerLevel]);

   const panelStyle = useMemo(() => {
     const nextFrame = sanitizePanelFrame(panelFrame);

     return {
       width: isMaximized ? '100vw' : `${nextFrame.width}px`,
       height: isMaximized ? '100vh' : `${nextFrame.height}px`,
       left: isMaximized ? 0 : `${nextFrame.x}px`,
       top: isMaximized ? 0 : `${nextFrame.y}px`,
       right: isMaximized ? 'auto' : 'auto',
       bottom: isMaximized ? 'auto' : 'auto',
     };
   }, [panelFrame, isMaximized]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, liveNote, isOpen]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedMessages = messages
      .map((message) => sanitizeStoredMessage(message))
      .filter(Boolean)
      .slice(-MAX_CHAT_HISTORY_MESSAGES);

    window.localStorage.setItem(
      CHAT_HISTORY_STORAGE_KEY,
      JSON.stringify(storedMessages)
    );
  }, [messages]);

  useEffect(() => {
    liveEngineRef.current = liveEngine;
  }, [liveEngine]);

  useEffect(() => {
    let isCancelled = false;

    const fetchStatus = async () => {
      try {
        const response = await fetch(apiUrl('/api/assistant/status'), {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || 'Could not load assistant status');
        }

        if (!isCancelled) {
          setAssistantStatus(data.assistant || null);
        }
      } catch (error) {
        if (!isCancelled) {
          setAssistantStatus(null);
        }
      }
    };

    fetchStatus();

    return () => {
      isCancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    if (isOpen && !allowBackgroundInteraction) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = previousOverflow;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [allowBackgroundInteraction, isOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      BACKGROUND_MODE_STORAGE_KEY,
      String(allowBackgroundInteraction)
    );
  }, [allowBackgroundInteraction]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleResize = () => {
      setPanelFrame((currentFrame) => sanitizePanelFrame(currentFrame));
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      PANEL_FRAME_STORAGE_KEY,
      JSON.stringify(sanitizePanelFrame(panelFrame))
    );
  }, [panelFrame]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const clearPointerState = () => {
      dragStateRef.current = null;
      resizeStateRef.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    const handlePointerMove = (event) => {
      if (dragStateRef.current) {
        const { startX, startY, originX, originY } = dragStateRef.current;
        event.preventDefault();
        setPanelFrame((currentFrame) =>
          sanitizePanelFrame({
            ...(currentFrame || {}),
            x: originX + (event.clientX - startX),
            y: originY + (event.clientY - startY),
          })
        );
      }

      if (resizeStateRef.current) {
        const { startX, startY, startWidth, startHeight } = resizeStateRef.current;
        event.preventDefault();
        setPanelFrame((currentFrame) =>
          sanitizePanelFrame({
            ...(currentFrame || {}),
            width: startWidth + (event.clientX - startX),
            height: startHeight + (event.clientY - startY),
          })
        );
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', clearPointerState);
    window.addEventListener('pointercancel', clearPointerState);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', clearPointerState);
      window.removeEventListener('pointercancel', clearPointerState);
      clearPointerState();
    };
  }, []);

  useEffect(() => () => {
    if (speechAudioRef.current) {
      speechAudioRef.current.pause();
      speechAudioRef.current = null;
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (browserRestartTimerRef.current) {
      window.clearTimeout(browserRestartTimerRef.current);
      browserRestartTimerRef.current = null;
    }

    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.onstart = null;
      speechRecognitionRef.current.onresult = null;
      speechRecognitionRef.current.onerror = null;
      speechRecognitionRef.current.onend = null;
      try {
        speechRecognitionRef.current.stop();
      } catch (error) {
        // Ignore cleanup stop errors.
      }
      speechRecognitionRef.current = null;
    }

    if (liveAudioRef.current) {
      liveAudioRef.current.pause();
      liveAudioRef.current.srcObject = null;
      liveAudioRef.current = null;
    }

    dataChannelRef.current?.close();
    peerConnectionRef.current?.close();

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    stopMicMonitorRef.current?.();
    stopSpeakerMonitorRef.current?.();
  }, []);

  const clearBrowserRestartTimer = () => {
    if (browserRestartTimerRef.current) {
      window.clearTimeout(browserRestartTimerRef.current);
      browserRestartTimerRef.current = null;
    }
  };

  const stopTextReplyAudio = () => {
    if (speechAudioRef.current) {
      speechAudioRef.current.pause();
      speechAudioRef.current.currentTime = 0;
      speechAudioRef.current = null;
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setIsVoiceReplyLoading(false);
  };

  const pickBrowserVoice = () => {
    if (!browserSpeechSupported) {
      return null;
    }

    const voices = window.speechSynthesis.getVoices();
    const preferredMatchers = [
      (voice) => /(google|microsoft|natural|neural|online|premium)/i.test(voice.name),
      (voice) => /hi[-_ ]?IN/i.test(voice.lang) && !/(default|basic|fast)/i.test(voice.name),
      (voice) => /en[-_ ]?IN/i.test(voice.lang) && /(female|natural|neural)/i.test(voice.name),
      (voice) => /en[-_ ]?IN/i.test(voice.lang),
      (voice) => /(female|natural|neural|premium|asha|default [a-z]+ female)/i.test(voice.name),
      (voice) => /^en/i.test(voice.lang) && /(female|natural|neural)/i.test(voice.name),
      (voice) => /^en/i.test(voice.lang),
    ];

    for (const matcher of preferredMatchers) {
      const match = voices.find(matcher);
      if (match) {
        return match;
      }
    }

    return voices[0] || null;
  };

  const speakWithBrowser = (text) =>
    new Promise((resolve) => {
      if (!browserSpeechSupported || typeof window.SpeechSynthesisUtterance === 'undefined') {
        resolve(false);
        return;
      }

      const utterance = new window.SpeechSynthesisUtterance(text);
      const selectedVoice = pickBrowserVoice();
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      } else {
        utterance.lang = navigator.language || 'en-IN';
      }
      utterance.rate = 0.92;
      utterance.pitch = 0.95;
      utterance.volume = 0.9;
      utterance.onstart = () => setIsVoiceReplyLoading(true);
      utterance.onend = () => {
        setIsVoiceReplyLoading(false);
        resolve(true);
      };
      utterance.onerror = () => {
        setIsVoiceReplyLoading(false);
        resolve(false);
      };

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });

  const shutdownLiveSession = ({ keepNote = true } = {}) => {
    dataChannelRef.current?.close();
    peerConnectionRef.current?.close();

    if (liveAudioRef.current) {
      liveAudioRef.current.pause();
      liveAudioRef.current.srcObject = null;
      liveAudioRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    dataChannelRef.current = null;
    peerConnectionRef.current = null;

    stopMicMonitorRef.current?.();
    stopSpeakerMonitorRef.current?.();
    stopMicMonitorRef.current = () => {};
    stopSpeakerMonitorRef.current = () => {};

    setMicLevel(0);
    setSpeakerLevel(0);
    setLiveState('idle');
    setLiveEngine('none');
    liveEngineRef.current = 'none';

    if (keepNote) {
      setLiveNote('Live talk band ho gaya.');
    }
  };

  const appendMessageIfNew = (role, content, extra = {}) => {
    const nextText = String(content || '').trim();
    if (!nextText) return;

    setMessages((currentMessages) => {
      const lastMessage = currentMessages[currentMessages.length - 1];
      if (lastMessage?.role === role && lastMessage?.content === nextText) {
        return currentMessages;
      }

      return [...currentMessages, createMessage(role, nextText, extra)];
    });
  };

  const playBrowserSpeechFallback = (text) => {
    void speakWithBrowser(text);
  };

  const beginPointerInteraction = (cursor) => {
    if (typeof document === 'undefined') {
      return;
    }

    document.body.style.userSelect = 'none';
    document.body.style.cursor = cursor;
  };

  const handlePanelDragStart = (event) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    const nextFrame = sanitizePanelFrame(panelFrame);
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: nextFrame.x,
      originY: nextFrame.y,
    };
    resizeStateRef.current = null;
    beginPointerInteraction('grabbing');
  };

  const handlePanelResizeStart = (event) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    const nextFrame = sanitizePanelFrame(panelFrame);
    resizeStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startWidth: nextFrame.width,
      startHeight: nextFrame.height,
    };
    dragStateRef.current = null;
    beginPointerInteraction('nwse-resize');
  };

  const rememberLiveNote = async (content) => {
    const note = String(content || '').trim();
    if (!note) {
      return;
    }

    try {
      await fetch(apiUrl('/api/assistant/remember'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {}),
        },
        body: JSON.stringify({
          content: note,
          assistantClientId,
        }),
      });
    } catch (error) {
      // Ignore background memory sync failures.
    }
  };

  const performLocalAssistantAction = async (action) => {
    if (!action) {
      return null;
    }

    setPanelError('');

    if (action.requiresAuth && !token) {
      navigate('/login');
      return 'Is command ko chalane ke liye login zaroori hai. Main aapko login page par le aaya hoon.';
    }

    if (action.route && location.pathname !== action.route) {
      navigate(action.route);
    }

    if (action.type === 'navigate-route') {
      return action.reply;
    }

    dispatchAssistantAction(action);
    return action.reply;
  };

  const playAssistantVoice = async (text) => {
    if (!text || liveState !== 'idle') {
      return;
    }

    stopTextReplyAudio();
    setIsVoiceReplyLoading(true);

    try {
      const response = await fetch(apiUrl('/api/assistant/speak'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {}),
        },
        body: JSON.stringify({ text }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Voice reply unavailable');
      }

      const audio = new Audio(`data:${data.contentType || 'audio/mpeg'};base64,${data.audioBase64}`);
      speechAudioRef.current = audio;
      audio.onended = () => {
        setIsVoiceReplyLoading(false);
        speechAudioRef.current = null;
      };
      audio.onerror = () => {
        setIsVoiceReplyLoading(false);
        speechAudioRef.current = null;
      };
      await audio.play();
    } catch (error) {
      setIsVoiceReplyLoading(false);
      playBrowserSpeechFallback(text);
    }
  };

  const sendConversation = async (conversationMessages, { speakReply = false } = {}) => {
    setIsSending(true);
    setPanelError('');

    try {
      const response = await fetch(apiUrl('/api/assistant/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {}),
        },
        body: JSON.stringify({
          messages: conversationMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          pageContext,
          assistantClientId,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'AI Helpper reply nahi mila');
      }

      latestAssistantReplyRef.current = data.reply || '';
      const assistantMessage = createMessage('assistant', data.reply || '', {
        provider: data.provider,
        model: data.model,
      });

      setMessages((currentMessages) => [...currentMessages, assistantMessage]);

      if (speakReply && data.reply) {
        await playAssistantVoice(data.reply);
      }

      return {
        reply: data.reply || '',
        provider: data.provider,
        model: data.model,
        assistantMessage,
      };
    } catch (error) {
      setPanelError(error.message || 'Message send nahi ho saka');
      return null;
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = async (event, forcedPrompt = '') => {
    event?.preventDefault();

    const prompt = (forcedPrompt || input).trim();
    if (!prompt || isSending) {
      return;
    }

    const userMessage = createMessage('user', prompt);
    const nextConversation = [
      ...messages,
      userMessage,
    ];

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setInput('');

    const localAction = parseLocalAssistantAction(prompt);
    if (localAction) {
      const actionReply = await performLocalAssistantAction(localAction);

      if (actionReply) {
        const assistantMessage = createMessage('assistant', actionReply, {
          source: 'local-action',
        });

        latestAssistantReplyRef.current = actionReply;
        messagesRef.current = [...nextConversation, assistantMessage];
        setMessages((currentMessages) => [...currentMessages, assistantMessage]);

        if (voiceRepliesEnabled && liveState === 'idle') {
          await playAssistantVoice(actionReply);
        }
      }

      return;
    }

    await sendConversation(nextConversation, {
      speakReply: voiceRepliesEnabled && liveState === 'idle',
    });
  };

  const stopBrowserLiveTalk = ({ resetEngine = true } = {}) => {
    browserLiveActiveRef.current = false;
    browserReplyPendingRef.current = false;
    clearBrowserRestartTimer();

    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.onstart = null;
      speechRecognitionRef.current.onresult = null;
      speechRecognitionRef.current.onerror = null;
      speechRecognitionRef.current.onend = null;
      try {
        speechRecognitionRef.current.stop();
      } catch (error) {
        // Ignore browser recognition stop errors.
      }
      speechRecognitionRef.current = null;
    }

    setMicLevel(0);
    if (resetEngine) {
      setLiveEngine('none');
      liveEngineRef.current = 'none';
    }
  };

  const scheduleBrowserRecognitionRestart = () => {
    if (!browserLiveActiveRef.current || liveEngineRef.current !== 'browser') {
      return;
    }

    clearBrowserRestartTimer();
    browserRestartTimerRef.current = window.setTimeout(() => {
      void startBrowserRecognition();
    }, 420);
  };

  const processBrowserTranscript = async (transcript) => {
    const prompt = String(transcript || '').trim();
    browserReplyPendingRef.current = true;

    if (!prompt) {
      browserReplyPendingRef.current = false;
      if (browserLiveActiveRef.current) {
        setLiveState('active');
        setLiveNote('Browser live talk active hai. Dobara boliye.');
        scheduleBrowserRecognitionRestart();
      }
      return;
    }

    const userMessage = createMessage('user', prompt, { source: 'browser-live' });
    const nextConversation = [...messagesRef.current, userMessage];
    messagesRef.current = nextConversation;
    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setLiveState('thinking');
    setLiveNote('Aapki baat samajh gaya, jawab la raha hoon...');

    const result = await sendConversation(nextConversation, { speakReply: false });
    if (result?.assistantMessage) {
      messagesRef.current = [...nextConversation, result.assistantMessage];
    }

    if (browserLiveActiveRef.current && result?.reply && browserSpeechSupported) {
      setLiveNote('Browser voice se jawab bol raha hoon...');
      await speakWithBrowser(result.reply);
    }

    browserReplyPendingRef.current = false;

    if (browserLiveActiveRef.current) {
      setLiveState('active');
      setLiveNote('Browser live talk active hai. Dobara boliye.');
      scheduleBrowserRecognitionRestart();
    }
  };

  const startBrowserRecognition = async ({ notice = '' } = {}) => {
    const SpeechRecognitionClass = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionClass) {
      setPanelError('Browser live talk ke liye Chrome ya Edge ka speech support chahiye.');
      return false;
    }

    stopTextReplyAudio();
    clearBrowserRestartTimer();
    setPanelError('');
    setLiveEngine('browser');
    liveEngineRef.current = 'browser';
    browserLiveActiveRef.current = true;
    browserReplyPendingRef.current = false;
    setSpeakerLevel(0);
    setMicLevel(0.12);
    setLiveState('connecting');
    setLiveNote(notice || 'Browser live talk start kar raha hoon...');

    try {
      const recognition = new SpeechRecognitionClass();
      let finalTranscript = '';
      let handledResult = false;
      const browserLanguage = typeof document !== 'undefined'
        ? document.documentElement?.lang || navigator.language || 'en-IN'
        : navigator.language || 'en-IN';

      recognition.lang = browserLanguage;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setLiveState('active');
        setMicLevel(0.22);
        setLiveNote('Browser live talk active hai. Aap bol sakte hain.');
      };

      recognition.onresult = (event) => {
        let interimTranscript = '';

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const segment = event.results[index][0]?.transcript || '';

          if (event.results[index].isFinal) {
            finalTranscript = `${finalTranscript} ${segment}`.trim();
          } else {
            interimTranscript = `${interimTranscript} ${segment}`.trim();
          }
        }

        if (interimTranscript) {
          setMicLevel(0.46);
          setLiveNote(`Sun raha hoon: ${interimTranscript}`);
        }

        if (!handledResult && finalTranscript) {
          handledResult = true;
          browserReplyPendingRef.current = true;
          setLiveState('thinking');
          setLiveNote('Aapki baat mil gayi. Jawab taiyar kar raha hoon...');
          try {
            recognition.stop();
          } catch (error) {
            // Ignore local stop errors.
          }
          void processBrowserTranscript(finalTranscript);
        }
      };

      recognition.onerror = (event) => {
        setMicLevel(0);

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          browserLiveActiveRef.current = false;
          browserReplyPendingRef.current = false;
          setLiveState('idle');
          setLiveEngine('none');
          liveEngineRef.current = 'none';
          setLiveNote('Live talk band hai.');
          setPanelError('Mic permission allow karni hogi taaki browser live talk chale.');
          return;
        }

        if (event.error !== 'aborted') {
          setPanelError('Browser live talk me temporary issue aaya. Dobara sunne ki koshish kar raha hoon.');
        }
      };

      recognition.onend = () => {
        speechRecognitionRef.current = null;
        setMicLevel(0);

        if (!browserLiveActiveRef.current || liveEngineRef.current !== 'browser') {
          return;
        }

        if (browserReplyPendingRef.current || handledResult) {
          return;
        }

        setLiveState('active');
        setLiveNote('Browser live talk active hai. Dobara boliye.');
        scheduleBrowserRecognitionRestart();
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
      return true;
    } catch (error) {
      stopBrowserLiveTalk();
      setLiveState('idle');
      setLiveNote('Live talk unavailable hai.');
      setPanelError(error.message || 'Browser live talk start nahi ho saka');
      return false;
    }
  };

  const handleLiveEvent = (rawData) => {
    try {
      const event = JSON.parse(rawData);
      const transcript = extractEventTranscript(event);

      if (event.type === 'input_audio_buffer.speech_started') {
        setLiveState('active');
        setLiveNote('Main sun raha hoon. Aap bol sakte hain.');
      }

      if (event.type === 'input_audio_buffer.speech_stopped') {
        setLiveState('thinking');
        setLiveNote('Soch raha hoon...');
      }

      if (event.type === 'response.created') {
        setLiveState('thinking');
        setLiveNote('Reply taiyar kar raha hoon...');
      }

      if (event.type === 'response.output_audio_transcript.done' && transcript) {
        appendMessageIfNew('assistant', transcript, { source: 'live' });
        latestAssistantReplyRef.current = transcript;
      }

      if (
        event.type === 'conversation.item.input_audio_transcription.completed'
        && transcript
      ) {
        appendMessageIfNew('user', transcript, { source: 'live' });
        void rememberLiveNote(transcript);
      }

      if (event.type === 'response.done') {
        setLiveState('active');
        setLiveNote('Live talk active hai. Dobara boliye.');
      }
    } catch (error) {
      // Ignore non-JSON data channel events.
    }
  };

  const startLiveTalk = async () => {
    setIsCallMode(true);
    
    if (liveState !== 'idle') {
      return;
    }

    // Authentication check - if no token, redirect to login
    if (!token) {
      setPanelError('Please log in to use live call feature.');
      navigate('/login');
      return;
    }

    if (!openAiLiveSupportedInBrowser && !browserLiveSupported) {
      setPanelError('Live talk ke liye Chrome ya Edge jaisa modern browser aur mic permission chahiye.');
      return;
    }

    if (!assistantStatus?.liveTalkReady || !openAiLiveSupportedInBrowser) {
      const browserStarted = await startBrowserRecognition({
        notice: assistantStatus?.liveTalkReady
          ? 'Cloud live unavailable hai, browser live mode use kar raha hoon...'
          : 'Cloud key ya quota unavailable hai, browser live mode use kar raha hoon...',
      });

      if (!browserStarted && !assistantStatus?.liveTalkReady) {
        setPanelError('Cloud live unavailable hai. Browser speech support ya mic permission chahiye.');
      }
      return;
    }

    stopTextReplyAudio();
    setPanelError('');
    setLiveEngine('openai');
    liveEngineRef.current = 'openai';
    setLiveState('connecting');
    setLiveNote('Mic connect kar raha hoon...');

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      micStreamRef.current = micStream;
      stopMicMonitorRef.current = monitorStreamLevel(micStream, setMicLevel);

      const peerConnection = new RTCPeerConnection();
      peerConnectionRef.current = peerConnection;

      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
          shutdownLiveSession({ keepNote: false });
        }
      };

      peerConnection.ontrack = (event) => {
        const remoteStream = event.streams[0];
        stopSpeakerMonitorRef.current?.();
        stopSpeakerMonitorRef.current = monitorStreamLevel(remoteStream, setSpeakerLevel);

        if (!liveAudioRef.current) {
          liveAudioRef.current = new Audio();
          liveAudioRef.current.autoplay = true;
          liveAudioRef.current.playsInline = true;
        }

        liveAudioRef.current.srcObject = remoteStream;
        liveAudioRef.current.play().catch(() => {});
      };

      micStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, micStream);
      });

      const dataChannel = peerConnection.createDataChannel('oai-events');
      dataChannelRef.current = dataChannel;

      dataChannel.onopen = () => {
        setLiveState('active');
        setLiveNote('Live talk active hai. Aap naturally baat kar sakte hain.');
      };

      dataChannel.onmessage = (event) => {
        handleLiveEvent(event.data);
      };

      dataChannel.onclose = () => {
        if (liveEngineRef.current === 'openai') {
          shutdownLiveSession({ keepNote: false });
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const response = await fetch(apiUrl('/api/assistant/live-session'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
          'X-Page-Context': JSON.stringify(pageContext),
          'X-Assistant-Client-Id': assistantClientId,
          ...(token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {}),
        },
        body: offer.sdp,
      });

      const responseText = await response.text();

      if (!response.ok) {
        let message = 'Live talk start nahi ho saka';

        try {
          const parsedError = JSON.parse(responseText);
          message = parsedError.error || message;
        } catch (error) {
          message = responseText || message;
        }

        throw new Error(message);
      }

      await peerConnection.setRemoteDescription({
        type: 'answer',
        sdp: responseText,
      });
    } catch (error) {
      shutdownLiveSession({ keepNote: false });
      const browserStarted = await startBrowserRecognition({
        notice: 'Cloud live connect nahi hua, browser live mode start kar raha hoon...',
      });

      if (!browserStarted) {
        setLiveNote('Live talk unavailable hai.');
        setPanelError(error.message || 'Live talk start nahi ho saka');
        return;
      }

      setPanelError(
        error.message
          ? `${error.message} Browser live mode use ho raha hai.`
          : 'Cloud live unavailable tha, isliye browser live mode use ho raha hai.'
      );
    }
  };

      peerConnection.ontrack = (event) => {
        const remoteStream = event.streams[0];
        stopSpeakerMonitorRef.current?.();
        stopSpeakerMonitorRef.current = monitorStreamLevel(remoteStream, setSpeakerLevel);

        if (!liveAudioRef.current) {
          liveAudioRef.current = new Audio();
          liveAudioRef.current.autoplay = true;
          liveAudioRef.current.playsInline = true;
        }

        liveAudioRef.current.srcObject = remoteStream;
        liveAudioRef.current.play().catch(() => {});
      };

      micStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, micStream);
      });

      const dataChannel = peerConnection.createDataChannel('oai-events');
      dataChannelRef.current = dataChannel;

      dataChannel.onopen = () => {
        setLiveState('active');
        setLiveNote('Live talk active hai. Aap naturally baat kar sakte hain.');
      };

      dataChannel.onmessage = (event) => {
        handleLiveEvent(event.data);
      };

      dataChannel.onclose = () => {
        if (liveEngineRef.current === 'openai') {
          shutdownLiveSession();
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const response = await fetch(apiUrl('/api/assistant/live-session'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
          'X-Page-Context': JSON.stringify(pageContext),
          'X-Assistant-Client-Id': assistantClientId,
          ...(token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {}),
        },
        body: offer.sdp,
      });

      const responseText = await response.text();

      if (!response.ok) {
        let message = 'Live talk start nahi ho saka';

        try {
          const parsedError = JSON.parse(responseText);
          message = parsedError.error || message;
        } catch (error) {
          message = responseText || message;
        }

        throw new Error(message);
      }

      await peerConnection.setRemoteDescription({
        type: 'answer',
        sdp: responseText,
      });
    } catch (error) {
      shutdownLiveSession({ keepNote: false });
      const browserStarted = await startBrowserRecognition({
        notice: 'Cloud live connect nahi hua, browser live mode start kar raha hoon...',
      });

      if (!browserStarted) {
        setLiveNote('Live talk unavailable hai.');
        setPanelError(error.message || 'Live talk start nahi ho saka');
        return;
      }

      setPanelError(
        error.message
          ? `${error.message} Browser live mode use ho raha hai.`
          : 'Cloud live unavailable tha, isliye browser live mode use ho raha hai.'
      );
    }
  };

  const stopLiveTalk = () => {
    stopTextReplyAudio();
    stopBrowserLiveTalk();
    shutdownLiveSession();
    setIsCallMode(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    stopTextReplyAudio();
    stopLiveTalk();
  };

  const handleClearHistory = () => {
    setMessages([WELCOME_MESSAGE]);
    messagesRef.current = [WELCOME_MESSAGE];
    latestAssistantReplyRef.current = '';
    setPanelError('');

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          className="ai-helpper-launcher"
          onClick={() => setIsOpen(true)}
          aria-label="Open AI Helpper"
        >
          <span className="launcher-orbit"></span>
          <Bot size={20} />
          <span>AI Helpper</span>
        </button>
      )}

      {isOpen && (
        <>
          {!allowBackgroundInteraction && (
            <button
              type="button"
              className="ai-helpper-overlay"
              onClick={handleClose}
              aria-label="Close AI Helpper overlay"
            />
          )}
           <aside
             className={`ai-helpper-panel ${isMaximized ? 'maximized' : ''}`}
             aria-label="AI Helpper panel"
             role="dialog"
             aria-modal={!allowBackgroundInteraction}
             style={panelStyle}
           >
            <header className="ai-helpper-header">
              <div className="ai-helpper-header-top">
                <div className="ai-helpper-badge">
                  <Sparkles size={14} />
                  AI Helpper
                </div>
                <div className="ai-helpper-header-actions">
                    <section className="ai-helpper-mode-row ai-helpper-mode-row--compact">
                        <button
                            type="button"
                            className={`mode-chip ${allowBackgroundInteraction ? 'active' : ''}`}
                            onClick={() => setAllowBackgroundInteraction(true)}
                        >
                            Background use on
                        </button>
                        <button
                            type="button"
                            className={`mode-chip ${!allowBackgroundInteraction ? 'active' : ''}`}
                            onClick={() => setAllowBackgroundInteraction(false)}
                        >
                            Background lock on
                        </button>
                    </section>

                    <button
                        type="button"
                        className="ai-helpper-ghost-action"
                        onClick={() => setIsMaximized(!isMaximized)}
                        aria-label={isMaximized ? 'Restore AI Helpper' : 'Maximize AI Helpper'}
                        title={isMaximized ? 'Restore AI Helpper' : 'Maximize AI Helpper'}
                    >
                        {isMaximized ? <Minimize size={18} /> : <Maximize size={18} />}
                    </button>



                    <button
                        type="button"
                        className="ai-helpper-ghost-action"
                        onClick={handleClearHistory}
                        aria-label="Clear saved chat history"
                        title="Clear saved chat history"
                    >
                        <Trash2 size={15} />
                        Clear history
                    </button>

                    <button
                        type="button"
                        className="ai-helpper-close"
                        onClick={handleClose}
                        aria-label="Close AI Helpper"
                    >
                        <X size={18} />
                    </button>
                </div>
              </div>

              <div
                className="ai-helpper-drag-bar"
                onPointerDown={handlePanelDragStart}
                role="presentation"
              >
                <div className="ai-helpper-header-copy">
                  <h2>Website guide + live talk</h2>
                  <p>{pageContext.title}</p>
                </div>
                <span className="ai-helpper-drag-note">Drag to move</span>
              </div>
            </header>


            

            <div className="ai-helpper-messages">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`ai-message ${message.role === 'assistant' ? 'assistant' : 'user'}`}
                >
                  <div className="ai-message-meta">
                    {message.role === 'assistant' ? (
                      <>
                        <Bot size={14} />
                        <span>AI Helpper</span>
                      </>
                    ) : (
                      <>
                        <MessageSquare size={14} />
                        <span>You</span>
                      </>
                    )}
                  </div>
                  <p>{message.content}</p>
                </article>
              ))}

              {isSending && (
                <div className="ai-message assistant pending">
                  <div className="ai-message-meta">
                    <Loader2 size={14} className="spin" />
                    <span>AI Helpper</span>
                  </div>
                  <p>Reply likh raha hoon...</p>
                </div>
              )}

              <div ref={messagesEndRef}></div>
            </div>

            {messages.length <= 2 && (
              <div className="ai-helpper-prompts">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="prompt-chip"
                    onClick={(event) => handleSubmit(event, prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {panelError && <div className="ai-helpper-error">{panelError}</div>}

             <form className="ai-helpper-composer" onSubmit={handleSubmit}>
               <textarea
                 value={input}
                 onChange={(event) => setInput(event.target.value)}
                 placeholder="Kuch bhi poochiye, ya command dijiye: 'explore kholo' ya 'cyber city image generate karo'"
                 rows={2}
                 disabled={isSending}
                 onKeyDown={(event) => {
                   if (event.key === 'Enter' && !event.shiftKey) {
                     event.preventDefault();
                     handleSubmit(event);
                   }
                 }}
               />

               <div className="composer-buttons">
                 <button
                   type="button"
                   className="composer-voice"
                   disabled={!latestAssistantReplyRef.current || isVoiceReplyLoading || liveState !== 'idle'}
                   onClick={() => playAssistantVoice(latestAssistantReplyRef.current)}
                   aria-label="Listen to AI response"
                   title="AI ka jawab suno (Listen to AI response)"
                 >
                   {isVoiceReplyLoading ? <Loader2 size={16} className="spin" /> : <Volume2 size={16} />}
                 </button>

                  <button
                    type="button"
                    className="composer-call"
                    onClick={startLiveTalk}
                    disabled={!token}
                    aria-label="Start video call"
                    title={!token ? "Login required for live call" : "Live video call"}
                  >
                    <Phone size={16} />
                  </button>

                 <button
                   type="submit"
                   className="composer-send"
                   disabled={!input.trim() || isSending}
                   aria-label="Send message"
                 >
                   <Send size={16} />
                 </button>
               </div>
             </form>

            <div
              className="ai-helpper-resize-handle"
              onPointerDown={handlePanelResizeStart}
              role="presentation"
              aria-hidden="true"
            >
              <span></span>
              <span></span>
              <span></span>
            </div>
           </aside>

           {isCallMode && (
             <div className="ai-call-overlay">
               <div className="ai-call-container">
                 <div className="ai-call-header">
                   <h3>Human Assistant Call</h3>
                   <button 
                     type="button" 
                     className="ai-call-close" 
                     onClick={() => setIsCallMode(false)}
                   >
                     <X size={24} />
                   </button>
                 </div>
                 
                 <div className="ai-call-avatar">
                   <div className="ai-call-person">
                     <div className="ai-call-face">
                       <div className="ai-call-eyes">
                         <div className="ai-call-eye"></div>
                         <div className="ai-call-eye"></div>
                       </div>
                       <div className="ai-call-mouth"></div>
                     </div>
                   </div>
                   <div className="ai-call-status">
                     <div className="ai-call-indicator live"></div>
                     <span>Live Call Active</span>
                   </div>
                 </div>
                 
                 <div className="ai-call-controls">
                   <button 
                     type="button" 
                     className="ai-call-button mic"
                     onClick={() => {}}
                   >
                     <Mic size={20} />
                   </button>
                   <button 
                     type="button" 
                     className="ai-call-button end"
                     onClick={() => setIsCallMode(false)}
                   >
                     <X size={20} />
                   </button>
                   <button 
                     type="button" 
                     className="ai-call-button speaker"
                     onClick={() => setVoiceRepliesEnabled(!voiceRepliesEnabled)}
                   >
                     {voiceRepliesEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                   </button>
                 </div>
                 
                 <div className="ai-call-info">
                   <p>Speak naturally. Your AI assistant will listen and respond verbally.</p>
                 </div>
               </div>
             </div>
           )}
         </>
       )}
     </>
   );
};

export default AiHelpperWidget;
