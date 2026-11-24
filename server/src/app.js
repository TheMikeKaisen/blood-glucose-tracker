const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const authRoutes = require('./routes/authRoutes');
const { csrfProtection } = require('./middleware/csrf');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// Trust reverse proxy (Docker Compose, Nginx, Cloud PaaS) for accurate rate limiting
if (env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

// Security HTTP headers
app.use(helmet());

// CORS configuration with credentials support
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);

app.use(cookieParser());

app.use(express.json({ limit: '10kb' }));

// Cross-Site Request Forgery (CSRF) protection
app.use(csrfProtection);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
app.use('/api/auth', authRoutes);

// Global centralized error handler
app.use(errorHandler);

module.exports = app;
