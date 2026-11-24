const { verifyAccessToken } = require('../utils/security');

/**
 * Authentication middleware that verifies short-lived JWT access tokens from
 * httpOnly cookies (or Authorization header for testing flexibility).
 */
function authenticateToken(req, res, next) {
  let token = null;

  // 1. Check httpOnly cookie first
  if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }
  // 2. Fallback to Authorization header if present
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      userId: payload.sub,
      email: payload.email,
      name: payload.name,
    };
    return next();
  } catch (err) {
    return res.status(401).json({
      error: 'Invalid or expired token',
    });
  }
}

module.exports = { authenticateToken };
