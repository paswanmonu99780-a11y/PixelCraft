require('dotenv').config({ path: './.env' });
const express = require('express');
const cors = require('cors');

console.log('Starting minimal server...');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  console.log('Health check requested');
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

// Test image generation endpoint
app.post('/api/image/generate', (req, res) => {
  console.log('Image generation requested');
  res.json({
    success: false,
    error: 'Image generation temporarily disabled for testing',
    message: 'Backend server is working, but image generation is disabled'
  });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`✅ Minimal server started on port ${PORT}`);
  console.log(`✅ Server address: ${server.address().address}:${server.address().port}`);
  console.log('Test endpoints:');
  console.log(`- Health: http://localhost:${PORT}/api/health`);
  console.log(`- Image gen: http://localhost:${PORT}/api/image/generate`);
}).on('error', (error) => {
  console.error('❌ Server failed to start:', error);
  process.exit(1);
});