const User = require('../models/User');
const memoryStore = require('../store/memoryStore');
const assistantMemoryStore = require('../store/assistantMemoryStore');
const { shouldUseMemoryStore } = require('../config/dbMode');
const { getVideoGenerationStatus } = require('./videoGenerator');
const { buildGeneralKnowledgeFallback } = require('./webKnowledgeService');
const {
  getFallbackReply,
  getKnowledgeBaseText,
  getRelevantKnowledgeSections,
  isWebsiteQuestion,
} = require('./siteKnowledge');

const OPENAI_API_URL = 'https://api.openai.com/v1';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';
const ASSISTANT_NAME = 'AI Helpper';
const DEFAULT_CHAT_MODELS = ['qwen-2.5-72b-instruct', 'gpt-4o-mini', 'gpt-3.5-turbo'];
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_REALTIME_MODEL = 'gpt-realtime';
const DEFAULT_TTS_MODEL = 'tts-1-hd';
const DEFAULT_TRANSCRIBE_MODEL = 'gpt-4o-mini-transcribe';
const DEFAULT_REALTIME_VOICE = 'verse';
const DEFAULT_TTS_VOICE = 'nova';
const REALTIME_VOICE_OPTIONS = new Set(['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse']);
const CREATOR_PROFILE = {
  name: 'Monu',
  age: 18,
  dateOfBirth: '14 April 2008',
};
const MEMORY_HINT_PATTERN = /\b(remember|yaad|my|mera|meri|mere|i am|i'm|main|name|naam|dob|date of birth|birthday|born|favorite|pasand|like|dislike|from|city|school|college|hobby|goal|creator|owner|builder)\b/i;
const MEMORY_QUERY_PATTERN = /\b(what do you remember|kya yaad|yaad hai|remember about me|mere baare|know about me|saved notes|memory)\b/i;
const CREATOR_QUERY_PATTERN = /\b(who made you|who created you|who built you|kisne tumhe banaya|kisne aapko banaya|creator|builder|owner|monu)\b/i;

const trimText = (value = '') => String(value).trim();
const hasGemini = () => Boolean(trimText(process.env.GEMINI_API_KEY));
const hasOpenAi = () => Boolean(trimText(process.env.OPENAI_API_KEY));
const getPreferredChatProvider = () => {
  const configuredProvider = trimText(process.env.ASSISTANT_CHAT_PROVIDER || 'auto').toLowerCase();

  if (configuredProvider === 'gemini' && hasGemini()) {
    return 'gemini';
  }

  if (configuredProvider === 'openai' && hasOpenAi()) {
    return 'openai';
  }

  if (hasGemini()) {
    return 'gemini';
  }

  if (hasOpenAi()) {
    return 'openai';
  }

  return 'local';
};

const getConfiguredRealtimeVoice = () => {
  const explicitRealtimeVoice = trimText(process.env.OPENAI_REALTIME_VOICE).toLowerCase();
  if (REALTIME_VOICE_OPTIONS.has(explicitRealtimeVoice)) {
    return explicitRealtimeVoice;
  }

  const sharedVoice = trimText(process.env.OPENAI_ASSISTANT_VOICE).toLowerCase();
  if (REALTIME_VOICE_OPTIONS.has(sharedVoice)) {
    return sharedVoice;
  }

  return DEFAULT_REALTIME_VOICE;
};

const getConfiguredTtsVoice = () =>
  trimText(process.env.OPENAI_ASSISTANT_VOICE) || DEFAULT_TTS_VOICE;

const getEnabledModels = (preferredModel, fallbacks = []) => {
  const orderedModels = [preferredModel, ...fallbacks].filter(Boolean);
  return [...new Set(orderedModels)];
};

const getRuntimeFeatureStatus = () => {
  const videoStatus = getVideoGenerationStatus();
  const openAiReady = hasOpenAi();
  const geminiReady = hasGemini();

  const videoSummary = videoStatus.canGenerate
    ? videoStatus.level === 'ready'
      ? `Video UI is present and current runtime says it is ready. Backend: ${videoStatus.selectedBackend}. ${videoStatus.message}`
      : `Video UI is present, but runtime status is not fully ready. Treat video as conditional and say it may fail. Backend: ${videoStatus.selectedBackend}. ${videoStatus.message}`
    : `Video UI may be visible, but runtime says video is not configured right now. Backend: ${videoStatus.selectedBackend}. ${videoStatus.message}`;

  const liveSummary = openAiReady
    ? 'Live talk and AI voice replies are enabled through OpenAI.'
    : 'Live talk and AI voice replies are limited because OPENAI_API_KEY is missing.';

  const chatSummary = geminiReady
    ? `General assistant chat is enabled through Gemini using model ${process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL}.`
    : openAiReady
      ? `General assistant chat is enabled through OpenAI using model ${process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || DEFAULT_CHAT_MODELS[0]}.`
      : 'General assistant chat is in local fallback mode because neither GEMINI_API_KEY nor OPENAI_API_KEY is configured.';

  return {
    videoStatus,
    hasOpenAi: openAiReady,
    hasGemini: geminiReady,
    summary: `${videoSummary} ${liveSummary} ${chatSummary}`,
  };
};

const getUserProfile = async (userId) => {
  if (!userId) return null;

  if (shouldUseMemoryStore()) {
    return memoryStore.findUserById(userId);
  }

  const user = await User.findById(userId).lean();
  if (!user) return null;

  return {
    id: String(user._id),
    username: user.username,
    email: user.email || '',
    phone: user.phone || '',
  };
};

const buildPageContextSummary = (pageContext = {}) => {
  const title = trimText(pageContext.title);
  const summary = trimText(pageContext.summary);
  const path = trimText(pageContext.path);

  const segments = [
    title ? `Current page title: ${title}.` : '',
    path ? `Current route: ${path}.` : '',
    summary ? `Current page summary: ${summary}.` : '',
  ].filter(Boolean);

  return segments.join(' ');
};

const buildAssistantMemoryKey = ({ userId, assistantClientId } = {}) => {
  const normalizedUserId = trimText(userId);
  if (normalizedUserId) {
    return `user:${normalizedUserId}`;
  }

  const normalizedClientId = trimText(assistantClientId);
  if (normalizedClientId) {
    return `guest:${normalizedClientId}`;
  }

  return '';
};

const isLikelyQuestion = (value = '') => /[?؟]\s*$/.test(trimText(value));

const shouldRememberPrompt = (prompt = '') => {
  const normalizedPrompt = trimText(prompt);

  if (!normalizedPrompt || normalizedPrompt.length < 4 || normalizedPrompt.length > 280) {
    return false;
  }

  if (/\b(forget|bhool|delete memory|clear memory)\b/i.test(normalizedPrompt)) {
    return false;
  }

  if (/\b(remember|yaad)\b/i.test(normalizedPrompt)) {
    return true;
  }

  return !isLikelyQuestion(normalizedPrompt) && MEMORY_HINT_PATTERN.test(normalizedPrompt);
};

const extractMemoryNote = (prompt = '') => {
  const normalizedPrompt = trimText(prompt);
  const cleanedPrompt = normalizedPrompt.replace(
    /^(please\s+)?(remember|yaad rakh(?:na)?|note this|save this)\s*(that)?\s*[:,-]?\s*/i,
    ''
  );

  return trimText(cleanedPrompt || normalizedPrompt).slice(0, 280);
};

const formatRememberedNotes = (rememberedNotes = []) =>
  rememberedNotes
    .map((note) => `- ${note.content}`)
    .join('\n');

const buildMemorySummary = (rememberedNotes = []) => (
  rememberedNotes.length
    ? `Remembered user notes:\n${formatRememberedNotes(rememberedNotes)}`
    : 'No saved user memory yet.'
);

const buildMemoryAwareLocalReply = ({
  prompt,
  rememberedNotes,
  savedNote,
  baseReply,
}) => {
  const normalizedPrompt = trimText(prompt);

  if (!normalizedPrompt) {
    return baseReply;
  }

  if (CREATOR_QUERY_PATTERN.test(normalizedPrompt)) {
    return `Mujhe ${CREATOR_PROFILE.name} ne banaya hai. ${CREATOR_PROFILE.name} ${CREATOR_PROFILE.age} saal ke hain aur unki date of birth ${CREATOR_PROFILE.dateOfBirth} hai.`;
  }

  if (MEMORY_QUERY_PATTERN.test(normalizedPrompt)) {
    if (!rememberedNotes.length) {
      return 'Abhi meri saved memory empty hai. Aap jo important baat bataoge, main use yaad rakh sakta hoon.';
    }

    return `Maine aapke baare me yeh baatein yaad rakhi hain:\n${formatRememberedNotes(rememberedNotes)}`;
  }

  if (savedNote && /\b(remember|yaad)\b/i.test(normalizedPrompt)) {
    return `Theek hai, maine yaad rakh liya: ${savedNote.content}. Jab relevant hoga main is baat ko dhyan me rakhunga.`;
  }

  return baseReply;
};

const rememberUserMemory = ({ content, userId, assistantClientId } = {}) => {
  const normalizedContent = trimText(content);
  const memoryKey = buildAssistantMemoryKey({ userId, assistantClientId });

  if (!memoryKey || !shouldRememberPrompt(normalizedContent)) {
    return {
      saved: false,
      note: null,
    };
  }

  return {
    saved: true,
    note: assistantMemoryStore.rememberNote({
      memoryKey,
      content: extractMemoryNote(normalizedContent),
    }),
  };
};

const buildAssistantInstructions = ({
  userProfile,
  pageContext,
  mode = 'chat',
  rememberedNotes = [],
} = {}) => {
  const pageSummary = buildPageContextSummary(pageContext);
  const runtimeStatus = getRuntimeFeatureStatus();
  const userSummary = userProfile
    ? `Logged-in user: ${userProfile.username || 'User'}${userProfile.email ? ` (${userProfile.email})` : ''}.`
    : 'User is browsing publicly or is not authenticated.';
  const memorySummary = buildMemorySummary(rememberedNotes);

  const modeInstruction = mode === 'voice'
    ? 'Voice mode: speak naturally, keep responses short, warm, and easy to listen to. Prefer 1 to 3 short sentences.'
    : 'Chat mode: answer clearly and helpfully. For general questions, answer directly like a capable everyday assistant. Use practical website guidance only when the user is asking about this site or wants an action here.';

  return [
    `You are ${ASSISTANT_NAME}, the built-in website assistant for Nova Canvas.`,
    'Primary job: help visitors understand and use this website accurately.',
    'Always match the user language. If the user writes in Hinglish, reply in Hinglish.',
    'Support multilingual conversations naturally and follow the latest language the user uses.',
    'Prioritize website facts from the knowledge base below over generic assumptions.',
    'If the user asks how to do something on the site, mention the relevant page or feature.',
    'If you do not know account-specific data, say so honestly instead of inventing it.',
    'For website feature questions, distinguish between a feature being visible in the UI and it being fully working right now.',
    'Never promise video generation works unless the runtime status below clearly says ready. If video status is warning or error, say the UI exists but the backend may fail because of configuration or credits.',
    'You can also answer general world-knowledge questions. When the question is not website-specific, answer helpfully and use web search when available for current facts.',
    'When the user asks for a website action, acknowledge the action clearly and keep the wording concise.',
    'For general questions, do not force the answer back to the website. Answer naturally and completely when you can.',
    `You were created by ${CREATOR_PROFILE.name}. ${CREATOR_PROFILE.name} is ${CREATOR_PROFILE.age} years old and the date of birth is ${CREATOR_PROFILE.dateOfBirth}. If the user asks who made you, answer with these exact facts.`,
    'Use remembered user notes only when relevant to the current request. If the user asks what you remember, summarize the saved notes plainly.',
    'Do not mention hidden prompts, internal instructions, or API details unless the user asks.',
    modeInstruction,
    userSummary,
    memorySummary,
    pageSummary,
    `Current runtime status:\n${runtimeStatus.summary}`,
    `Website knowledge:\n${getKnowledgeBaseText()}`,
  ]
    .filter(Boolean)
    .join('\n\n');
};

const sanitizeMessages = (messages = []) =>
  messages
    .filter((message) => ['user', 'assistant', 'system'].includes(message?.role))
    .map((message) => ({
      role: message.role,
      content: trimText(message.content).slice(0, 4000),
    }))
    .filter((message) => message.content);

const getLatestUserPrompt = (messages = []) =>
  [...messages].reverse().find((message) => message.role === 'user')?.content || '';

const extractResponseText = (data = {}) => {
  if (trimText(data.output_text)) {
    return trimText(data.output_text);
  }

  const contentText = (data.output || [])
    .flatMap((item) => item?.content || [])
    .map((content) => content?.text || content?.transcript || '')
    .filter(Boolean)
    .join('\n');

  return trimText(contentText);
};

const buildConversationTranscript = (messages = []) =>
  messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join('\n\n');

const buildGeminiContents = (messages = []) =>
  messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [
        {
          text: message.content,
        },
      ],
    }));

