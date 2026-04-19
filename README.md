# AI Image Generator - Full Stack Application

A modern AI image and video generator web application with secure authentication, real-time generation, and user history management.

## 🌟 Features

### Frontend
- **Landing Page**: Hero section with gradient background and call-to-action buttons
- **AI Helpper Widget**: Floating website assistant with text chat, live talk mode, and a human-like animated avatar
- **Secure Authentication**: Email/password signup with password strength indicator
- **Clean Login**: Remember Me functionality with proper error handling
- **Protected Dashboard**: Modern layout with sidebar navigation
- **Text to Image**: Prompt-based image generation with loading animation and preview card
- **Text to Video**: Generate short AI videos from text prompts
- **Image to Video**: Upload an image and animate it into a short video
- **Image History**: Gallery view of previously generated images
- **User Profile**: Edit username and view account details
- **Responsive Design**: Mobile-friendly with glassmorphism UI
- **Dark/Light Mode**: Theme toggle for better user experience

### Backend
- **Node.js & Express**: Robust REST API
- **JWT Authentication**: Secure session management
- **MongoDB**: User and image history storage
- **Password Security**: Bcrypt hashing with strength validation
- **Rate Limiting**: API protection against abuse
- **Error Handling**: Comprehensive error messages
- **AI Integration**: Hugging Face API for image generation
- **OpenAI Assistant Integration**: Website-aware chat plus live voice sessions for AI Helpper

## 📁 Project Structure

```
image-generator/
├── frontend/                 # React application
│   ├── public/              # Static files
│   ├── src/
│   │   ├── components/      # Reusable React components
│   │   ├── pages/           # Page components
│   │   ├── context/         # Auth Context
│   │   ├── styles/          # CSS files
│   │   ├── utils/           # Helper functions
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
│
├── backend/                  # Node.js Express API
│   ├── src/
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # API routes
│   │   ├── controllers/      # Route controllers
│   │   ├── middleware/      # Custom middleware
│   │   ├── utils/           # Helper functions
│   │   └── config/          # Configuration files
│   ├── server.js            # Entry point
│   ├── package.json
│   ├── .env.example
│   └── README.md
│
├── .github/
│   └── copilot-instructions.md
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ and npm
- MongoDB running locally or connection string ready
- Hugging Face API key
- OpenAI API key for AI Helpper live talk and voice replies

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

4. Update `.env` with your configuration:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/image-generator
JWT_SECRET=your-super-secret-jwt-key
HUGGING_FACE_API_KEY=your-api-key-here
OPENAI_API_KEY=your-openai-api-key-here
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

5. Start the backend:
```bash
npm run dev    # Development with auto-reload
npm start      # Production mode
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The application will open at `http://localhost:3000`

## 🔑 API Endpoints

### Authentication
- `POST /api/auth/send-signup-code` - Send signup verification code
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/send-password-reset-code` - Send password reset code
- `POST /api/auth/reset-password` - Reset password with a verification code
- `POST /api/auth/check-password-strength` - Validate password strength

### Media Generation
- `POST /api/image/generate` - Generate image (requires auth)
- `POST /api/image/generate-video` - Generate video from text (requires auth)
- `POST /api/image/animate` - Generate video from an uploaded image (requires auth)
- `GET /api/image/history` - Get user's image history
- `DELETE /api/image/:imageId` - Delete image from history

### User Profile
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile

### AI Helpper
- `GET /api/assistant/status` - Get assistant capabilities and voice readiness
- `POST /api/assistant/chat` - Ask AI Helpper website questions
- `POST /api/assistant/live-session` - Start a live voice session via OpenAI Realtime
- `POST /api/assistant/speak` - Generate a voice reply from assistant text
- `POST /api/assistant/transcribe` - Transcribe uploaded voice snippets into text

## 🔐 Security Features

- **Password Hashing**: Bcrypt with 10 salt rounds
- **JWT Tokens**: 7-day expiration for session management
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Generation Limits**: 5 generations per minute per user
- **CORS Protection**: Whitelist frontend URL
- **Input Validation**: Email and password validation
- **Environment Variables**: Sensitive data protected in .env

## 🎨 Design System

### Color Palette
- Primary: `#7c3aed` (Purple)
- Secondary: `#06b6d4` (Cyan)
- Success: `#10b981` (Green)
- Error: `#ef4444` (Red)

### Typography
- Font Family: Segoe UI, Tahoma, Geneva, Verdana
- Responsive font sizes for mobile, tablet, desktop

