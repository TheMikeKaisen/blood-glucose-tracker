const env = require('../config/env');

/**
 * Centralized error handler middleware.
 * Prevents information disclosure by stripping database internals and stack traces.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // 1. Malformed JSON Body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Malformed JSON payload',
    });
  }

  // 2. Body Limit Exceeded
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      error: 'Payload too large. Limit is 10kb.',
    });
  }

  // 3. PostgreSQL Unique Constraint Violation
  if (err.code === '23505') {
    const isEmailConstraint =
      err.constraint === 'idx_users_email_lower' ||
      err.constraint === 'users_email_key' ||
      (err.detail && err.detail.toLowerCase().includes('email'));

    if (isEmailConstraint) {
      return res.status(409).json({
        error: 'Email already registered',
      });
    }

    return res.status(409).json({
      error: 'Duplicate or conflicting record',
    });
  }

  // 4. PostgreSQL Data Syntax / Range Violation (e.g., 22P02 invalid syntax, 22008 datetime overflow, 22003 bigint overflow)
  if (err.code === '22P02' || err.code === '22008' || err.code === '22003') {
    return res.status(400).json({
      error: 'Invalid input syntax or value out of range',
    });
  }

  // Log internal error server-side for diagnostics (unless in quiet test mode)
  if (env.NODE_ENV !== 'test') {
    console.error('Unhandled internal error:', err);
  }

  // 4. Default 500 without leaking stack traces
  const status = err.status || 500;
  const message = env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Internal server error');

  res.status(status).json({
    error: message,
  });
}

module.exports = { errorHandler };
