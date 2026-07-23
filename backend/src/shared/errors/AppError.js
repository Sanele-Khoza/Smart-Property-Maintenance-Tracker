class AppError extends Error {
  constructor(message, statusCode, code, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || 'ERROR';
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', details) {
    return new AppError(message, 400, 'BAD_REQUEST', details);
  }

  static unauthorized(message = 'Unauthorized', details) {
    return new AppError(message, 401, 'UNAUTHORIZED', details);
  }

  static forbidden(message = 'Forbidden', details) {
    return new AppError(message, 403, 'FORBIDDEN', details);
  }

  static notFound(message = 'Resource not found', details) {
    return new AppError(message, 404, 'NOT_FOUND', details);
  }

  static conflict(message = 'Conflict', details) {
    return new AppError(message, 409, 'CONFLICT', details);
  }

  static validation(message = 'Validation error', details) {
    return new AppError(message, 422, 'VALIDATION_ERROR', details);
  }

  static tooManyRequests(message = 'Too many requests, please try again later', details) {
    return new AppError(message, 429, 'RATE_LIMIT', details);
  }

  static internal(message = 'Internal server error', details) {
    return new AppError(message, 500, 'INTERNAL_ERROR', details);
  }
}

export default AppError;
