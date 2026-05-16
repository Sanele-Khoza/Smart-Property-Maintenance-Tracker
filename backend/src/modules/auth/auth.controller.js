import * as service from './auth.service.js';

function getIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
}

const register = async (req, res, next) => {
  try {
    const result = await service.register(req.validatedBody, getIp(req));
    res.status(201).json(result);
  } catch (err) { next(err); }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.validatedBody;
    const result = await service.login(email, password, getIp(req));
    res.json(result);
  } catch (err) { next(err); }
};

const me = async (req, res, next) => {
  try {
    const result = await service.getMe(req.user.id);
    res.json(result);
  } catch (err) { next(err); }
};

const logout = async (req, res, next) => {
  try {
    const refreshToken = req.body.refreshToken;
    const result = await service.logout(req.user.id, refreshToken, getIp(req));
    res.json(result);
  } catch (err) { next(err); }
};

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.validatedBody;
    const result = await service.refreshAccessToken(token, getIp(req));
    res.json(result);
  } catch (err) { next(err); }
};

const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.validatedBody;
    const result = await service.verifyEmail(token, getIp(req));
    res.json(result);
  } catch (err) { next(err); }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.validatedBody;
    const result = await service.forgotPassword(email, getIp(req));
    res.json(result);
  } catch (err) { next(err); }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.validatedBody;
    const result = await service.resetPassword(token, newPassword, getIp(req));
    res.json(result);
  } catch (err) { next(err); }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.validatedBody;
    const result = await service.changePassword(req.user.id, currentPassword, newPassword, getIp(req));
    res.json(result);
  } catch (err) { next(err); }
};

const deactivateAccount = async (req, res, next) => {
  try {
    const { password } = req.validatedBody;
    const result = await service.deactivateAccount(req.user.id, password, getIp(req));
    res.json(result);
  } catch (err) { next(err); }
};

const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.validatedBody;
    const result = await service.resendVerificationEmail(email, getIp(req));
    res.json(result);
  } catch (err) { next(err); }
};

export {
  register, login, me, logout, refreshToken,
  verifyEmail, forgotPassword, resetPassword,
  changePassword,
  deactivateAccount,
  resendVerification,
};
