import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../../config/index.js';
import AppError from '../../shared/errors/AppError.js';
import * as repo from './auth.repository.js';
import * as audit from '../../shared/utils/securityAudit.js';
import { sendMail } from '../../shared/adapters/mailAdapter.js';

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_BYTES = 64;
const RESET_TOKEN_BYTES = 32;
const VERIFICATION_TOKEN_BYTES = 32;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signJwt(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
}

function generateToken(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

function buildUserPayload(user) {
  return {
    id: user.id,
    name: user.name,
    surname: user.surname,
    email: user.email,
    role: user.role,
    phone: user.phone,
    status: user.status,
    approved: user.approved,
  };
}

async function register({ name, surname, email, password, role, phone, idNumber, companyName, specialisations }, ipAddress) {
  const existing = await repo.findByEmail(email);
  if (existing) throw AppError.conflict('Email already registered');

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const status = role === 'SYSTEM_ADMIN' ? 'ACTIVE' : 'PENDING';
  const approved = true;

  const user = await repo.create({
    name, surname, email, phone, idNumber, passwordHash, role, status, approved,
  });

  if (role === 'SERVICE_PROVIDER') {
    await repo.createServiceProvider({
      name: `${name} ${surname}`,
      companyName,
      email,
      phone,
      specialisations: specialisations || [],
    });
  }

  const accessToken = signJwt(user);
  const refreshToken = generateRefreshToken();
  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await repo.saveRefreshToken(user.id, refreshToken, refreshExpiry);

  const verificationToken = generateToken(VERIFICATION_TOKEN_BYTES);
  const hashedVerificationToken = hashToken(verificationToken);
  await repo.updateUser(user.id, { email_verification_token: hashedVerificationToken });

  const verifyUrl = `${config.frontendUrl}/verify-email?token=${verificationToken}`;
  sendMail({
    to: email,
    subject: 'Verify your SPMT account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #00796b;">Verify Your Email</h2>
        <p>Hi ${name},</p>
        <p>Thank you for registering with SPMT. Please click the link below to verify your email address:</p>
        <p style="margin: 24px 0;">
          <a href="${verifyUrl}" style="background: #00796b; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email Address</a>
        </p>
        <p style="color: #666; font-size: 13px;">Or copy this link: ${verifyUrl}</p>
        <p style="color: #666; font-size: 13px;">This link expires in 1 hour. If you did not register, you can ignore this email.</p>
      </div>
    `,
    text: `Hi ${name},\n\nVerify your email by visiting: ${verifyUrl}\n\nThis link expires in 1 hour.`,
  }).catch(() => {});

  await audit.log('REGISTER', `User registered as ${role}`, user.id, ipAddress);

  return {
    success: true,
    message: 'Registration successful. Please verify your email.',
    data: {
      accessToken,
      refreshToken,
      user: buildUserPayload(user),
    },
  };
}

async function login(email, password, ipAddress) {
  const user = await repo.findByEmail(email);
  if (!user) {
    await audit.log('LOGIN_FAILED', `Failed login attempt for ${email}`, null, ipAddress, audit.SEVERITY.WARN);
    throw AppError.unauthorized('Account does not exist');
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const remaining = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    await audit.log('LOGIN_BLOCKED', `Account locked, ${remaining}min remaining`, user.id, ipAddress, audit.SEVERITY.WARN);
    throw AppError.forbidden(`Account is locked. Try again in ${remaining} minutes.`);
  }

  if (user.status === 'PENDING') throw AppError.forbidden('Please verify your email before logging in');
  if (user.status === 'SUSPENDED') throw AppError.forbidden('Account suspended');
  if (user.status === 'DEACTIVATED') throw AppError.forbidden('Account deactivated');
  if (user.status === 'DELETED') throw AppError.forbidden('Account deleted');
  if (!user.approved) throw AppError.forbidden('Account pending approval');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const attempts = (user.login_attempts || 0) + 1;
    if (attempts >= 5) {
      const lockedUntil = new Date(Date.now() + 3 * 60 * 1000);
      await repo.lockUser(user.id, lockedUntil, attempts);
      await audit.log('ACCOUNT_LOCKED', `Locked after ${attempts} failed attempts`, user.id, ipAddress, audit.SEVERITY.WARN);
      throw AppError.forbidden('Account locked due to too many failed attempts. Try again in 3 minutes.');
    }
    await repo.updateLoginAttempts(user.id, attempts);
    await audit.log('LOGIN_FAILED', `Failed attempt ${attempts}/5`, user.id, ipAddress, audit.SEVERITY.WARN);
    throw AppError.unauthorized('Invalid password');
  }

  await repo.updateLoginAttempts(user.id, 0);
  await repo.updateLastLogin(user.id);

  const accessToken = signJwt(user);

  const refreshToken = generateRefreshToken();
  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await repo.saveRefreshToken(user.id, refreshToken, refreshExpiry);

  await audit.log('LOGIN_SUCCESS', 'Login successful', user.id, ipAddress);

  return {
    success: true,
    message: 'Login successful',
    data: {
      accessToken,
      refreshToken,
      user: buildUserPayload(user),
    },
  };
}

async function refreshAccessToken(refreshToken, ipAddress) {
  const stored = await repo.findRefreshToken(refreshToken);
  if (!stored) {
    await audit.log('REFRESH_FAILED', 'Invalid or expired refresh token used', null, ipAddress, audit.SEVERITY.WARN);
    throw AppError.unauthorized('Invalid or expired refresh token');
  }

  await repo.revokeRefreshToken(refreshToken);

  const user = await repo.findByIdFull(stored.user_id);
  if (!user || user.status !== 'ACTIVE') {
    throw AppError.forbidden('Account is not active');
  }

  const newAccessToken = signJwt(user);
  const newRefreshToken = generateRefreshToken();
  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await repo.saveRefreshToken(user.id, newRefreshToken, refreshExpiry);

  return {
    success: true,
    data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
  };
}

async function getMe(userId) {
  const user = await repo.findById(userId);
  if (!user) throw AppError.notFound('User not found');
  return { success: true, data: { user } };
}

async function logout(userId, refreshToken, ipAddress) {
  if (refreshToken) {
    await repo.revokeRefreshToken(refreshToken);
  }
  await repo.revokeAllUserRefreshTokens(userId);
  await audit.log('LOGOUT', 'User logged out', userId, ipAddress);
  return { success: true, message: 'Logged out successfully from all devices' };
}

async function verifyEmail(token, ipAddress) {
  const hashedToken = hashToken(token);
  const user = await repo.findByVerificationToken(hashedToken);
  if (!user) {
    await audit.log('VERIFY_EMAIL_FAILED', 'Invalid or expired verification token', null, ipAddress, audit.SEVERITY.WARN);
    throw AppError.badRequest('Invalid or expired verification token');
  }
  await repo.verifyUser(user.id);
  await audit.log('EMAIL_VERIFIED', 'Email verified successfully', user.id, ipAddress);
  const accessToken = signJwt(user);
  return { success: true, message: 'Email verified successfully', data: { accessToken } };
}

async function forgotPassword(email, ipAddress) {
  const user = await repo.findByEmail(email);
  if (!user) return { success: true, message: 'If the email exists, a reset link has been sent' };

  const resetToken = generateToken(RESET_TOKEN_BYTES);
  const hashedResetToken = hashToken(resetToken);
  const expiry = new Date(Date.now() + 30 * 60 * 1000);
  await repo.setResetToken(user.id, hashedResetToken, expiry);

  const resetUrl = `${config.frontendUrl}/reset-password?reset-token=${resetToken}`;
  sendMail({
    to: email,
    subject: 'Reset your SPMT password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #00796b;">Password Reset Request</h2>
        <p>Hi ${user.name},</p>
        <p>We received a request to reset your password. Click the link below to set a new password:</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="background: #00796b; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
        </p>
        <p style="color: #666; font-size: 13px;">Or copy this link: ${resetUrl}</p>
        <p style="color: #666; font-size: 13px;">This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>
      </div>
    `,
    text: `Hi ${user.name},\n\nReset your password by visiting: ${resetUrl}\n\nThis link expires in 30 minutes.`,
  }).catch(() => {});

  await audit.log('PASSWORD_RESET_REQUESTED', 'Password reset link generated and emailed', user.id, ipAddress);

  return {
    success: true,
    message: 'If the email exists, a reset link has been sent',
  };
}

async function resetPassword(token, newPassword, ipAddress) {
  const hashedToken = hashToken(token);
  const user = await repo.findByResetToken(hashedToken);
  if (!user) {
    await audit.log('PASSWORD_RESET_FAILED', 'Invalid or expired reset token', null, ipAddress, audit.SEVERITY.WARN);
    throw AppError.badRequest('Invalid or expired reset token');
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await repo.updatePassword(user.id, passwordHash);
  await repo.revokeAllUserRefreshTokens(user.id);

  await audit.log('PASSWORD_RESET_COMPLETED', 'Password reset successfully', user.id, ipAddress);

  return { success: true, message: 'Password reset successfully. Please log in again.' };
}

async function changePassword(userId, currentPassword, newPassword, ipAddress) {
  const user = await repo.findByIdFull(userId);
  if (!user) throw AppError.notFound('User not found');

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    await audit.log('PASSWORD_CHANGE_FAILED', 'Incorrect current password', userId, ipAddress, audit.SEVERITY.WARN);
    throw AppError.badRequest('Current password is incorrect');
  }

  const same = await bcrypt.compare(newPassword, user.password_hash);
  if (same) throw AppError.badRequest('New password must be different from current password');

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await repo.updatePassword(user.id, passwordHash);
  await repo.revokeAllUserRefreshTokens(user.id);

  await audit.log('PASSWORD_CHANGED', 'Password changed successfully', userId, ipAddress);

  return { success: true, message: 'Password changed successfully. Please log in again.' };
}

async function deactivateAccount(userId, password, ipAddress) {
  const user = await repo.findByIdFull(userId);
  if (!user) throw AppError.notFound('User not found');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw AppError.badRequest('Password is incorrect');

  await repo.deactivateAccount(userId);
  await repo.revokeAllUserRefreshTokens(user.id);

  await audit.log('ACCOUNT_DEACTIVATED', 'Account deactivated by user', userId, ipAddress, audit.SEVERITY.WARN);

  return { success: true, message: 'Account deactivated successfully' };
}

async function resendVerificationEmail(email, ipAddress) {
  const user = await repo.findByEmail(email);
  if (!user) return { success: true, message: 'If the email exists, a verification link has been sent' };

  if (user.status === 'ACTIVE') {
    return { success: true, message: 'If the email exists, a verification link has been sent' };
  }

  const verificationToken = generateToken(VERIFICATION_TOKEN_BYTES);
  const hashedVerificationToken = hashToken(verificationToken);
  await repo.updateUser(user.id, { email_verification_token: hashedVerificationToken });

  const verifyUrl = `${config.frontendUrl}/verify-email?token=${verificationToken}`;
  sendMail({
    to: email,
    subject: 'Verify your SPMT account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #00796b;">Verify Your Email</h2>
        <p>Hi ${user.name},</p>
        <p>Please click the link below to verify your email address:</p>
        <p style="margin: 24px 0;">
          <a href="${verifyUrl}" style="background: #00796b; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email Address</a>
        </p>
        <p style="color: #666; font-size: 13px;">Or copy this link: ${verifyUrl}</p>
        <p style="color: #666; font-size: 13px;">This link expires in 1 hour.</p>
      </div>
    `,
    text: `Hi ${user.name},\n\nVerify your email by visiting: ${verifyUrl}\n\nThis link expires in 1 hour.`,
  }).catch(() => {});

  await audit.log('VERIFICATION_EMAIL_RESENT', 'Verification email resent', user.id, ipAddress);

  return { success: true, message: 'If the email exists, a verification link has been sent' };
}

export {
  register, login, refreshAccessToken, getMe,
  logout, verifyEmail, forgotPassword, resetPassword,
  changePassword,
  deactivateAccount,
  resendVerificationEmail,
};
