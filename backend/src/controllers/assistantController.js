const {
  ASSISTANT_NAME,
  createChatReply,
  getAssistantStatus,
  rememberUserMemory,
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

    // Handle image upload
    let processedMessages = messages;
    if (req.file) {
      // Convert uploaded image to base64 data URL
      const imageBuffer = req.file.buffer;
      const base64Image = imageBuffer.toString('base64');
      const dataUrl = `data:${req.file.mimetype};base64,${base64Image}`;

      // Add image to the last user message
      const lastMessage = processedMessages[processedMessages.length - 1];
      if (lastMessage && lastMessage.role === 'user') {
        if (typeof lastMessage.content === 'string') {
          lastMessage.content = [
            { type: 'text', text: lastMessage.content },
            { type: 'image_url', image_url: { url: dataUrl } }
          ];
        } else if (Array.isArray(lastMessage.content)) {
          lastMessage.content.push({ type: 'image_url', image_url: { url: dataUrl } });
        }
      }
    }

    const result = await createChatReply({
      messages: processedMessages,
      pageContext: buildPageContext(req.body, req.headers),
      userId: req.userId,
      assistantClientId,
      inputSource: req.body?.inputSource,
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
