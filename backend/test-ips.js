const http = require('http');

function testLocalhost() {
  console.log('Testing localhost:5000...');
  const req = http.get('http://localhost:5000/api/health', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('✅ localhost:5000 responding:', data);
    });
  });
  req.on('error', (e) => {
    console.log('❌ localhost:5000 error:', e.message);
  });
}

function test127() {
  console.log('Testing 127.0.0.1:5000...');
  const req = http.get('http://127.0.0.1:5000/api/health', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('✅ 127.0.0.1:5000 responding:', data);
    });
  });
  req.on('error', (e) => {
    console.log('❌ 127.0.0.1:5000 error:', e.message);
  });
}

setTimeout(testLocalhost, 1000);
setTimeout(test127, 2000);