import { jest } from '@jest/globals';
import errorHandler, { notFoundHandler } from '../middleware/errorHandler.js';
import AppError from '../shared/errors/AppError.js';

describe('notFoundHandler', () => {
  it('returns 404 with correct envelope', () => {
    const req = { method: 'GET', path: '/api/nonexistent' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    notFoundHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { message: 'Route GET /api/nonexistent not found' },
    });
  });
});

describe('errorHandler', () => {
  let req, res;

  beforeEach(() => {
    req = { method: 'GET', path: '/test' };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  });

  it('handles ZodError', () => {
    const err = { name: 'ZodError', errors: [{ path: ['email'], message: 'Invalid email' }] };
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json.mock.calls[0][0].success).toBe(false);
    expect(res.json.mock.calls[0][0].error.message).toBe('Validation error');
  });

  it('handles JsonWebTokenError', () => {
    errorHandler({ name: 'JsonWebTokenError' }, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].error.message).toBe('Invalid token');
  });

  it('handles TokenExpiredError', () => {
    errorHandler({ name: 'TokenExpiredError' }, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('handles PostgreSQL unique violation (23505)', () => {
    errorHandler({ code: '23505', detail: 'Key (email)=already exists' }, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('handles AppError.notFound', () => {
    const err = AppError.notFound('User not found');
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('handles generic 500 errors', () => {
    const err = new Error('Something broke');
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error.message).toBe('Something broke');
  });
});
