const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000';

const testLogin = async () => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      identifier: 'demo@example.com',
      password: 'demo123',
    });

    console.log('Login successful:', response.data);
  } catch (error) {
    console.error('Login failed:', error.response?.data || error.message);
  }
};

const testSignup = async () => {
  try {
    // First send signup code
    const codeResponse = await axios.post(`${API_BASE_URL}/api/auth/send-signup-code`, {
      identifier: 'test@example.com',
    });
    console.log('Signup code sent:', codeResponse.data);

    // Then signup with code (assuming dev mode returns debug code)
    const signupResponse = await axios.post(`${API_BASE_URL}/api/auth/signup`, {
      username: 'testuser',
      identifier: 'test@example.com',
      password: 'test123',
      confirmPassword: 'test123',
      code: codeResponse.data.debugCode || '123456', // Use debug code or default
    });
    console.log('Signup successful:', signupResponse.data);
  } catch (error) {
    console.error('Signup failed:', error.response?.data || error.message);
  }
};

const runTests = async () => {
  console.log('Testing login with demo user...');
  await testLogin();

  console.log('\nTesting signup process...');
  await testSignup();
};

runTests();