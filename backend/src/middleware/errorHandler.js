import logger from '../shared/utils/logger.js';

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { message: `Route ${req.method} ${req.path} not found` },
  });
}

function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;

  if (err.name === 'ZodError' || (err.code === 'VALIDATION_ERROR' && Array.isArray(err.message))) {
    const errors = Array.isArray(err.message) ? err.message : err.errors?.map(e => ({ field: e.path?.join('.'), message: e.message })) || [];
    logger.warn(`Validation: ${req.method} ${req.path}`, { errors });
    return res.status(422).json({
      success: false,
      error: { message: 'Validation error', details: errors },
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, error: { message: 'Invalid token' } });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, error: { message: 'Token expired' } });
  }

  if (err.code === '23505') {
    return res.status(409).json({ success: false, error: { message: 'Resource already exists', details: err.detail } });
  }
  if (err.code === '23503') {
    return res.status(400).json({ success: false, error: { message: 'Referenced resource does not exist', details: err.detail } });
  }

  const body = {
    success: false,
    error: { message: err.message || 'Internal server error' },
  };
  if (err.details) body.error.details = err.details;
  if (err.errors) body.error.errors = err.errors;

  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.path} — ${err.message}`, { stack: err.stack });
  } else {
    logger.warn(`${req.method} ${req.path} — ${err.message}`);
  }

  res.status(statusCode).json(body);
}

export { notFoundHandler };
export default errorHandler;
