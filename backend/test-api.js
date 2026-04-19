const axios = require('axios');

const token = process.env.HUGGING_FACE_API_KEY;

if (!token) {
  console.error('Set HUGGING_FACE_API_KEY before running this script.');
  process.exit(1);
}

axios.post(
  'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1',
  { inputs: 'test cat' },
  {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'arraybuffer',
    timeout: 30000
  }
).then(r => {
  console.log('✅ Hugging Face API works! Image generated, size:', r.data.length, 'bytes');
}).catch(e => {
  console.log('❌ Error:', e.response?.status, e.message);
  if (e.response?.data) {
    console.log('Response:', e.response.data.toString());
  }
});
