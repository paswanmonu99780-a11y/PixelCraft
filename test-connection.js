const http = require('http');

function testConnection() {
  console.log('Testing connection to localhost:5000...');

  const options = {
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/health',
    method: 'GET',
    timeout: 5000
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('✅ Connection successful!');
      console.log('Status:', res.statusCode);
      console.log('Response:', data);
    });
  });

  req.on('timeout', () => {
    console.log('❌ Connection timeout');
    req.destroy();
  });

  req.on('error', (e) => {
    console.error('❌ Connection error:', e.message);
    console.log('Possible issues:');
    console.log('1. Backend server not running');
    console.log('2. Port 5000 is blocked');
    console.log('3. Firewall blocking connection');
  });

  req.end();
}

testConnection();