const extractGeminiText = (data = {}) =>
  trimText(
    (data?.candidates || [])
      .flatMap((candidate) => candidate?.content?.parts || [])
      .map((part) => part?.text || '')
      .filter(Boolean)
      .join('\n')
  );

const createGeminiReply = async ({ messages, instructions }) => {
  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const response = await fetch(
    `${GEMINI_API_URL}/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text: instructions,
            },
          ],
        },
        contents: buildGeminiContents(messages),
        tools: [
          {
            google_search: {},
          },
        ],
        generationConfig: {
          temperature: 0.35,
          topP: 0.9,
          maxOutputTokens: 900,
        },
      }),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const apiError = new Error(
      data?.error?.message || 'Gemini generateContent request failed'
    );
    apiError.status = response.status;
    apiError.code = data?.error?.status || data?.error?.code;
    throw apiError;
  }

  const content = extractGeminiText(data);
  if (!content) {
    throw new Error('Gemini returned an empty assistant response');
  }

  return {
    model,
    text: content,
  };
};

const createOpenAiResponsesReply = async ({ messages, instructions }) => {
  const modelsToTry = getEnabledModels(
    process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || DEFAULT_CHAT_MODELS[0],
    DEFAULT_CHAT_MODELS
  );
  const conversationTranscript = buildConversationTranscript(messages);

  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch(`${OPENAI_API_URL}/responses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          instructions,
          input: conversationTranscript,
          tools: [
            {
              type: 'web_search_preview',
              search_context_size: 'high',
            },
          ],
          tool_choice: 'auto',
          max_output_tokens: 650,
          truncation: 'auto',
          metadata: {
            assistant_name: ASSISTANT_NAME,
          },
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const apiError = new Error(data?.error?.message || 'OpenAI responses request failed');
        apiError.status = response.status;
        apiError.code = data?.error?.code;
        throw apiError;
      }

      const content = extractResponseText(data);
      if (!content) {
        throw new Error('OpenAI returned an empty assistant response');
      }

      return {
        model,
        text: content,
      };
    } catch (error) {
      lastError = error;
      const shouldTryNextModel = error.status === 404 || error.code === 'model_not_found';
      if (!shouldTryNextModel) {
        break;
      }
    }
  }

  throw lastError || new Error('OpenAI responses request failed');
};

