const http = require('http');

console.log('Testing backend connection...');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/health',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('✅ Success! Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('timeout', () => {
  console.log('❌ Timeout after 5 seconds');
  req.destroy();
});

req.on('error', (e) => {
  console.log('❌ Connection error:', e.message);
  console.log('This means the server is not accessible from this process');
});

req.end();