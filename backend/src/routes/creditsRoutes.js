const express = require('express');
const router = express.Router();
const creditsController = require('../controllers/creditsController');
const { authMiddleware } = require('../middleware/auth');

// Get user data (credits, daily usage, premium status)
router.get('/user-data', authMiddleware, creditsController.getUserData);

// Check if user can generate image
router.get('/check-limit', authMiddleware, creditsController.checkGenerationLimit);

// Get credits balance
router.get('/balance', authMiddleware, creditsController.getCreditsBalance);

module.exports = router;