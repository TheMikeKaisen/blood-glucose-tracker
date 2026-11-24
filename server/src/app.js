const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const authRoutes = require('./routes/authRoutes');
const readingsRoutes = require('./routes/readingsRoutes');
const { csrfProtection } = require('./middleware/csrf');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// Trust reverse proxy (Docker Compose, Nginx, Cloud PaaS) for accurate rate limiting
if (env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

app.use(helmet());

app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));
app.use(csrfProtection);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/readings', readingsRoutes);

app.use(errorHandler);

module.exports = app;