### Modern UI Elements
- Glassmorphism cards with backdrop blur
- Smooth animations and transitions
- Gradient backgrounds
- Box shadows for depth
- Rounded corners (8px-15px)

## 📱 Responsive Breakpoints

- Mobile: < 480px
- Tablet: 480px - 768px
- Desktop: > 768px

## 🔧 Configuration

### Backend .env Variables
```
PORT                  # Server port (default: 5000)
MONGODB_URI          # MongoDB connection string
JWT_SECRET           # JWT secret key
HUGGING_FACE_API_KEY # AI image generation API key
HUGGING_FACE_VIDEO_API_KEY # Optional dedicated key for video inference providers
HUGGING_FACE_VIDEO_PROVIDER # Optional video provider override (default: fal-ai)
VIDEO_GENERATION_BACKEND # auto, huggingface, or piapi (default: auto)
PIAPI_API_KEY          # Optional PiAPI key for auto-fallback video generation
PIAPI_BASE_URL         # Optional PiAPI base URL (default: https://api.piapi.ai)
PIAPI_VIDEO_MODEL      # Optional PiAPI video model (default: Qubico/wanx)
PIAPI_TEXT_TO_VIDEO_TASK_TYPE  # Optional PiAPI task type (default: wan22-txt2video-14b)
PIAPI_IMAGE_TO_VIDEO_TASK_TYPE # Optional PiAPI task type (default: wan22-img2video-14b)
TEXT_TO_VIDEO_MODEL  # Optional text-to-video model id (default: Wan-AI/Wan2.2-T2V-A14B)
IMAGE_TO_VIDEO_MODEL # Optional image-to-video model id (default: Wan-AI/Wan2.2-I2V-A14B)
OPENAI_API_KEY       # Optional but recommended for AI Helpper chat, voice, and live talk
OPENAI_CHAT_MODEL    # Optional assistant chat model override (default: gpt-5-mini)
OPENAI_REALTIME_MODEL # Optional live voice model override (default: gpt-realtime)
OPENAI_TTS_MODEL     # Optional text-to-speech model override (default: gpt-4o-mini-tts)
OPENAI_TRANSCRIBE_MODEL # Optional speech-to-text model override (default: gpt-4o-mini-transcribe)
OPENAI_ASSISTANT_VOICE # Optional assistant voice name (default: marin)
OPENAI_ASSISTANT_VOICE_STYLE # Optional speaking style instructions for voice replies
NODE_ENV             # Environment (development/production)
FRONTEND_URL         # Frontend URL for CORS
RESEND_API_KEY       # Optional Resend API key for email verification codes
RESEND_FROM_EMAIL    # Optional verified sender email for Resend
TWILIO_ACCOUNT_SID   # Optional Twilio SID for SMS verification codes
TWILIO_AUTH_TOKEN    # Optional Twilio auth token
TWILIO_PHONE_NUMBER  # Optional Twilio sending number
SMS_DEFAULT_COUNTRY_CODE # Optional default country code for 10-digit local mobile inputs
OTP_EXPIRY_MINUTES   # Optional verification code expiry window
OTP_COOLDOWN_SECONDS # Optional resend cooldown for verification codes
OTP_MAX_ATTEMPTS     # Optional number of invalid code attempts before reset
```

Note: video generation typically consumes Hugging Face inference credits or another provider's credits. This project now supports automatic fallback to PiAPI Wan 2.2 when `PIAPI_API_KEY` is configured in `backend/.env`.

For authentication: if email/SMS providers are not configured and `NODE_ENV=development`, the backend returns a `debugCode` so local signup and password reset can still be tested from the UI. In production, verification delivery must be configured.

AI Helpper text chat falls back to a built-in website knowledge base when `OPENAI_API_KEY` is not configured, but live talk and human-like voice replies require a valid OpenAI API key. The voice heard by users should be disclosed as AI-generated.

## 🚨 Error Handling

The application provides comprehensive error messages for:
- Authentication failures
- Validation errors
- Rate limit exceeded
- API failures
- Network errors

## 📈 Performance

- Lazy loading for images
- Skeleton loading states
- Optimized bundle size
- Efficient database queries with pagination
- Frontend caching with localStorage

## 🎯 Future Enhancements

- Social sharing of generated images
- Payment integration for premium features
- Image editing tools
- Batch generation
- Community gallery
- Advanced filters and parameters
- Multi-language support
- Progressive Web App (PWA)

## 📝 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🤝 Support

For issues or questions, please check the individual README files in the frontend and backend directories.

---

**Built with ❤️ for image generation enthusiasts**
