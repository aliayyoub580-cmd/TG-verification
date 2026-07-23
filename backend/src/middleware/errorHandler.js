/**
 * Central error handling middleware.
 * Sanitizes error responses so stack traces and internal details
 * are never sent to the client in production.
 */
function errorHandler(err, req, res, next) {
  // Log for server monitoring
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message || err);
  }

  // Multer file-size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: `File too large. Maximum allowed size is ${err.limit / (1024 * 1024)} MB.`,
    });
  }

  // Multer unexpected field
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Unexpected file field in upload.',
    });
  }

  // Express-validator or Joi validation errors forwarded manually
  if (err.type === 'validation') {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: err.errors,
    });
  }

  // Default internal server error
  const statusCode = err.statusCode || err.status || 500;
  const message =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again later.'
      : err.message || 'Internal server error';

  return res.status(statusCode).json({ success: false, message });
}

module.exports = { errorHandler };