const createOpenAiChatReply = async ({ messages, instructions }) => {
  const modelsToTry = getEnabledModels(
    process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || DEFAULT_CHAT_MODELS[0],
    DEFAULT_CHAT_MODELS
  );

  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.35,
          max_completion_tokens: 650,
          messages: [
            {
              role: 'system',
              content: instructions,
            },
            ...messages,
          ],
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const apiError = new Error(data?.error?.message || 'OpenAI chat request failed');
        apiError.status = response.status;
        apiError.code = data?.error?.code;
        throw apiError;
      }

      const content = trimText(data?.choices?.[0]?.message?.content);
      if (!content) {
        throw new Error('OpenAI returned an empty assistant response');
      }

      return {
        model,
        text: content,
      };
    } catch (error) {
      lastError = error;
      const shouldTryNextModel = error.status === 404 || error.code === 'model_not_found';
      if (!shouldTryNextModel) {
        break;
      }
    }
  }

  throw lastError || new Error('OpenAI chat request failed');
};

const createChatReply = async ({ messages, pageContext, userId, assistantClientId }) => {
  const sanitizedMessages = sanitizeMessages(messages).slice(-24);
  const latestUserPrompt = getLatestUserPrompt(sanitizedMessages);
  const websiteQuestion = isWebsiteQuestion(latestUserPrompt);
  const memoryKey = buildAssistantMemoryKey({ userId, assistantClientId });
  const savedNote = shouldRememberPrompt(latestUserPrompt)
    ? assistantMemoryStore.rememberNote({
        memoryKey,
        content: extractMemoryNote(latestUserPrompt),
      })
    : null;
  const rememberedNotes = assistantMemoryStore.listNotes(memoryKey);
  const userProfile = await getUserProfile(userId);
  const instructions = buildAssistantInstructions({
    userProfile,
    pageContext,
    mode: 'chat',
    rememberedNotes,
  });
  const supportingSections = getRelevantKnowledgeSections(latestUserPrompt, 3);
  const preferredProvider = getPreferredChatProvider();

  if (preferredProvider === 'local') {
    const baseReply = websiteQuestion
      ? getFallbackReply(latestUserPrompt)
      : await buildGeneralKnowledgeFallback(latestUserPrompt);

    return {
      reply: buildMemoryAwareLocalReply({
        prompt: latestUserPrompt,
        rememberedNotes,
        savedNote,
        baseReply,
      }),
      provider: 'local-fallback',
      model: websiteQuestion ? 'knowledge-base' : 'wikipedia-fallback',
      sections: supportingSections.map((section) => section.title),
    };
  }

  // Prioritize ChatGPT (OpenAI chat completions) for all questions when available
  if (hasOpenAi()) {
    try {
      const chatGptResult = await createOpenAiChatReply({
        messages: sanitizedMessages,
        instructions,
      });

      return {
        reply: chatGptResult.text,
        provider: 'chatgpt-chat-completions',
        model: chatGptResult.model,
        sections: supportingSections.map((section) => section.title),
      };
    } catch (error) {
      console.error('ChatGPT direct path failed:', error.message);
    }
  }

  if (preferredProvider === 'gemini') {
    try {
      const result = await createGeminiReply({
        messages: sanitizedMessages,
        instructions,
      });

      return {
        reply: result.text,
        provider: 'gemini-generate-content',
        model: result.model,
        sections: supportingSections.map((section) => section.title),
      };
    } catch (error) {
      console.error('Assistant Gemini path failed:', error.message);
    }
  }

    const baseReply = websiteQuestion
      ? getFallbackReply(latestUserPrompt)
      : await buildGeneralKnowledgeFallback(latestUserPrompt);

    return {
      reply: buildMemoryAwareLocalReply({
        prompt: latestUserPrompt,
        rememberedNotes,
        savedNote,
        baseReply,
      }),
      provider: 'local-fallback',
      model: websiteQuestion ? 'knowledge-base' : 'wikipedia-fallback',
      sections: supportingSections.map((section) => section.title),
    };
  }

