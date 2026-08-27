import { z } from 'zod';

const PASSWORD_MIN = 8;
const NAME_MAX = 100;
const SURNAME_MAX = 100;
const EMAIL_MAX = 255;

const passwordSchema = z.string()
  .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`)
  .max(128)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(NAME_MAX),
  surname: z.string().trim().min(1, 'Surname is required').max(SURNAME_MAX),
  email: z.string().email('Invalid email').max(EMAIL_MAX).transform(e => e.toLowerCase()),
  password: passwordSchema,
  role: z.enum(['TENANT', 'PROPERTY_MANAGER', 'SERVICE_PROVIDER']),
  idNumber: z.string().regex(/^\d{13}$/, 'ID number must be exactly 13 digits'),
  phone: z.string().regex(/^\d{10}$/, 'Phone number must be exactly 10 digits'),
  companyName: z.string().trim().max(200).optional().nullable(),
  specialisations: z.array(z.string()).optional().nullable(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email').transform(e => e.toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email').transform(e => e.toLowerCase()),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: passwordSchema,
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

const deactivateAccountSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email').transform(e => e.toLowerCase()),
});

export {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  deactivateAccountSchema,
  refreshTokenSchema,
  resendVerificationSchema,
};
