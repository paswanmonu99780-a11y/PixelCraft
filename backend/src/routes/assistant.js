const express = require('express');
const assistantController = require('../controllers/assistantController');
const optionalAuth = require('../middleware/optionalAuth');
const { apiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.use(apiLimiter);

router.get('/status', optionalAuth, assistantController.getStatus);
router.post('/chat', optionalAuth, assistantController.chat);
router.post('/remember', optionalAuth, assistantController.remember);
router.post('/speak', optionalAuth, assistantController.speak);
router.post('/transcribe', optionalAuth, assistantController.transcribe);
router.post(
  '/live-session',
  optionalAuth,
  express.text({ type: ['application/sdp', 'text/plain'], limit: '1mb' }),
  assistantController.createLiveSession
);

module.exports = router;
