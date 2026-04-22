const OPENAI_API_KEY = '05JRdZ3W1kpmO2WNWHq3vTCPFLxgCQG4qyFq8QTH';

async function testOpenAI() {
  try {
    console.log('Testing OpenAI API...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Say hello in Hindi and English' }],
        max_tokens: 100
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ OpenAI API working!');
      console.log('Response:', data.choices[0].message.content);
    } else {
      console.log('❌ OpenAI API failed:', data.error?.message || data);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testOpenAI();