const express = require('express');
const imageController = require('../controllers/imageController');
const authMiddleware = require('../middleware/auth');
const { generateLimiter } = require('../middleware/rateLimiter');
const { checkDailyLimit } = require('../middleware/dailyLimit');

const router = express.Router();

router.get('/preview', imageController.previewImage);
router.get('/media/:fileName', imageController.serveGeneratedMedia);
router.get('/video-status', authMiddleware, imageController.getVideoStatus);
router.post('/generate', authMiddleware, checkDailyLimit, generateLimiter, imageController.generateImage);
router.post('/generate-video', authMiddleware, generateLimiter, imageController.generateTextToVideo);
router.post('/animate', authMiddleware, generateLimiter, imageController.generateImageToVideo);
router.get('/history', authMiddleware, imageController.getUserHistory);
router.delete('/:imageId', authMiddleware, imageController.deleteImage);

module.exports = router;
