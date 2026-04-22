const http = require('http');

function testAPI() {
  const postData = JSON.stringify({
    messages: [{ role: 'user', content: 'Hello, how are you?' }]
  });

  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/assistant/chat',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log('✅ Response:', JSON.stringify(json, null, 2));
      } catch (e) {
        console.log('Raw response:', data);
      }
    });
  });

  req.on('error', (e) => {
    console.error('❌ Error:', e.message);
  });

  req.write(postData);
  req.end();
}

testAPI();