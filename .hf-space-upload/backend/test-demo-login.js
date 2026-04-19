const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000';

const testLogin = async () => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      identifier: 'demo@example.com',
      password: 'demo123'
    });

    console.log('✅ Login successful!');
    console.log('Token preview:', response.data.token.substring(0, 50) + '...');
    return response.data.token;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return null;
  }
};

testLogin();