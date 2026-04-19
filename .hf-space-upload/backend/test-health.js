const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000';

// Test health endpoint
const testHealth = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/health`);
    console.log('✅ Health check passed:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.response?.data || error.message);
    return false;
  }
};

// Test login
const testLogin = async () => {
  try {
    console.log('Testing login with demo@example.com / demo123');
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      identifier: 'demo@example.com',
      password: 'demo123'
    });

    console.log('✅ Login successful!');
    return response.data.token;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return null;
  }
};

const runTests = async () => {
  console.log('Testing server health...');
  const healthOk = await testHealth();

  if (healthOk) {
    console.log('\nTesting login...');
    await testLogin();
  }
};

runTests();