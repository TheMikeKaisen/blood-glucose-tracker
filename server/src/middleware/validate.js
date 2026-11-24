/**
 * Express middleware for Zod schema boundary validation
 * Returns 422 Unprocessable Entity with exact error message upon validation failure
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const dataToValidate = req[source];
      const parsed = schema.parse(dataToValidate);
      req[source] = parsed;
      next();
    } catch (err) {
      const issues = err.issues || err.errors;
      if (issues && issues.length > 0) {
        return res.status(422).json({
          error: issues[0].message,
        });
      }
      return res.status(422).json({
        error: 'Validation failed',
      });
    }
  };
}

module.exports = { validate };
