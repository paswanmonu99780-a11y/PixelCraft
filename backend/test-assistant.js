const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testAssistant() {
  console.log('🧪 Testing AI Assistant System\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing Health Check...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health Check:', healthResponse.data);

    // Test 2: Assistant Status
    console.log('\n2. Testing Assistant Status...');
    const statusResponse = await axios.get(`${BASE_URL}/assistant/status`);
    console.log('✅ Assistant Status:', JSON.stringify(statusResponse.data, null, 2));

    // Test 3: Basic Chat
    console.log('\n3. Testing Basic Chat...');
    const chatResponse = await axios.post(`${BASE_URL}/assistant/chat`, {
      messages: [{ role: 'user', content: 'Hello! Can you introduce yourself?' }]
    });
    console.log('✅ Chat Response:', chatResponse.data.reply.substring(0, 200) + '...');

    // Test 4: Code Generation
    console.log('\n4. Testing Code Generation...');
    const codeResponse = await axios.post(`${BASE_URL}/assistant/chat`, {
      messages: [{ role: 'user', content: 'Write a simple JavaScript function to check if a number is prime' }]
    });
    console.log('✅ Code Generation:', codeResponse.data.reply.substring(0, 300) + '...');

    // Test 5: Memory Test
    console.log('\n5. Testing Memory System...');
    await axios.post(`${BASE_URL}/assistant/remember`, {
      content: 'My favorite programming language is JavaScript'
    });
    console.log('✅ Memory Saved');

    const memoryResponse = await axios.post(`${BASE_URL}/assistant/chat`, {
      messages: [{ role: 'user', content: 'What is my favorite programming language?' }]
    });
    console.log('✅ Memory Recall:', memoryResponse.data.reply);

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run tests
testAssistant();