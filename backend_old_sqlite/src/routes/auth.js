const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { dbRun, dbGet, dbAll } = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'spmt_phase1_jwt_secret_change_in_production_2026';
const TOKEN_EXPIRY = '7d';

function generateToken() {
  return uuidv4().substring(0, 6).toUpperCase();
}

router.post('/register', async (req, res) => {
  try {
    const { name, surname, email, password, role, phone, age, idNumber } = req.body;
    const validRoles = ['TENANT', 'PROPERTY_MANAGER', 'SERVICE_PROVIDER', 'SYSTEM_ADMIN'];
    if (!name || !surname || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, surname, email, password, and role are required' });
    }
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const existing = await dbGet('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const verificationToken = generateToken();
    const status = role === 'SYSTEM_ADMIN' ? 'active' : 'pending';
    const approved = role === 'SYSTEM_ADMIN' ? 1 : 0;
    const result = await dbRun(
      `INSERT INTO users (name, surname, email, password_hash, role, phone, age, id_number, account_status, approved, email_verified, email_verification_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), surname.trim(), email.toLowerCase(), hashed, role, phone || null, age || null, idNumber || null, status, approved, 1, verificationToken]
    );
    const user = await dbGet('SELECT id, name, surname, email, role, phone, account_status FROM users WHERE id = ?', [result.lastID]);
    const token = jwt.sign({ id: user.id, name: user.name, surname: user.surname, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    res.status(201).json({ token, user, verificationToken });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (user.account_status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Account suspended. Contact system administrator.' });
    }
    if (user.account_status === 'DEACTIVATED') {
      return res.status(403).json({ error: 'Account deactivated. Contact system administrator.' });
    }
    if (!user.approved) {
      return res.status(403).json({ error: 'Account pending approval.' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await dbRun('UPDATE users SET login_attempts = login_attempts + 1 WHERE id = ?', [user.id]);
      if (user.login_attempts >= 4) {
        await dbRun("UPDATE users SET account_status = 'SUSPENDED' WHERE id = ?", [user.id]);
      }
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    await dbRun('UPDATE users SET login_attempts = 0 WHERE id = ?', [user.id]);
    const token = jwt.sign({ id: user.id, name: user.name, surname: user.surname, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    res.json({
      token,
      user: { id: user.id, name: user.name, surname: user.surname, email: user.email, role: user.role, phone: user.phone, age: user.age, status: user.status }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await dbGet('SELECT id, name, surname, email, role, phone, age, status, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });
    const user = await dbGet('SELECT id FROM users WHERE email_verification_token = ?', [token]);
    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });
    await dbRun('UPDATE users SET email_verified = 1, email_verification_token = NULL WHERE id = ?', [user.id]);
    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const user = await dbGet('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!user) return res.json({ message: 'If that email exists, a reset link was sent' });
    const resetToken = uuidv4().substring(0, 8);
    const expiry = Date.now() + 3600000;
    await dbRun('UPDATE users SET password_reset_token = ?, password_reset_expiry = ? WHERE id = ?', [resetToken, expiry, user.id]);
    res.json({ message: 'If that email exists, a reset link was sent', resetToken });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process request' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const user = await dbGet('SELECT id FROM users WHERE password_reset_token = ? AND password_reset_expiry > ?', [token, Date.now()]);
    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await dbRun('UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expiry = NULL WHERE id = ?', [hashed, user.id]);
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Password reset failed' });
  }
});

router.get('/users', authenticate, async (req, res) => {
  try {
    const users = await dbAll('SELECT id, name, surname, email, role, phone, age, status, created_at FROM users');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/users/:id', authenticate, async (req, res) => {
  try {
    const user = await dbGet('SELECT id, name, surname, email, role, phone, age, status, created_at FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
