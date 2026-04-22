const http = require('http');

console.log('Testing connection to backend on port 3001...');

const req = http.get('http://localhost:3001/api/health', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('✅ Backend responding!');
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (e) => {
  console.log('❌ Connection failed:', e.message);
  console.log('Backend may not be running on port 3001');
});

req.setTimeout(3000, () => {
  console.log('❌ Request timeout');
  req.destroy();
});