const {
  ASSISTANT_NAME,
  createChatReply,
  createRealtimeSession,
  getAssistantStatus,
  rememberUserMemory,
  synthesizeSpeech,
  transcribeAudio,
} = require('../utils/assistantService');

const buildPageContext = (body = {}, headers = {}) => {
  const pageContext = body.pageContext && typeof body.pageContext === 'object' ? body.pageContext : {};

  return {
    path: pageContext.path || headers['x-page-path'] || '',
    title: pageContext.title || headers['x-page-title'] || '',
    summary: pageContext.summary || headers['x-page-summary'] || '',
  };
};

const buildAssistantClientContext = (body = {}, headers = {}) => ({
  assistantClientId:
    (typeof body?.assistantClientId === 'string' ? body.assistantClientId : headers['x-assistant-client-id'] || '')
      .trim()
      .slice(0, 120),
});

exports.getStatus = async (req, res) => {
  return res.json({
    assistant: getAssistantStatus(),
  });
};

exports.chat = async (req, res) => {
  try {
    const { messages = [] } = req.body || {};
    const { assistantClientId } = buildAssistantClientContext(req.body, req.headers);

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'A conversation with at least one message is required' });
    }

    const result = await createChatReply({
      messages,
      pageContext: buildPageContext(req.body, req.headers),
      userId: req.userId,
      assistantClientId,
    });

    return res.json({
      assistantName: ASSISTANT_NAME,
      reply: result.reply,
      provider: result.provider,
      model: result.model,
      contextSections: result.sections,
    });
  } catch (error) {
    console.error('Assistant chat error:', error);
    return res.status(error.status || 500).json({
      error: error.message || 'Assistant chat failed',
    });
  }
};

exports.createLiveSession = async (req, res) => {
  try {
    if (typeof req.body !== 'string' || !req.body.trim()) {
      return res.status(400).json({ error: 'Session SDP payload is required' });
    }

    const pageContextHeader = req.headers['x-page-context'];
    let pageContext = {};

    if (pageContextHeader) {
      try {
        pageContext = JSON.parse(pageContextHeader);
      } catch (error) {
        pageContext = {};
      }
    }

    const session = await createRealtimeSession({
      sdp: req.body,
      pageContext,
      userId: req.userId,
      assistantClientId: buildAssistantClientContext({}, req.headers).assistantClientId,
    });

    res.set('Content-Type', 'application/sdp');
    return res.send(session.sdpAnswer);
  } catch (error) {
    console.error('Assistant live session error:', error);
    return res.status(error.status || 500).json({
      error: error.message || 'Live session could not be created',
    });
  }
};

exports.speak = async (req, res) => {
  try {
    const speech = await synthesizeSpeech(req.body?.text);
    return res.json(speech);
  } catch (error) {
    console.error('Assistant speech error:', error);
    return res.status(error.status || 500).json({
      error: error.message || 'Speech generation failed',
    });
  }
};

exports.remember = async (req, res) => {
  try {
    const { assistantClientId } = buildAssistantClientContext(req.body, req.headers);
    const result = rememberUserMemory({
      content: req.body?.content,
      userId: req.userId,
      assistantClientId,
    });

    return res.json(result);
  } catch (error) {
    console.error('Assistant memory error:', error);
    return res.status(error.status || 500).json({
      error: error.message || 'Assistant memory could not be updated',
    });
  }
};

exports.transcribe = async (req, res) => {
  try {
    const transcription = await transcribeAudio({
      base64Audio: req.body?.audio,
      mimeType: req.body?.mimeType,
    });
    return res.json(transcription);
  } catch (error) {
    console.error('Assistant transcription error:', error);
    return res.status(error.status || 500).json({
      error: error.message || 'Audio transcription failed',
    });
  }
};
