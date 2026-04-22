const express = require('express');
const multer = require('multer');
const assistantController = require('../controllers/assistantController');
const optionalAuth = require('../middleware/optionalAuth');
const { apiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

router.use(apiLimiter);

router.get('/status', optionalAuth, assistantController.getStatus);
router.post('/chat', optionalAuth, upload.single('image'), assistantController.chat);
router.post('/remember', optionalAuth, assistantController.remember);

module.exports = router;
