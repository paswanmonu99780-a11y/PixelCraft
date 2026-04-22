# Upgraded AI Assistant - ChatGPT-like System

This is a powerful, multi-modal AI assistant system similar to ChatGPT, featuring:

- **Multi-AI Support**: OpenAI GPT-4o, Google Gemini, Ollama (local)
- **Persistent Memory**: MongoDB storage for conversations and user preferences
- **Web Search**: Real-time information fetching
- **Multimodal**: Image input support
- **Voice Features**: Speech-to-text and text-to-speech
- **ChatGPT-like UI**: Dark/light mode, typing animations, message bubbles
- **Fallback System**: Automatic switching between AI providers

## Features

### 🤖 AI Models
- **OpenAI GPT-4o** (paid, most powerful)
- **Google Gemini 2.0** (free, excellent performance)
- **Ollama Local Models** (free, private)

### 💾 Memory System
- Persistent conversation history
- User preferences and memories
- Context-aware responses

### 🔍 Web Search
- Real-time information retrieval
- Current events and latest data
- Integrated with Gemini's google_search tool

### 🖼️ Multimodal Support
- Image input and analysis
- Visual question answering
- Compatible with GPT-4o Vision and Gemini

### 🎤 Voice Features
- Speech-to-text input
- Text-to-speech output
- Browser-based, no external services needed

### 🎨 Modern UI
- ChatGPT-inspired interface
- Dark and light themes
- Typing animations
- Smooth message bubbles
- Responsive design

## Setup Guide

### 1. Environment Setup

1. **Copy environment file:**
```bash
cd backend
cp .env.example .env
```

2. **Configure API Keys** (choose at least one):

```env
# Option 1: OpenAI (paid but powerful)
OPENAI_API_KEY=your_openai_api_key_here

# Option 2: Google Gemini (free)
GEMINI_API_KEY=your_gemini_api_key_here

# Option 3: Ollama (local, free)
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

3. **MongoDB Setup:**
```env
MONGODB_URI=mongodb://localhost:27017/image-generator
```

### 2. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Start Services

1. **Start Ollama** (if using local models):
```bash
ollama serve
ollama pull llama3.2
```

2. **Start Backend:**
```bash
cd backend
npm run dev
```

3. **Start Frontend:**
```bash
cd frontend
npm start
```

### 4. Access the Application

- Open http://localhost:3000
- Click the "AI Assistant" button in the bottom-right
- Start chatting!

## API Configuration

### Provider Priority
Set `ASSISTANT_CHAT_PROVIDER` in `.env`:
- `auto` (default): OpenAI → Gemini → Ollama
- `openai`: Force OpenAI
- `gemini`: Force Gemini
- `ollama`: Force Ollama

### Model Settings
```env
OPENAI_MODEL=gpt-4o
GEMINI_MODEL=gemini-2.0-flash-exp
OLLAMA_MODEL=llama3.2
```

## Usage Examples

### Basic Chat
```
User: Hello, can you help me learn React?
Assistant: नमस्ते! हाँ, मैं आपकी React सीखने में मदद कर सकता हूँ।

React एक popular JavaScript library है जो user interfaces बनाने के लिए इस्तेमाल होती है। चलिए step by step शुरू करते हैं:

1. **React क्या है?**
   React एक component-based library है...

2. **Basic Setup:**
   पहले npm install create-react-app चलाएँ...

क्या आप पहले से कुछ JavaScript जानते हैं?
```

### Image Analysis
```
User: [uploads cat image] What's in this picture?
Assistant: इस तस्वीर में एक प्यारा सा बिल्ली दिख रहा है। यह एक Persian cat लगता है क्योंकि उसके बाल लंबे और घने हैं।

**विश्लेषण:**
- नस्ल: Persian cat (अनुमानित)
- रंग: सफेद और भूरे रंग का मिश्रण
- विशेषताएँ: लंबे बाल, बड़ी आँखें

क्या आप इस बिल्ली के बारे में कोई खास सवाल पूछना चाहेंगे?
```

### Code Help
```
User: How do I create a todo app in React?
Assistant: React में todo app बनाने के लिए यहाँ complete guide है:

**Step 1: Components Structure**
```jsx
function TodoApp() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');

  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, { id: Date.now(), text: input, completed: false }]);
      setInput('');
    }
  };

  // ... rest of the code
}
```

**Step 2: Add Functionality**
- Add todo
- Delete todo
- Mark as complete

**Step 3: Styling**
Use CSS modules or styled-components...

**Complete Code:**
[provides full working code with examples]

कोई specific feature add करना चाहेंगे?
```

### Voice Interaction
- Click microphone button for voice input
- Click speaker button to hear responses
- Automatic Hindi/English detection

## Testing

### Test Commands

```bash
# Backend health check
curl http://localhost:5000/api/health

# Assistant status
curl http://localhost:5000/api/assistant/status

# Test chat (replace with your token)
curl -X POST http://localhost:5000/api/assistant/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'
```

### Test Cases

1. **Basic Conversation**
   - Send: "What is machine learning?"
   - Expected: Step-by-step explanation in Hinglish

2. **Image Upload**
   - Upload any image
   - Ask: "What's in this image?"
   - Expected: Detailed description

3. **Code Generation**
   - Send: "Write a Python function to calculate factorial"
   - Expected: Complete code with comments and example

4. **Web Search**
   - Send: "What is the latest news about AI?"
   - Expected: Current information from web

5. **Memory Test**
   - Send: "Remember that my favorite color is blue"
   - Later: "What's my favorite color?"
   - Expected: Remembers "blue"

## Architecture

### Backend Structure
```
backend/
├── src/
│   ├── routes/assistant.js      # Chat endpoints
│   ├── controllers/assistantController.js  # Request handling
│   ├── utils/assistantService.js          # AI logic & fallbacks
│   ├── models/Conversation.js             # Chat history
│   ├── models/Memory.js                   # User memories
│   └── store/                             # In-memory fallbacks
```

### Frontend Structure
```
frontend/
├── src/
│   ├── components/AiAssistant.js          # Main chat component
│   ├── styles/AiHelpperWidget.css         # ChatGPT-like styles
│   └── utils/api.js                       # API helpers
```

### AI Fallback Flow
```
User Request
    ↓
OpenAI GPT-4o (if configured)
    ↓ (if fails)
Google Gemini
    ↓ (if fails)
Ollama Local
    ↓ (if fails)
Local Knowledge Base
```

## Troubleshooting

### Common Issues

1. **No AI Response**
   - Check API keys in `.env`
   - Ensure MongoDB is running
   - Check console for errors

2. **Image Upload Not Working**
   - Check file size (< 10MB)
   - Ensure image format is supported
   - Check network connectivity

3. **Voice Not Working**
   - Allow microphone permissions
   - Check browser compatibility
   - Try refreshing the page

### Debug Commands

```bash
# Check backend logs
cd backend && npm run dev

# Test Ollama connection
curl http://localhost:11434/api/tags

# Check MongoDB connection
mongosh --eval "db.stats()"
```

## Security Notes

- API keys are stored server-side only
- User inputs are validated and sanitized
- File uploads are limited to 10MB images
- Rate limiting prevents abuse
- All AI providers use secure HTTPS connections

## Performance Tips

- Use Gemini for most queries (free and fast)
- Reserve OpenAI for complex reasoning tasks
- Keep conversations under 30 messages for best performance
- Use voice input for hands-free operation

---

**Note**: This system uses free AI services where possible, but OpenAI requires a paid API key for GPT-4o access. Gemini provides excellent free AI capabilities for most use cases.