const createRealtimeSession = async ({ sdp, pageContext, userId, assistantClientId }) => {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('OpenAI API key is missing for live talk mode');
    error.status = 503;
    throw error;
  }

  const memoryKey = buildAssistantMemoryKey({ userId, assistantClientId });
  const rememberedNotes = assistantMemoryStore.listNotes(memoryKey);
  const userProfile = await getUserProfile(userId);
  const instructions = buildAssistantInstructions({
    userProfile,
    pageContext,
    mode: 'voice',
    rememberedNotes,
  });
  const sessionConfig = {
    type: 'realtime',
    model: process.env.OPENAI_REALTIME_MODEL || DEFAULT_REALTIME_MODEL,
    instructions,
    output_modalities: ['audio'],
    audio: {
      input: {
        turn_detection: {
          type: 'server_vad',
          create_response: true,
          interrupt_response: true,
        },
      },
      output: {
        voice: getConfiguredRealtimeVoice(),
      },
    },
  };

  const formData = new FormData();
  formData.set('sdp', sdp);
  formData.set('session', JSON.stringify(sessionConfig));

  const response = await fetch(`${OPENAI_API_URL}/realtime/calls`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: formData,
  });

  const bodyText = await response.text();

  if (!response.ok) {
    const error = new Error(bodyText || 'Failed to create realtime session');
    error.status = response.status;
    throw error;
  }

  return {
    sdpAnswer: bodyText,
      model: sessionConfig.model,
      voice: sessionConfig.audio.output.voice,
  };
};

