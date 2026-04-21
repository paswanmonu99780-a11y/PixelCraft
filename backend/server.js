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

// Determine if we should ONLY use memory store (forced via env)
const forceMemoryStore = () => String(process.env.USE_MEMORY_DB || '').toLowerCase() === 'true';

// Database Connection
if (forceMemoryStore()) {
  setDatabaseReady(false);
  console.warn('USE_MEMORY_DB enabled, skipping MongoDB connection');
} else {
  mongoose.connection.on('connected', () => {
    setDatabaseReady(true);
    console.log('MongoDB connected');
  });

  mongoose.connection.on('disconnected', () => {
    setDatabaseReady(false);
    console.warn('MongoDB disconnected, using in-memory fallback store');
  });

  mongoose
    .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/image-generator')
    .then(() => {
      console.log('MongoDB connection established');
    })
    .catch((err) => {
      console.error('MongoDB connection error:', err.message);
      console.warn('Continuing with in-memory fallback store');
      setDatabaseReady(false);
    });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Frontend build configuration
const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'build');
const frontendIndexPath = path.join(frontendBuildPath, 'index.html');
const normalizedFrontendBasePath = (() => {
  const configuredBasePath = String(process.env.FRONTEND_BASE_PATH || '/').trim();
  if (!configuredBasePath || configuredBasePath === '/') {
    return '/';
  }
  return `/${configuredBasePath.replace(/^\/+|\/+$/g, '')}`;
})();
const hasFrontendBuild = fs.existsSync(frontendIndexPath);

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

// Serve frontend
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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  if (shouldUseMemoryStore()) {
    console.log('Running with in-memory data store');
  }
});