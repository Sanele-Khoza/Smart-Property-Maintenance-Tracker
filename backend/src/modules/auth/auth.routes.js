import { Router } from 'express';
import * as ctrl from './auth.controller.js';
import {
  registerSchema, loginSchema, verifyEmailSchema,
  forgotPasswordSchema, resetPasswordSchema,
  changePasswordSchema, deactivateAccountSchema, refreshTokenSchema,
  resendVerificationSchema,
} from './auth.validation.js';
import validate from '../../middleware/validate.js';
import authenticate from '../../middleware/authenticate.js';
import { loginLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

router.post('/register', loginLimiter, validate(registerSchema), ctrl.register);
router.post('/login', loginLimiter, validate(loginSchema), ctrl.login);
router.post('/refresh-token', validate(refreshTokenSchema), ctrl.refreshToken);
router.post('/verify-email', validate(verifyEmailSchema), ctrl.verifyEmail);
router.post('/resend-verification', loginLimiter, validate(resendVerificationSchema), ctrl.resendVerification);
router.post('/forgot-password', loginLimiter, validate(forgotPasswordSchema), ctrl.forgotPassword);
router.post('/reset-password', loginLimiter, validate(resetPasswordSchema), ctrl.resetPassword);
router.get('/me', authenticate, ctrl.me);
router.post('/logout', authenticate, ctrl.logout);
router.put('/change-password', authenticate, validate(changePasswordSchema), ctrl.changePassword);
router.post('/deactivate', authenticate, validate(deactivateAccountSchema), ctrl.deactivateAccount);

export default router;