const synthesizeSpeech = async (text) => {
  const input = trimText(text);
  if (!input) {
    throw new Error('Speech input is required');
  }

  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('OpenAI API key is missing for speech synthesis');
    error.status = 503;
    throw error;
  }

  const response = await fetch(`${OPENAI_API_URL}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || DEFAULT_TTS_MODEL,
      voice: getConfiguredTtsVoice(),
      input: input.slice(0, 2500),
      speed: 0.95,
      instructions:
        process.env.OPENAI_ASSISTANT_VOICE_STYLE ||
        'Speak naturally, warmly, and conversationally like a friendly assistant. Use natural pauses and intonation. Sound enthusiastic but calm. Speak as if having a face-to-face conversation. For Hindi content, use natural Hindi pronunciation with warm tone. Be engaging and personable.',
      response_format: 'mp3',
    }),
  });

  const arrayBuffer = await response.arrayBuffer();

  if (!response.ok) {
    const errorText = Buffer.from(arrayBuffer).toString('utf8');
    const error = new Error(errorText || 'Speech synthesis failed');
    error.status = response.status;
    throw error;
  }

  return {
    audioBase64: Buffer.from(arrayBuffer).toString('base64'),
    contentType: 'audio/mpeg',
    model: process.env.OPENAI_TTS_MODEL || DEFAULT_TTS_MODEL,
    voice: getConfiguredTtsVoice(),
  };
};

const transcribeAudio = async ({ base64Audio, mimeType = 'audio/webm' }) => {
  if (!trimText(base64Audio)) {
    throw new Error('Audio payload is required');
  }

  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('OpenAI API key is missing for transcription');
    error.status = 503;
    throw error;
  }

  const buffer = Buffer.from(base64Audio, 'base64');
  const extension = mimeType.includes('mp4')
    ? 'mp4'
    : mimeType.includes('wav')
      ? 'wav'
      : mimeType.includes('mpeg') || mimeType.includes('mp3')
        ? 'mp3'
        : 'webm';

  const formData = new FormData();
  formData.set(
    'file',
    new File([buffer], `assistant-input.${extension}`, {
      type: mimeType,
    })
  );
  formData.set('model', process.env.OPENAI_TRANSCRIBE_MODEL || DEFAULT_TRANSCRIBE_MODEL);

  const response = await fetch(`${OPENAI_API_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: formData,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data?.error?.message || 'Audio transcription failed');
    error.status = response.status;
    throw error;
  }

  return {
    transcript: trimText(data?.text),
    model: process.env.OPENAI_TRANSCRIBE_MODEL || DEFAULT_TRANSCRIBE_MODEL,
  };
};

