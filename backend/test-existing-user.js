const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000';

const testLogin = async () => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      identifier: 'monupaswan944@gmail.com',
      password: 'password123',
    });

    console.log('Login successful:', response.data);
    return response.data.token;
  } catch (error) {
    console.error('Login failed:', error.response?.data || error.message);
    return null;
  }
};

const testCallFeature = async (token) => {
  if (!token) {
    console.log('No token available, skipping call test');
    return;
  }

  try {
    console.log('Testing AI assistant with token...');
    const response = await axios.post(`${API_BASE_URL}/api/assistant/chat`, {
      messages: [{ role: 'user', content: 'Hello AI helper' }],
      pageContext: { path: '/', title: 'Home', summary: 'Testing page' },
      assistantClientId: 'test-client'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('AI response:', response.data.reply);
  } catch (error) {
    console.error('AI call failed:', error.response?.data || error.message);
  }
};

const runTests = async () => {
  console.log('Testing login...');
  const token = await testLogin();

  console.log('\nTesting AI assistant call...');
  await testCallFeature(token);
};

runTests();