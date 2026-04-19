const express = require('express');
const galleryController = require('../controllers/galleryController');
const authMiddleware = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');

const router = express.Router();

router.get('/posts', optionalAuth, galleryController.getPublicGalleryPosts);
router.post('/posts', authMiddleware, galleryController.createGalleryPost);
router.post('/posts/:postId/like', authMiddleware, galleryController.togglePostLike);
router.post('/posts/:postId/share', optionalAuth, galleryController.sharePost);

module.exports = router;
