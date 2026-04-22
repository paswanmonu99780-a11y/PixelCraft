const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../utils/validators');

const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.userId = decoded.userId;
  } catch (error) {
    // Ignore invalid optional auth and continue as a public request.
  }

  next();
};

module.exports = optionalAuth;
