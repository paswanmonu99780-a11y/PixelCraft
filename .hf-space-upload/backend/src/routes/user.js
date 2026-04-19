const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');

const router = express.Router();

router.get('/profile', authMiddleware, userController.getUserProfile);
router.get('/:userId/profile', optionalAuth, userController.getPublicUserProfile);
router.put('/profile', authMiddleware, userController.updateUserProfile);
router.post('/:userId/follow', authMiddleware, userController.toggleFollowUser);

module.exports = router;
