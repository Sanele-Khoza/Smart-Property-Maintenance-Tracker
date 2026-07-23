import { jest } from '@jest/globals';
import errorHandler, { notFoundHandler } from '../middleware/errorHandler.js';
import AppError from '../shared/errors/AppError.js';

describe('notFoundHandler', () => {
  it('returns 404 with standard error envelope', () => {
    const req = { method: 'GET', path: '/api/nonexistent' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    notFoundHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Route GET /api/nonexistent not found',
      code: 'NOT_FOUND',
    });
  });
});

describe('errorHandler', () => {
  let req, res;

  beforeEach(() => {
    req = { method: 'GET', path: '/test' };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  });

  it('handles ZodError with 422 and VALIDATION_ERROR', () => {
    const err = { name: 'ZodError', errors: [{ path: ['email'], message: 'Invalid email' }] };
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(422);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toBe('Validation error');
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.details[0].field).toBe('email');
  });

  it('handles ZodError with issues array', () => {
    const err = { name: 'ZodError', issues: [{ path: ['password'], message: 'Too short' }] };
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json.mock.calls[0][0].code).toBe('VALIDATION_ERROR');
  });

  it('handles JsonWebTokenError with 401', () => {
    errorHandler({ name: 'JsonWebTokenError' }, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].code).toBe('UNAUTHORIZED');
  });

  it('handles TokenExpiredError with 401', () => {
    errorHandler({ name: 'TokenExpiredError' }, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].code).toBe('UNAUTHORIZED');
    expect(res.json.mock.calls[0][0].error).toBe('Token has expired');
  });

  it('handles PostgreSQL unique violation (23505) with 409', () => {
    errorHandler({ code: '23505', detail: 'Key (email)=already exists' }, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].code).toBe('CONFLICT');
  });

  it('handles PostgreSQL FK violation (23503) with 400', () => {
    errorHandler({ code: '23503', detail: 'Key (id)=not found' }, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].code).toBe('BAD_REQUEST');
  });

  it('handles AppError.notFound', () => {
    const err = AppError.notFound('User not found');
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].code).toBe('NOT_FOUND');
    expect(res.json.mock.calls[0][0].error).toBe('User not found');
  });

  it('handles AppError.tooManyRequests', () => {
    const err = AppError.tooManyRequests();
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json.mock.calls[0][0].code).toBe('RATE_LIMIT');
  });

  it('handles AppError.badRequest with details', () => {
    const err = AppError.badRequest('Invalid input', { field: 'email', reason: 'already taken' });
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].details).toEqual({ field: 'email', reason: 'already taken' });
  });

  it('handles generic 500 errors without stack trace', () => {
    const err = new Error('Something broke');
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toBe('Something broke');
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.stack).toBeUndefined();
  });

  it('maps unknown status codes to safe range (only 400/500)', () => {
    const err = AppError.badRequest();
    err.statusCode = 418;
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('keeps 429 from RateLimitError', () => {
    const err = { name: 'RateLimitError', message: 'Too fast', statusCode: 429 };
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json.mock.calls[0][0].code).toBe('RATE_LIMIT');
  });

  it('does not expose stack in 5xx responses', () => {
    const err = new Error('Hidden');
    err.stack = 'at line 42';
    errorHandler(err, req, res, jest.fn());
    expect(res.json.mock.calls[0][0].stack).toBeUndefined();
  });
});
