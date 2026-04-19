const express = require('express');
const authController = require('../controllers/authController');
const { apiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/send-signup-code', apiLimiter, authController.sendSignupCode);
router.post('/signup', apiLimiter, authController.signup);
router.post('/login', apiLimiter, authController.login);
router.post('/send-password-reset-code', apiLimiter, authController.sendPasswordResetCode);
router.post('/reset-password', apiLimiter, authController.resetPassword);
router.post('/check-password-strength', authController.checkPasswordStrength);

module.exports = router;
