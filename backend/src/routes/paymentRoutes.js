const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/auth');

// Create order for purchasing credits
router.post('/create-order', authMiddleware, paymentController.createOrder);

// Verify payment after successful transaction
router.post('/verify-payment', authMiddleware, paymentController.verifyPayment);

// Get available pricing plans
router.get('/plans', paymentController.getPlans);

// Get user's subscription status
router.get('/subscription-status', authMiddleware, paymentController.getSubscriptionStatus);

module.exports = router;