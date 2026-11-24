const { query } = require('../config/db');
const env = require('../config/env');
const {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} = require('../utils/security');
const { attachCsrfCookie } = require('../middleware/csrf');

const isProd = env.NODE_ENV === 'production';

// Cookie options for issuing
const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/',
  maxAge: 10 * 60 * 1000, // 10 minutes
};

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// Cookie options for clearing (RFC 6265bis: secure cookies must be cleared with matching secure attribute)
const CLEAR_ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/',
};

const CLEAR_REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/api/auth',
};

const CLEAR_CSRF_COOKIE_OPTIONS = {
  httpOnly: false,
  secure: isProd,
  sameSite: 'lax',
  path: '/',
};

/**
 * Helper to clear all authentication and session cookies on response
 */
function clearAuthCookies(res) {
  res.clearCookie('accessToken', CLEAR_ACCESS_COOKIE_OPTIONS);
  res.clearCookie('refreshToken', CLEAR_REFRESH_COOKIE_OPTIONS);
  res.clearCookie('csrfToken', CLEAR_CSRF_COOKIE_OPTIONS);
}

/**
 * Register a new user
 */
async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    // Check if email already registered
    const existing = await query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1);',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'Email already registered',
      });
    }

    // Hash password with Argon2id
    const passwordHash = await hashPassword(password);

    // Create user in database
    const insertRes = await query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email;`,
      [name, email, passwordHash]
    );
    const user = insertRes.rows[0];

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Save hashed refresh token in database
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3);`,
      [user.id, tokenHash, expiresAt]
    );

    // Set secure cookies
    res.cookie('accessToken', accessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie('refreshToken', rawRefreshToken, REFRESH_COOKIE_OPTIONS);
    const csrfToken = attachCsrfCookie(res, undefined, isProd);

    return res.status(201).json({
      user: {
        id: String(user.id),
        name: user.name,
        email: user.email,
      },
      csrfToken,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Log in an existing user
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Query user by lowercased email
    const userRes = await query(
      `SELECT id, name, email, password_hash
       FROM users
       WHERE LOWER(email) = LOWER($1);`,
      [email]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    const user = userRes.rows[0];

    // Verify Argon2id hash
    const isValid = await verifyPassword(user.password_hash, password);
    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Persist hashed refresh token
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3);`,
      [user.id, tokenHash, expiresAt]
    );

    // Opportunistically prune old revoked/expired refresh tokens older than 30 days
    query(
      `DELETE FROM refresh_tokens
       WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '30 days';`
    ).catch(() => {});

    // Set secure cookies
    res.cookie('accessToken', accessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie('refreshToken', rawRefreshToken, REFRESH_COOKIE_OPTIONS);
    const csrfToken = attachCsrfCookie(res, undefined, isProd);

    return res.status(200).json({
      user: {
        id: String(user.id),
        name: user.name,
        email: user.email,
      },
      csrfToken,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Refresh access token with Refresh Token Rotation and Reuse Detection
 */
async function refresh(req, res, next) {
  try {
    const rawRefreshToken = req.cookies ? req.cookies.refreshToken : null;

    if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
      clearAuthCookies(res);
      return res.status(401).json({
        error: 'Invalid or expired refresh token',
      });
    }

    const tokenHash = hashToken(rawRefreshToken);

    // Lookup token and associated user
    const tokenRes = await query(
      `SELECT rt.id, rt.user_id, rt.token_hash, rt.expires_at, rt.revoked_at,
              u.name, u.email
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1;`,
      [tokenHash]
    );

    if (tokenRes.rows.length === 0) {
      clearAuthCookies(res);
      return res.status(401).json({
        error: 'Invalid or expired refresh token',
      });
    }

    const tokenRecord = tokenRes.rows[0];

    // Reuse Detection: if token is already revoked, compromise detected!
    if (tokenRecord.revoked_at !== null) {
      // Invalidate ALL sessions for this user immediately
      await query(
        `UPDATE refresh_tokens
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND revoked_at IS NULL;`,
        [tokenRecord.user_id]
      );

      clearAuthCookies(res);

      return res.status(401).json({
        error: 'Compromised token detected. Session terminated.',
      });
    }

    // Check expiry
    if (new Date(tokenRecord.expires_at) < new Date()) {
      await query(
        `UPDATE refresh_tokens
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND revoked_at IS NULL;`,
        [tokenRecord.id]
      );
      clearAuthCookies(res);
      return res.status(401).json({
        error: 'Invalid or expired refresh token',
      });
    }

    // Generate new token pair (Rotation)
    const newAccessToken = generateAccessToken({
      id: tokenRecord.user_id,
      email: tokenRecord.email,
      name: tokenRecord.name,
    });
    const newRefreshToken = generateRefreshToken();
    const newTokenHash = hashToken(newRefreshToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Atomic Rotation: Revoke old token ONLY IF still not revoked.
    // This prevents race condition compromise when concurrent refresh requests arrive.
    const updateRes = await query(
      `UPDATE refresh_tokens
       SET revoked_at = CURRENT_TIMESTAMP, replaced_by_token_hash = $1
       WHERE id = $2 AND revoked_at IS NULL
       RETURNING id;`,
      [newTokenHash, tokenRecord.id]
    );

    // If rowCount === 0, another concurrent request already rotated this token!
    if (updateRes.rowCount === 0) {
      // Emergency session revocation across all devices for this user
      await query(
        `UPDATE refresh_tokens
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND revoked_at IS NULL;`,
        [tokenRecord.user_id]
      );

      clearAuthCookies(res);

      return res.status(401).json({
        error: 'Compromised token detected. Session terminated.',
      });
    }

    // Store new hashed refresh token
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3);`,
      [tokenRecord.user_id, newTokenHash, newExpiresAt]
    );

    // Set updated cookies
    res.cookie('accessToken', newAccessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTIONS);
    const csrfToken = attachCsrfCookie(res, undefined, isProd);

    return res.status(200).json({
      message: 'Token refreshed successfully',
      csrfToken,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Logout the current session
 */
async function logout(req, res, next) {
  try {
    const rawRefreshToken = req.cookies ? req.cookies.refreshToken : null;

    if (rawRefreshToken && typeof rawRefreshToken === 'string') {
      const tokenHash = hashToken(rawRefreshToken);
      await query(
        `UPDATE refresh_tokens
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE token_hash = $1 AND revoked_at IS NULL;`,
        [tokenHash]
      );
    }

    clearAuthCookies(res);

    return res.status(200).json({
      message: 'Logged out successfully',
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Logout all active sessions for the authenticated user
 */
async function logoutAll(req, res, next) {
  try {
    const userId = req.user.userId;

    await query(
      `UPDATE refresh_tokens
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND revoked_at IS NULL;`,
      [userId]
    );

    clearAuthCookies(res);

    return res.status(200).json({
      message: 'Logged out from all devices',
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Get profile of currently authenticated user
 */
async function getMe(req, res, next) {
  try {
    const userId = req.user.userId;

    const userRes = await query(
      `SELECT id, name, email
       FROM users
       WHERE id = $1;`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    const user = userRes.rows[0];

    return res.status(200).json({
      user: {
        id: String(user.id),
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Return CSRF token endpoint
 */
function getCsrf(req, res) {
  const csrfToken = attachCsrfCookie(res, undefined, isProd);
  return res.status(200).json({
    csrfToken,
  });
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  getMe,
  getCsrf,
};
