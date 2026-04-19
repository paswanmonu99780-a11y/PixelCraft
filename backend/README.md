# Backend README

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration:
   - Set `MONGODB_URI` to your MongoDB connection string
   - Set `JWT_SECRET` to a secure random string
   - Set `HUGGING_FACE_API_KEY` to your Hugging Face API key
   - Set `GEMINI_API_KEY` if you want AI Helpper text chat through Gemini
   - Set `OPENAI_API_KEY` if you want AI Helpper live talk, voice replies, and OpenAI chat mode
   - For email verification, set `RESEND_API_KEY` and `RESEND_FROM_EMAIL`
   - For SMS verification, set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER`
   - Set `SMS_DEFAULT_COUNTRY_CODE` if users will enter 10-digit local mobile numbers instead of full international numbers
   - In development, if email/SMS is not configured, the API returns a `debugCode` you can use on the form
   - Optionally set `HUGGING_FACE_VIDEO_API_KEY` if video generation should use a dedicated Hugging Face or provider key
   - Optionally set `HUGGING_FACE_VIDEO_PROVIDER`, `TEXT_TO_VIDEO_MODEL`, and `IMAGE_TO_VIDEO_MODEL` for video generation
   - Optionally set `PIAPI_API_KEY` for automatic fallback to PiAPI Wan 2.2 video tasks
   - Optionally set `GEMINI_MODEL` and `ASSISTANT_CHAT_PROVIDER` (`auto`, `gemini`, or `openai`) to control text-chat provider selection
   - Optionally set `OPENAI_CHAT_MODEL`, `OPENAI_REALTIME_MODEL`, `OPENAI_TTS_MODEL`, `OPENAI_TRANSCRIBE_MODEL`, and `OPENAI_ASSISTANT_VOICE` to customize AI Helpper
   - Current recommended defaults in this project are `fal-ai`, `Wan-AI/Wan2.2-T2V-A14B`, and `Wan-AI/Wan2.2-I2V-A14B`
   - Video generation usually requires available Hugging Face inference credits or a supported third-party provider key

## Running the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will run on `http://localhost:5000` by default.

## API Endpoints

### Authentication
- `POST /api/auth/send-signup-code` - Send signup verification code
- `POST /api/auth/signup` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/send-password-reset-code` - Send password reset code
- `POST /api/auth/reset-password` - Reset password with a verification code
- `POST /api/auth/check-password-strength` - Check password strength

### Media Generation
- `POST /api/image/generate` - Generate an image (requires authentication)
- `POST /api/image/generate-video` - Generate a video from text (requires authentication)
- `POST /api/image/animate` - Animate an uploaded image into a video (requires authentication)
- `GET /api/image/history` - Get user's image history (requires authentication)
- `DELETE /api/image/:imageId` - Delete an image from history (requires authentication)

### User Profile
- `GET /api/user/profile` - Get user profile (requires authentication)
- `PUT /api/user/profile` - Update user profile (requires authentication)

### AI Helpper
- `GET /api/assistant/status` - Assistant readiness, models, and voice information
- `POST /api/assistant/chat` - Website-aware assistant chat
- `POST /api/assistant/live-session` - OpenAI Realtime SDP exchange for live talk
- `POST /api/assistant/speak` - Convert assistant text replies to audio
- `POST /api/assistant/transcribe` - Convert recorded voice snippets into text

AI Helpper can answer from the built-in website knowledge base without any cloud key. Gemini can power general text chat with `GEMINI_API_KEY`, while live talk and AI voice replies still require `OPENAI_API_KEY`. Voice output should be clearly disclosed to users as AI-generated.

## Database Models

### User Schema
- username (String, unique)
- email (String, unique)
- password (String, hashed)
- createdAt (Date)

### Image Schema
- userId (ObjectId, references User)
- prompt (String)
- imageUrl (String)
- generatedAt (Date)
