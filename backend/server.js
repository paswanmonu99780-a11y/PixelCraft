const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const mongoose = require('mongoose');
const authRoutes = require('./src/routes/auth');
const imageRoutes = require('./src/routes/image');
const galleryRoutes = require('./src/routes/gallery');
const userRoutes = require('./src/routes/user');
const assistantRoutes = require('./src/routes/assistant');
const { setDatabaseReady, shouldUseMemoryStore } = require('./src/config/dbMode');

const app = express();
const LOCAL_ORIGIN_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'build');
const frontendIndexPath = path.join(frontendBuildPath, 'index.html');
const platformOrigins = [
  process.env.RENDER_EXTERNAL_URL,
  process.env.RAILWAY_STATIC_URL,
  process.env.URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '',
]
  .map((origin) => String(origin || '').trim())
  .filter(Boolean);
const normalizedFrontendBasePath = (() => {
  const configuredBasePath = String(process.env.FRONTEND_BASE_PATH || '/PixelCraft').trim();

  if (!configuredBasePath || configuredBasePath === '/') {
    return '/';
  }

  return `/${configuredBasePath.replace(/^\/+|\/+$/g, '')}`;
})();
const hasFrontendBuild = fs.existsSync(frontendIndexPath);

const configuredOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
  .concat(platformOrigins);

const isAllowedOrigin = (origin) => {
  if (!origin) {
    return true;
  }

  if (LOCAL_ORIGIN_REGEX.test(origin)) {
    return true;
  }

  return configuredOrigins.includes(origin);
};

// Middleware
app.use(cors({ 
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    }
  },
  optionsSuccessStatus: 200,
}));
app.use(express.json({ limit: '20mb' }));

// Database Connection
mongoose.connection.on('connected', () => {
  setDatabaseReady(true);
  console.log('MongoDB connected');
});

mongoose.connection.on('disconnected', () => {
  setDatabaseReady(false);
  console.warn('MongoDB disconnected, using in-memory fallback');
});

mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/image-generator')
  .catch((err) => {
    setDatabaseReady(false);
    console.error('MongoDB connection error:', err.message);
    console.warn('Continuing with in-memory fallback store');
  });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/image', imageRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/user', userRoutes);
app.use('/api/assistant', assistantRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

if (hasFrontendBuild) {
  if (normalizedFrontendBasePath === '/') {
    app.use(express.static(frontendBuildPath));
    app.get(/^\/(?!api\/).*/, (req, res) => {
      res.sendFile(frontendIndexPath);
    });
  } else {
    app.use(normalizedFrontendBasePath, express.static(frontendBuildPath));
    app.get(`${normalizedFrontendBasePath}/*`, (req, res) => {
      res.sendFile(frontendIndexPath);
    });
    app.get('/', (req, res) => {
      res.redirect(normalizedFrontendBasePath);
    });
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (shouldUseMemoryStore()) {
    console.log('Running with in-memory data store');
  }
});