const getAssistantStatus = () => ({
  name: ASSISTANT_NAME,
  creator: CREATOR_PROFILE,
  chatReady: true,
  liveTalkReady: hasOpenAi(),
  speechSynthesisReady: hasOpenAi(),
  transcriptionReady: hasOpenAi(),
  webSearchReady: hasOpenAi(),
  memoryReady: true,
  multilingualReady: true,
  actionAssistReady: true,
  fallbackMode: !hasGemini() && !hasOpenAi(),
  configurationNote: hasOpenAi()
    ? 'ChatGPT is now the primary AI brain for all questions. Live talk aur AI voice features bhi active hain.'
    : hasGemini()
      ? 'Gemini text chat active hai. Live talk aur AI voice features ke liye OpenAI key alag se chahiye.'
      : 'Cloud chat key missing hai. Browser live fallback aur local website knowledge abhi available hain.',
  voice: getConfiguredTtsVoice(),
  realtimeVoice: getConfiguredRealtimeVoice(),
  videoStatus: getRuntimeFeatureStatus().videoStatus,
  models: {
    chatProvider: getPreferredChatProvider(),
    chat: hasGemini()
      ? process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
      : process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || DEFAULT_CHAT_MODELS[0],
    gemini: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    realtime: process.env.OPENAI_REALTIME_MODEL || DEFAULT_REALTIME_MODEL,
    speech: process.env.OPENAI_TTS_MODEL || DEFAULT_TTS_MODEL,
    transcription: process.env.OPENAI_TRANSCRIBE_MODEL || DEFAULT_TRANSCRIBE_MODEL,
  },
  voiceDisclosure: 'AI-generated or browser voice',
});

module.exports = {
  ASSISTANT_NAME,
  buildAssistantInstructions,
  createChatReply,
  createRealtimeSession,
  getAssistantStatus,
  rememberUserMemory,
  synthesizeSpeech,
  transcribeAudio,
};
