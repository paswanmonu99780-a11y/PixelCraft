const net = require('net');

function testPort() {
  console.log('Testing if port 5000 is open...');

  const client = new net.Socket();

  client.connect(5000, '127.0.0.1', () => {
    console.log('✅ Port 5000 is open and accepting connections');
    client.write('GET /api/health HTTP/1.1\r\nHost: localhost\r\n\r\n');
  });

  client.on('data', (data) => {
    console.log('✅ Received response:', data.toString());
    client.destroy();
  });

  client.on('error', (err) => {
    console.log('❌ Connection failed:', err.message);
  });

  client.on('timeout', () => {
    console.log('❌ Connection timeout');
    client.destroy();
  });

  setTimeout(() => {
    client.destroy();
  }, 5000);
}

testPort();