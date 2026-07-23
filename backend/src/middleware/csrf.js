import { doubleCsrf } from 'csrf-csrf';
import config from '../config/index.js';

const {
  generateCsrfToken,
  doubleCsrfProtection,
  invalidCsrfTokenError,
} = doubleCsrf({
  getSecret: () => config.jwt.secret,
  getSessionIdentifier: (req) => req.ip,
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.nodeEnv === 'production',
    path: '/',
  },
  size: 64,
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
});

export { generateCsrfToken as generateToken, doubleCsrfProtection, invalidCsrfTokenError };
