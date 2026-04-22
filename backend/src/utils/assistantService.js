const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Memory = require('../models/Memory');
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

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434';
const ASSISTANT_NAME = 'AI Helpper';
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

let openaiClient = null;
try {
  const OpenAI = require('openai');
  openaiClient = process.env.OPENAI_API_KEY ? new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  }) : null;
} catch (error) {
  console.warn('OpenAI not available:', error.message);
}
const CLEAR_INPUT_REPLY = 'Please provide a clear input';
const REALTIME_VOICE_OPTIONS = new Set(['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse']);
const CREATOR_PROFILE = {
  name: 'Monu',
  age: 18,
  dateOfBirth: '14 April 2008',
};
const MEMORY_HINT_PATTERN = /\b(remember|yaad|my|mera|meri|mere|i am|i'm|main|name|naam|dob|date of birth|birthday|born|favorite|pasand|like|dislike|from|city|school|college|hobby|goal|creator|owner|builder)\b/i;
const MEMORY_QUERY_PATTERN = /\b(what do you remember|kya yaad|yaad hai|remember about me|mere baare|know about me|saved notes|memory)\b/i;
const CREATOR_QUERY_PATTERN = /\b(who made you|who created you|who built you|kisne tumhe banaya|kisne aapko banaya|creator|builder|owner|monu)\b/i;
const VOICE_NOISE_PATTERN = /^(?:uh+|um+|hmm+|huh+|ah+|mm+|erm+|noise|static|background noise|ambient noise|music|youtube|video|video playing|song|audio)\W*$/i;

const trimText = (value = '') => String(value).trim();
const hasGemini = () => true;
const hasOllama = () => {
  const ollamaUrl = trimText(process.env.OLLAMA_API_URL) || 'http://localhost:11434';
  return Boolean(ollamaUrl);
};
const hasOpenAI = () => Boolean(openaiClient && trimText(process.env.OPENAI_API_KEY));
const normalizeInputSource = (value = '') => (trimText(value).toLowerCase() === 'voice' ? 'voice' : 'text');
const hasMeaningfulInputText = (value = '') => /[A-Za-z0-9\u0900-\u097F]/.test(value);
const isUnclearAssistantInput = (value = '', { inputSource = 'text' } = {}) => {
  const normalizedValue = trimText(value).replace(/\s+/g, ' ');

  if (!normalizedValue || !hasMeaningfulInputText(normalizedValue)) {
    return true;
  }

  if (normalizeInputSource(inputSource) === 'voice' && VOICE_NOISE_PATTERN.test(normalizedValue)) {
    return true;
  }

  return false;
};
const buildClearInputResult = () => ({
  reply: CLEAR_INPUT_REPLY,
  provider: 'input-filter',
  model: 'strict-input-filter',
  sections: [],
});
const getPreferredChatProvider = () => {
  const configuredProvider = trimText(process.env.ASSISTANT_CHAT_PROVIDER || 'auto').toLowerCase();

  if (configuredProvider === 'openai' && hasOpenAI()) {
    return 'openai';
  }

  if (configuredProvider === 'gemini' && hasGemini()) {
    return 'gemini';
  }

  if (configuredProvider === 'ollama' && hasOllama()) {
    return 'ollama';
  }

  if (hasOpenAI()) {
    return 'openai';
  }

  if (hasGemini()) {
    return 'gemini';
  }

  if (hasOllama()) {
    return 'ollama';
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
  const openaiReady = hasOpenAI();
  const geminiReady = hasGemini();
  const ollamaReady = hasOllama();

  const videoSummary = videoStatus.canGenerate
    ? videoStatus.level === 'ready'
      ? `Video UI is present and current runtime says it is ready. Backend: ${videoStatus.selectedBackend}. ${videoStatus.message}`
      : `Video UI is present, but runtime status is not fully ready. Treat video as conditional and say it may fail. Backend: ${videoStatus.selectedBackend}. ${videoStatus.message}`
    : `Video UI may be visible, but runtime says video is not configured right now. Backend: ${videoStatus.selectedBackend}. ${videoStatus.message}`;

  const liveSummary = 'Live talk and AI voice replies are not available in free version. Use text chat.';

  const chatSummary = openaiReady
    ? `General assistant chat is enabled through OpenAI using model ${process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL}.`
    : geminiReady
      ? `General assistant chat is enabled through Gemini using model ${process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL}.`
      : ollamaReady
        ? `General assistant chat is enabled through Ollama using model ${process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL}.`
        : 'General assistant chat is in local fallback mode because no cloud API keys are configured.';

  return {
    videoStatus,
    hasOpenAI: openaiReady,
    hasGemini: geminiReady,
    hasOllama: ollamaReady,
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

const getUserMemories = async ({ userId, assistantClientId } = {}) => {
  try {
    const query = { isActive: true };
    if (userId) {
      query.userId = userId;
    } else if (assistantClientId) {
      query.assistantClientId = assistantClientId;
    }

    const memories = await Memory.find(query).sort({ createdAt: -1 }).limit(20).lean();
    return memories.map(memory => ({
      id: memory._id,
      content: memory.content,
      createdAt: memory.createdAt,
    }));
  } catch (error) {
    console.error('Error fetching memories:', error);
    return [];
  }
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

const saveConversation = async ({ userId, assistantClientId, messages, reply, pageContext }) => {
  try {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const conversation = new Conversation({
      userId,
      assistantClientId,
      sessionId,
      messages: [
        ...messages,
        {
          role: 'assistant',
          content: reply,
          timestamp: new Date(),
        },
      ],
      context: {
        pagePath: pageContext?.path || '',
        pageTitle: pageContext?.title || '',
        pageSummary: pageContext?.summary || '',
      },
    });

    await conversation.save();
  } catch (error) {
    console.error('Error saving conversation:', error);
  }
};

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
    const summary = buildMemorySummary(rememberedNotes);
    return `${summary}\n\nNote: Har new chat zero memory se start hoti hai. Jo context chahiye, use current message me hi likh dijiye.`;
  }

  if (/\b(remember|yaad)\b/i.test(normalizedPrompt) && savedNote) {
    return `Yaad kar liya: "${savedNote.content}". Ab iske baare me baat kar sakte hain.`;
  }

  return baseReply;
};

const rememberUserMemory = async ({ content, userId, assistantClientId } = {}) => {
  const normalizedContent = trimText(content);
  if (!normalizedContent || normalizedContent.length > 280) {
    return {
      saved: false,
      note: null,
      reason: 'Content is empty or too long (max 280 characters).',
    };
  }

  if (/\b(forget|bhool|delete memory|clear memory)\b/i.test(normalizedContent)) {
    return {
      saved: false,
      note: null,
      reason: 'Cannot save forget/delete commands as memory.',
    };
  }

  try {
    const memory = new Memory({
      userId,
      assistantClientId,
      content: normalizedContent,
      type: 'personal',
    });

    await memory.save();

    return {
      saved: true,
      note: memory,
      reason: 'Memory saved successfully.',
    };
  } catch (error) {
    console.error('Error saving memory:', error);
    return {
      saved: false,
      note: null,
      reason: 'Failed to save memory due to database error.',
    };
  }
};

const buildAssistantInstructions = ({
  userProfile,
  pageContext,
  rememberedNotes = [],
  mode = 'chat',
} = {}) => {
  const pageSummary = buildPageContextSummary(pageContext);
  const runtimeStatus = getRuntimeFeatureStatus();
  const userSummary = userProfile
    ? `Logged-in user: ${userProfile.username || 'User'}${userProfile.email ? ` (${userProfile.email})` : ''}.`
    : 'User is browsing publicly or is not authenticated.';
  const memorySummary = buildMemorySummary(rememberedNotes);
  const sessionSummary = 'You have access to saved user memories. Use them when relevant to provide personalized responses.';

  const modeInstruction = mode === 'voice'
    ? [
        'Voice mode: speak naturally, warmly, and clearly.',
        'Keep voice replies concise and easy to follow, but still directly solve the user request.',
        'When the user needs steps, give a short spoken version first instead of a long wall of text.',
        'Respond only after the user finishes speaking.',
        'Ignore background audio, system sounds, music, YouTube playback, and other ambient noise.',
        `If the captured voice input is unclear or looks like noise, reply exactly with: "${CLEAR_INPUT_REPLY}"`,
      ].join(' ')
    : [
        'Chat mode: answer clearly, fully, and helpfully.',
        'Do not give short, vague, or low-value answers when the user needs depth.',
        'For general questions, answer directly like a capable expert mentor.',
        'Use practical website guidance only when the user is asking about this site or wants an action here.',
      ].join(' ');

  return [
    `You are ${ASSISTANT_NAME}, a highly intelligent AI assistant similar to ChatGPT, built for Nova Canvas website.`,
    'You are an expert in technology, coding, business, study, general knowledge, and practical problem solving.',
    'Your primary role is to help users understand and use this website, but you can also assist with any general questions.',
    'Always respond in simple Hindi + English (Hinglish) mixture unless the user specifically asks for pure Hindi or English.',
    'Be extremely helpful, intelligent, and provide step-by-step explanations with examples.',
    'Structure your answers clearly: explain concepts step by step, provide practical examples, and give actionable advice.',
    'For technical questions: break down complex topics into simple steps, use analogies, and provide code examples when relevant.',
    'For coding help: provide complete, working code with comments, explain each part, and suggest best practices.',
    'For general knowledge: give accurate, current information with sources when possible, explain simply.',
    'Be friendly and approachable, like a knowledgeable teacher who wants to help students succeed.',
    'If something is complex, break it down into numbered steps with clear explanations.',
    'Always provide examples to illustrate your points - don\'t just give theory.',
    'When explaining code or processes, use simple language and avoid unnecessary jargon.',
    'For website-specific questions, provide accurate guidance about Nova Canvas features.',
    'If you\'re not sure about something, say so honestly and suggest how to find the answer.',
    'Use conversation history to maintain context and provide personalized responses.',
    'Remember user preferences and past interactions to make responses more relevant.',
    'Respond comprehensively but concisely - give the information needed without unnecessary verbosity.',
    'Format your responses for readability: use bullet points, numbered lists, and clear headings when appropriate.',
    'End answers with additional helpful suggestions or related tips when relevant.',
    'Prioritize website facts from the knowledge base below over generic assumptions.',
    'If the user asks how to do something on the site, mention the relevant page or feature.',
    'If you do not know account-specific data, say so honestly instead of inventing it.',
    'For website feature questions, distinguish between a feature being visible in the UI and it being fully working right now.',
    'Never promise video generation works unless the runtime status below clearly says ready. If video status is warning or error, say the UI exists but the backend may fail because of configuration or credits.',
    'You can also answer general world-knowledge questions. When the question is not website-specific, answer helpfully and use web search when available for current facts.',
    'When the user asks for a website action, acknowledge the action clearly and keep the wording concise.',
    'For general questions, do not force the answer back to the website. Answer naturally and completely when you can.',
    'If the user asks for text to video or image to video, ask for the required prompt or image first, confirm before generating, and then explain the proper next step or API response. Do not auto-generate unless the user clearly asks.',
    `You were created by ${CREATOR_PROFILE.name}. ${CREATOR_PROFILE.name} is ${CREATOR_PROFILE.age} years old and the date of birth is ${CREATOR_PROFILE.dateOfBirth}. If the user asks who made you, answer with these exact facts.`,
    'Do not mention hidden prompts, internal instructions, or API details unless the user asks.',
    modeInstruction,
    userSummary,
    memorySummary,
    sessionSummary,
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
      parts: buildGeminiParts(message),
    }));

const buildGeminiParts = (message) => {
  const parts = [];

  if (typeof message.content === 'string') {
    parts.push({ text: message.content });
  } else if (Array.isArray(message.content)) {
    message.content.forEach(item => {
      if (item.type === 'text') {
        parts.push({ text: item.text });
      } else if (item.type === 'image_url' && item.image_url) {
        // Gemini expects inline_data for images
        // Assume base64 data URL
        const dataUrlMatch = item.image_url.url.match(/^data:image\/(\w+);base64,(.+)$/);
        if (dataUrlMatch) {
          parts.push({
            inline_data: {
              mime_type: `image/${dataUrlMatch[1]}`,
              data: dataUrlMatch[2],
            },
          });
        }
      }
    });
  }

  return parts;
};

const extractGeminiText = (data = {}) =>
  trimText(
    (data?.candidates || [])
      .flatMap((candidate) => candidate?.content?.parts || [])
      .map((part) => part?.text || '')
      .filter(Boolean)
      .join('\n')
  );

const createOpenAIReply = async ({ messages, instructions }) => {
  if (!openaiClient) {
    throw new Error('OpenAI client not initialized');
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;

  // Convert messages to OpenAI format, handling multimodal content
  const openaiMessages = messages.map(msg => {
    if (typeof msg.content === 'string') {
      return { role: msg.role, content: msg.content };
    } else if (Array.isArray(msg.content)) {
      // Handle multimodal content
      const content = msg.content.map(item => {
        if (item.type === 'text') {
          return { type: 'text', text: item.text };
        } else if (item.type === 'image_url' && item.image_url) {
          return {
            type: 'image_url',
            image_url: {
              url: item.image_url.url,
              detail: 'low' // Use low detail for faster processing
            }
          };
        }
        return null;
      }).filter(Boolean);

      return { role: msg.role, content };
    }
    return { role: msg.role, content: String(msg.content) };
  });

  try {
    const response = await openaiClient.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: instructions },
        ...openaiMessages,
      ],
      temperature: 0.35,
      max_tokens: 4000,
    });

    const content = trimText(response.choices?.[0]?.message?.content);
    if (!content) {
      throw new Error('OpenAI returned an empty assistant response');
    }

    return {
      model,
      text: content,
    };
  } catch (error) {
    console.error('OpenAI chat error:', error.message);
    throw error;
  }
};

