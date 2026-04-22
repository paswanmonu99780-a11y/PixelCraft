try {
  console.log('Starting main server with error catching...');
  require('./server.js');
} catch (error) {
  console.error('❌ Server startup error:', error.message);
  console.error('Stack:', error.stack);
}