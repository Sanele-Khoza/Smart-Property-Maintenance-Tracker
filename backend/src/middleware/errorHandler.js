import logger from '../shared/utils/logger.js';

const STATUS_CODES = new Set([400, 401, 403, 404, 409, 422, 429, 500]);

function toSafeStatusCode(code) {
  return STATUS_CODES.has(code) ? code : (code >= 500 ? 500 : 400);
}

function notFoundHandler(req, res) {
  res.status(404).json({
    error: `Route ${req.method} ${req.path} not found`,
    code: 'NOT_FOUND',
  });
}

function errorHandler(err, req, res, _next) {
  let statusCode = toSafeStatusCode(err.statusCode || 500);
  let code = err.code || 'INTERNAL_ERROR';
  let error = err.message || 'Internal server error';
  let details = err.details || err.errors || undefined;

  if (err.name === 'ZodError') {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    const issues = err.errors || err.issues || [];
    const first = issues[0];
    error = first ? `${first.path?.join('.')}: ${first.message}` : 'Validation error';
    details = issues.map(e => ({
      field: e.path?.join('.'),
      message: e.message,
    }));
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'UNAUTHORIZED';
    error = 'Invalid or malformed token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'UNAUTHORIZED';
    error = 'Token has expired';
  }

  if (err.code === '23505') {
    statusCode = 409;
    code = 'CONFLICT';
    error = 'Resource already exists';
  }

  if (err.code === '23503') {
    statusCode = 400;
    code = 'BAD_REQUEST';
    error = 'Referenced resource does not exist';
  }

  if (err.name === 'RateLimitError' || err.name === 'TooManyRequestsError') {
    statusCode = 429;
    code = 'RATE_LIMIT';
    error = err.message || 'Too many requests, please try again later';
  }

  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.path} — ${error}`, {
      error,
      code,
      stack: err.stack,
      method: req.method,
      path: req.path,
      requestId: req.id,
    });
  } else {
    logger.warn(`${req.method} ${req.path} — ${error}`, {
      error,
      code,
      method: req.method,
      path: req.path,
    });
  }

  const body = { error, code };
  if (details) body.details = details;

  res.status(statusCode).json(body);
}

export { notFoundHandler };
export default errorHandler;
