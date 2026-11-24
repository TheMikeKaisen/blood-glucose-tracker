const crypto = require('crypto');
const { generateCsrfToken } = require('../utils/security');
const env = require('../config/env');

/**
 * Double Submit Cookie CSRF protection middleware.
 * Verifies that state-changing requests contain an X-CSRF-Token header matching the csrfToken cookie.
 */
function csrfProtection(req, res, next) {
  // Safe methods do not mutate state
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies ? req.cookies.csrfToken : null;
  const headerToken = req.headers['x-csrf-token'];
  const hasAuthCookie = req.cookies && (req.cookies.accessToken || req.cookies.refreshToken);

  // If client has an active session cookie or a csrfToken cookie, CSRF validation is enforced
  if (hasAuthCookie || cookieToken) {
    if (
      typeof cookieToken !== 'string' ||
      typeof headerToken !== 'string' ||
      cookieToken.trim().length === 0 ||
      headerToken.trim().length === 0
    ) {
      return res.status(403).json({
        error: 'Invalid or missing CSRF token',
      });
    }

    const cookieBuf = Buffer.from(cookieToken);
    const headerBuf = Buffer.from(headerToken);

    if (cookieBuf.length !== headerBuf.length || !crypto.timingSafeEqual(cookieBuf, headerBuf)) {
      return res.status(403).json({
        error: 'Invalid or missing CSRF token',
      });
    }
  }

  next();
}

/**
 * Helper to attach a fresh CSRF token cookie to the response
 */
function attachCsrfCookie(res, token = generateCsrfToken(), isProduction = (env.NODE_ENV === 'production')) {
  res.cookie('csrfToken', token, {
    httpOnly: false, // Accessible to JavaScript client to read and send in header
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  });
  return token;
}

module.exports = {
  csrfProtection,
  attachCsrfCookie,
};
