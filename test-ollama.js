async function testOllama() {
  try {
    console.log('Testing Ollama...');

    const response = await fetch('http://localhost:11434/api/tags');

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Ollama is running!');
      console.log('Models:', data.models?.map(m => m.name) || 'No models');
    } else {
      console.log('❌ Ollama not running or not accessible');
    }
  } catch (error) {
    console.log('❌ Ollama not available:', error.message);
  }
}

testOllama();