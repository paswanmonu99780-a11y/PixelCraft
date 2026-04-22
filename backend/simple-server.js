require('dotenv').config({ path: './.env' });
const express = require('express');
const cors = require('cors');

console.log('Starting server without MongoDB...');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Test endpoints:`);
  console.log(`- Health: http://localhost:${PORT}/api/health`);
  console.log(`- Test: http://localhost:${PORT}/api/test`);
});