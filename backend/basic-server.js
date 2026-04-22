const http = require('http');
const url = require('url');

console.log('Starting basic Node.js HTTP server...');

const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);

  if (req.url === '/api/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'Server is running',
      timestamp: new Date().toISOString(),
      message: 'Basic Node.js HTTP server working'
    }));
  } else if (req.url === '/api/image/generate' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: 'Image generation disabled',
      message: 'Server is working but image generation is disabled for testing'
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(8000, '127.0.0.1', () => {
  console.log('✅ Basic Node.js server listening on port 8000');
  console.log('✅ Server address: 127.0.0.1:8000');
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.close();
});