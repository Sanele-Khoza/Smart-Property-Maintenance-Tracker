const jwt = require('jsonwebtoken');
const { dbGet } = require('../db/database');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'spmt_phase1_jwt_secret_change_in_production_2026');
    dbGet('SELECT * FROM users WHERE id = ?', [decoded.id]).then(user => {
      if (!user) return res.status(401).json({ error: 'User not found' });
      req.user = { id: user.id, name: user.name, surname: user.surname, email: user.email, role: user.role, account_status: user.account_status };
      next();
    }).catch(() => res.status(500).json({ error: 'Auth error' }));
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
