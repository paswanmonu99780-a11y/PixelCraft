# Frontend README

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

The application will open at `http://localhost:3000`

## Project Structure

- `src/components/` - Reusable React components
- `src/pages/` - Page components (Landing, Login, Signup, Dashboard)
- `src/context/` - React Context for state management (Auth)
- `src/styles/` - CSS files for styling
- `src/utils/` - Utility functions
- `public/` - Static files

## Features

- **Landing Page**: Attractive hero section with call-to-action buttons
- **Authentication**: Secure signup and login with password strength indicator
- **Dashboard**: Modern interface with sidebar navigation
- **Text to Image**: AI-powered image generation from text prompts
- **Text to Video**: Generate short videos from prompts
- **Image to Video**: Upload an image and animate it into a video
- **History**: View and manage previously generated images
- **User Profile**: Edit user information
- **Responsive Design**: Mobile-friendly layout
- **Dark/Light Mode**: Theme toggle support

## Available Scripts

```bash
npm start      # Run development server
npm build      # Build for production
npm test       # Run tests
npm eject      # Eject configuration (not reversible)
```

## Environment Variables

Create a `.env` file in the frontend directory:

```
REACT_APP_API_URL=http://localhost:5000/api
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
