async function testAssistant() {
  try {
    console.log('Testing assistant API...');

    const response = await fetch('http://localhost:5000/api/assistant/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello, how are you?' }]
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Assistant working!');
      console.log('Reply:', data.reply);
      console.log('Provider:', data.provider);
      console.log('Model:', data.model);
    } else {
      console.log('❌ Assistant failed:', data.error);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testAssistant();