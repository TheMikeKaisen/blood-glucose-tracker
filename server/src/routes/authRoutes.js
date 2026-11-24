const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { validate } = require('../middleware/validate');
const { authenticateToken } = require('../middleware/auth');
const { loginRateLimiter, registerRateLimiter } = require('../middleware/rateLimiter');
const { registerSchema, loginSchema } = require('../validators/authValidator');

// Public routes
router.get('/csrf', authController.getCsrf);
router.post('/register', registerRateLimiter, validate(registerSchema), authController.register);
router.post('/login', loginRateLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

// Protected routes
router.post('/logout-all', authenticateToken, authController.logoutAll);
router.get('/me', authenticateToken, authController.getMe);
router.get('/session', authenticateToken, authController.getMe);

module.exports = router;
