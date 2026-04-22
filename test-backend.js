const http = require('http');

function testBackend() {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/health',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('✅ Backend is responding!');
      console.log('Response:', data);
    });
  });

  req.on('error', (e) => {
    console.error('❌ Backend not accessible:', e.message);
  });

  req.end();
}

testBackend();