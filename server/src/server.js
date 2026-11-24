const app = require('./app');
const env = require('./config/env');
const { pool } = require('./config/db');

const server = app.listen(env.PORT, async () => {
  console.log(`Sweety REST API running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  console.log(`CORS allowed origin: ${env.CLIENT_URL}`);
  
  try {
    await pool.query('SELECT 1;');
    console.log('Connected to PostgreSQL successfully.');
  } catch (err) {
    console.error('Warning: Failed to verify PostgreSQL connection on startup:', err.message);
  }
});

// Graceful shutdown handling (SIGTERM for Docker/Kubernetes, SIGINT for local Ctrl+C)
const handleShutdown = (signal) => {
  console.log(`${signal} signal received. Closing HTTP server and database pool.`);
  server.close(async () => {
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
    console.log('HTTP server closed and database pool terminated.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
