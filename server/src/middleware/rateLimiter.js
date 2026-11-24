const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const isTest = env.NODE_ENV === 'test';

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 1000 : 5, // Relaxed in test mode to allow full test suite runs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many login attempts, please try again later',
  },
});

const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isTest ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many accounts created from this IP, please try again later',
  },
});

module.exports = {
  loginRateLimiter,
  registerRateLimiter,
};
