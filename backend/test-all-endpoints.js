const http = require('http');

console.log('Testing backend server...');
console.log('Testing multiple endpoints...\n');

const endpoints = [
  '/api/health',
  '/api/test',
  '/api/image/generate'
];

endpoints.forEach(endpoint => {
  const req = http.get(`http://localhost:5000${endpoint}`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log(`✅ ${endpoint}: ${res.statusCode} - ${data.substring(0, 100)}`);
    });
  });

  req.on('error', (e) => {
    console.log(`❌ ${endpoint}: ${e.message}`);
  });

  req.on('timeout', () => {
    console.log(`❌ ${endpoint}: Timeout`);
    req.destroy();
  });

  req.setTimeout(3000);
});