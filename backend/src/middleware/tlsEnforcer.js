import config from '../config/index.js';

function tlsEnforcer(req, res, next) {
  if (config.nodeEnv === 'production') {
    if (!req.secure && req.headers['x-forwarded-proto'] !== 'https') {
      return res.status(403).json({
        error: 'TLS required',
        message: 'This endpoint requires HTTPS. Please use https://',
      });
    }
  }
  next();
}

export default tlsEnforcer;
