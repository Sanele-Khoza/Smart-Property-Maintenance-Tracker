import rateLimit from 'express-rate-limit';
import config from '../config/index.js';

const unauthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: { error: 'Too many requests, please try again later', code: 'RATE_LIMIT' },
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many requests, please try again later', code: 'RATE_LIMIT' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later', code: 'RATE_LIMIT' },
});

export { unauthLimiter, authLimiter, loginLimiter };
