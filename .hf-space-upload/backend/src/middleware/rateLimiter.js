const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

const generateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each user to 5 generation requests per minute
  message: 'Too many generation requests, please try again later.',
  keyGenerator: (req) => req.userId || req.ip, // Use userId if authenticated, else IP
});

module.exports = { apiLimiter, generateLimiter };
