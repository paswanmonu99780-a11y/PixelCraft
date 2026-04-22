const GEMINI_API_KEY = 'AIzaSyChFG4N9gT5YGGWG3koj5c6lKELBieTuwU';

async function listModels() {
  try {
    console.log('Getting available Gemini models...');

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + GEMINI_API_KEY);

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Available models:');
      data.models.forEach(model => {
        if (model.name.includes('gemini')) {
          console.log(`- ${model.name}`);
          console.log(`  Methods: ${model.supportedGenerationMethods?.join(', ')}`);
        }
      });
    } else {
      console.log('❌ Error:', data.error.message);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

listModels();