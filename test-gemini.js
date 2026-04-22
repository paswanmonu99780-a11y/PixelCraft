const GEMINI_API_KEY = 'AIzaSyChFG4N9gT5YGGWG3koj5c6lKELBieTuwU';

async function testGemini() {
  try {
    console.log('Testing Gemini API...');

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: 'Say hello in Hindi and English'
          }]
        }]
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Gemini API working!');
      console.log('Response:', data.candidates[0].content.parts[0].text);
    } else {
      console.log('❌ Gemini API failed:', data.error.message);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testGemini();