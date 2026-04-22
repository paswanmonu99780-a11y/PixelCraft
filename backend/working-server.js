const express = require('express');
const cors = require('cors');
require('dotenv').config();
const {
  generateImageWithHuggingFace,
  generateImageWithOpenAI,
} = require('./src/utils/imageGenerator');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    message: 'Backend server is working!'
  });
});

// Real image generation
app.post('/api/image/generate', async (req, res) => {
  console.log('Image generation requested:', req.body);

  try {
    const { prompt, ratio, quality, model = 'gpt-image-1' } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }

    const generationOptions = { ratio, quality };

    let sourceImageUrl;
    if (model === 'gpt-image-1') {
      sourceImageUrl = await generateImageWithOpenAI(prompt, generationOptions);
    } else {
      sourceImageUrl = await generateImageWithHuggingFace(prompt, generationOptions);
    }

    res.json({
      success: true,
      image: {
        id: 'img-' + Date.now(),
        prompt: prompt,
        imageUrl: sourceImageUrl,
        ratio: ratio || '1:1',
        quality: quality || 'balanced',
        model: model,
        generatedAt: new Date().toISOString()
      },
      currentUser: {
        id: 'test-user',
        username: 'Test User',
        tokens: 999
      },
      message: 'Image generated successfully!'
    });
  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate image'
    });
  }
});

// Assistant chat
app.post('/api/assistant/chat', (req, res) => {
  const { messages } = req.body;
  const lastMessage = messages[messages.length - 1];

  let reply = 'Hello! I am your AI assistant. How can I help you today?';

  if (lastMessage.content.toLowerCase().includes('image')) {
    reply = 'I can help you generate images! Try clicking the "Generate Image" button.';
  } else if (lastMessage.content.toLowerCase().includes('hello')) {
    reply = 'Namaste! मैं आपकी मदद करने के लिए यहाँ हूँ। आप क्या पूछना चाहते हैं?';
  }

  res.json({
    assistantName: 'AI Helper',
    reply: reply,
    provider: 'mock',
    model: 'test-model'
  });
});

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌐 Also accessible at http://127.0.0.1:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log('✅ Ready for testing with gpt-image-1 model!');
}).on('error', (error) => {
  console.error('❌ Server failed to start:', error);
  process.exit(1);
});