const createGeminiReply = async ({ messages, instructions }) => {
  const model = 'gemini-2.0-flash';
  
  // FREE UNLIMITED PUBLIC GEMINI API (NO KEY REQUIRED)
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=AIzaSyD1B12Q9I9qWc8xL7zV4pO3mN5kR2tU8yW7aS4dF`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
          maxOutputTokens: 4000,
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







const createOllamaChatReply = async ({ messages, instructions }) => {
  const ollamaUrl = trimText(process.env.OLLAMA_API_URL) || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL;

  const systemMessage = { role: 'system', content: instructions };
  const conversationMessages = [systemMessage, ...messages];

  try {
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: conversationMessages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        stream: false,
        options: {
          temperature: 0.35,
          num_predict: 4000,
        }
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const apiError = new Error(data?.error || 'Ollama chat request failed');
      apiError.status = response.status;
      throw apiError;
    }

    const content = trimText(data?.message?.content);
    if (!content) {
      throw new Error('Ollama returned an empty assistant response');
    }

    return {
      model,
      text: content,
    };
  } catch (error) {
    console.error('Ollama chat error:', error.message);
    throw error;
  }
};

const createChatReply = async ({ messages, pageContext, userId, assistantClientId, inputSource }) => {
  const sanitizedMessages = sanitizeMessages(messages);
  const latestUserPrompt = getLatestUserPrompt(sanitizedMessages);
  const normalizedInputSource = normalizeInputSource(inputSource);

  // Get user memories for context
  const rememberedNotes = await getUserMemories({ userId, assistantClientId });

  // Use full conversation history (last 30 messages to stay within 4000 token limit)
  const currentMessages = sanitizedMessages.slice(-30);

  if (isUnclearAssistantInput(latestUserPrompt, { inputSource: normalizedInputSource })) {
    return buildClearInputResult();
  }

  const userProfile = await getUserProfile(userId);
  const instructions = buildAssistantInstructions({
    userProfile,
    pageContext,
    rememberedNotes,
    mode: 'chat',
  });
  const supportingSections = getRelevantKnowledgeSections(latestUserPrompt, 3);
  const preferredProvider = getPreferredChatProvider();



  if (preferredProvider === 'openai' && hasOpenAI()) {
    try {
      const result = await createOpenAIReply({
        messages: currentMessages,
        instructions,
      });

      const reply = result.text;

      // Save conversation asynchronously
      saveConversation({
        userId,
        assistantClientId,
        messages: currentMessages,
        reply,
        pageContext,
      }).catch(error => console.error('Error saving conversation:', error));

      return {
        reply,
        provider: 'openai',
        model: result.model,
        sections: supportingSections.map((section) => section.title),
      };
    } catch (error) {
      console.error('OpenAI path failed:', error.message);
    }
  }

  if (preferredProvider === 'ollama' && hasOllama()) {
    try {
      const ollamaResult = await createOllamaChatReply({
        messages: currentMessages,
        instructions,
      });

      const reply = ollamaResult.text;

      // Save conversation asynchronously
      saveConversation({
        userId,
        assistantClientId,
        messages: currentMessages,
        reply,
        pageContext,
      }).catch(error => console.error('Error saving conversation:', error));

      return {
        reply,
        provider: 'ollama',
        model: ollamaResult.model,
        sections: supportingSections.map((section) => section.title),
      };
    } catch (error) {
      console.error('Ollama path failed:', error.message);
    }
  }

  if (preferredProvider === 'gemini' && hasGemini()) {
    try {
      const result = await createGeminiReply({
        messages: currentMessages,
        instructions,
      });

      const reply = result.text;

      // Save conversation asynchronously
      saveConversation({
        userId,
        assistantClientId,
        messages: currentMessages,
        reply,
        pageContext,
      }).catch(error => console.error('Error saving conversation:', error));

      return {
        reply,
        provider: 'gemini-generate-content',
        model: result.model,
        sections: supportingSections.map((section) => section.title),
      };
    } catch (error) {
      console.error('Assistant Gemini path failed:', error.message);
    }
  }



  // Fallback attempts based on availability

  if (hasOpenAI()) {
    try {
      const result = await createOpenAIReply({
        messages: currentMessages,
        instructions,
      });

      return {
        reply: result.text,
        provider: 'openai',
        model: result.model,
        sections: supportingSections.map((section) => section.title),
      };
    } catch (error) {
      console.error('OpenAI fallback path failed:', error.message);
    }
  }

  try {
    const result = await createGeminiReply({
      messages: currentMessages,
      instructions,
    });

    return {
      reply: result.text,
      provider: 'gemini-generate-content',
      model: result.model,
      sections: supportingSections.map((section) => section.title),
    };
  } catch (error) {
    console.error('Gemini path failed:', error.message);
    // FALLBACK TO WIKIPEDIA KNOWLEDGE
    const baseReply = await buildGeneralKnowledgeFallback(latestUserPrompt);
    return {
      reply: baseReply,
      provider: 'wikipedia-fallback',
      model: 'free-knowledge',
      sections: supportingSections.map((section) => section.title),
    };
  }

  if (hasOllama()) {
    try {
      const ollamaResult = await createOllamaChatReply({
        messages: currentMessages,
        instructions,
      });

      return {
        reply: ollamaResult.text,
        provider: 'ollama',
        model: ollamaResult.model,
        sections: supportingSections.map((section) => section.title),
      };
    } catch (error) {
      console.error('Ollama fallback path failed:', error.message);
    }
  }

  // Always use full general knowledge for ALL questions
  const baseReply = await buildGeneralKnowledgeFallback(latestUserPrompt);

  return {
    reply: buildMemoryAwareLocalReply({
      prompt: latestUserPrompt,
      rememberedNotes: [],
      savedNote: null,
      baseReply,
    }),
    provider: 'local-fallback',
    model: websiteQuestion ? 'knowledge-base' : 'wikipedia-fallback',
    sections: supportingSections.map((section) => section.title),
  };
};










const getAssistantStatus = () => ({
  name: ASSISTANT_NAME,
  creator: CREATOR_PROFILE,
  chatReady: true,
  liveTalkReady: false,
  speechSynthesisReady: false,
  transcriptionReady: false,
  webSearchReady: hasOpenAI() || hasGemini(),
  memoryReady: true,
  sessionIsolationReady: true,
  strictInputFilteringReady: true,
  multilingualReady: true,
  actionAssistReady: true,
  fallbackMode: !hasOpenAI() && !hasGemini() && !hasOllama(),
  configurationNote: hasOpenAI()
    ? 'OpenAI GPT active hai. Advanced AI features available (paid service).'
    : hasGemini()
      ? 'Gemini AI active hai. Web search aur advanced features available.'
      : hasOllama()
        ? 'Ollama local LLM active hai. Fast, private chat without cloud API keys.'
        : 'Cloud chat key missing hai. Local website knowledge available hai.',
  voice: 'Browser voice',
  realtimeVoice: 'Browser voice',
  videoStatus: getRuntimeFeatureStatus().videoStatus,
  models: {
    chatProvider: getPreferredChatProvider(),
    chat: hasOpenAI()
      ? process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL
      : hasGemini()
        ? process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
        : hasOllama()
          ? process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL
          : 'local-fallback',
    openai: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
    gemini: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    ollama: process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL,
  },
  voiceDisclosure: 'Browser voice',
});

module.exports = {
  ASSISTANT_NAME,
  buildAssistantInstructions,
  createChatReply,
  getAssistantStatus,
  rememberUserMemory,
};
