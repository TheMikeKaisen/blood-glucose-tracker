const crypto = require('crypto');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Hashes a plaintext password using Argon2id
 */
async function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verifies a plaintext password against an Argon2id hash
 */
async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Generates a short-lived access JWT (10 min)
 */
function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      name: user.name,
    },
    env.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: '10m',
      issuer: 'sweety-api',
      audience: 'sweety-client',
    }
  );
}

/**
 * Verifies an access JWT with strict claim checking
 */
function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: 'sweety-api',
    audience: 'sweety-client',
  });
}

/**
 * Generates an opaque cryptographically secure 256-bit refresh token
 */
function generateRefreshToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Computes the SHA-256 hash of an opaque token for safe database persistence
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generates a cryptographically secure random token for CSRF protection
 */
function generateCsrfToken() {
  return crypto.randomBytes(24).toString('hex');
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
  generateCsrfToken,
};
