const express = require('express');
const cors = require('cors');
require('dotenv').config();

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

// Mock image generation for testing
app.post('/api/image/generate', (req, res) => {
  console.log('Image generation requested:', req.body);

  try {
    const { prompt, ratio, quality } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ 
        success: false, 
        error: 'Prompt is required' 
      });
    }

    // Simulate processing
    setTimeout(() => {
      res.json({
        success: true,
        image: {
          id: 'test-' + Date.now(),
          prompt: prompt,
          imageUrl: `https://via.placeholder.com/512x512/4CAF50/white?text=${encodeURIComponent(prompt.substring(0, 20))}`,
          ratio: ratio || '1:1',
          quality: quality || 'balanced',
          generatedAt: new Date().toISOString()
        },
        currentUser: {
          id: 'test-user',
          username: 'Test User',
          tokens: 999
        },
        message: 'Test image generated successfully!'
      });
    }, 1000);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Mock assistant chat
app.post('/api/assistant/chat', (req, res) => {
  const { messages } = req.body;
  const lastMessage = messages[messages.length - 1];
  
  let reply = 'Hello! I am your AI assistant. How can I help you today?';
  
  if (lastMessage.content.toLowerCase().includes('image')) {
    reply = 'I can help you generate images! Try clicking the "Generate Image" button.';
  } else if (lastMessage.content.toLowerCase().includes('hello') || lastMessage.content.toLowerCase().includes('namaste')) {
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
  console.log('✅ Ready for testing!');
});