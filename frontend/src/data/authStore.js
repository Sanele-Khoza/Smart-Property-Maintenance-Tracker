import { api, getToken, setToken, clearTokens } from '../api/client.js';

const SESSION_KEY = 'spmt_session';
const USERS_CACHE_KEY = 'spmt_users_cache';

let usersCache = [];

try {
  const saved = localStorage.getItem(USERS_CACHE_KEY);
  if (saved) usersCache = JSON.parse(saved);
} catch {}

function saveUsersCache() {
  try { localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(usersCache)); } catch {}
}

function decodeToken(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function normalizeUser(u) {
  return {
    ...u,
    id: u.id,
    name: u.name,
    surname: u.surname,
    email: u.email,
    role: u.role,
    phone: u.phone || '',
    status: u.account_status || u.status || 'Active',
    account_status: u.account_status || u.status || 'Active',
    approved: u.approved !== undefined ? u.approved : true,
    preferredNotificationChannel: u.preferredNotificationChannel || 'EMAIL',
    failedLoginCount: u.failed_login_count ?? u.failedLoginCount ?? 0,
  };
}

export const registerUser = async (userData) => {
  try {
    const result = await api('/auth/register', {
      body: {
        name: userData.name,
        surname: userData.surname,
        email: userData.email,
        password: userData.password,
        role: userData.role,
        phone: userData.phone || '',
      },
    });
    if (result.success && result.data) {
      setToken(result.data.accessToken, result.data.refreshToken);
      const user = normalizeUser(result.data.user);
      saveSession(user);
      return { success: true, data: user, verificationToken: result.data.verificationToken };
    }
    return { success: false, error: result.error || 'Registration failed' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const loginUser = async (email, password) => {
  try {
    const result = await api('/auth/login', {
      method: 'POST',
      body: { email, password },
      skipAuthRetry: true,
    });
    if (result.success && result.data) {
      setToken(result.data.accessToken, result.data.refreshToken);
      const user = normalizeUser(result.data.user);
      saveSession(user);
      return { success: true, data: user };
    }
    return { success: false, error: result.error || 'Login failed' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const logoutUser = async () => {
  try {
    await api('/auth/logout', { method: 'POST', body: {} });
  } catch {
  } finally {
    clearTokens();
    clearSession();
  }
};

export const getSession = () => {
  const token = getToken();
  if (!token) return null;

  const decoded = decodeToken(token);
  if (!decoded || (decoded.exp && Date.now() >= decoded.exp * 1000)) {
    clearTokens();
    clearSession();
    return null;
  }

  try {
    const saved = localStorage.getItem(SESSION_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

export const getUsers = () => [...usersCache];

export const getUsersByRole = (role) => usersCache.filter((u) => u.role === role);

export const refreshUsers = async () => {
  try {
    const token = getToken();
    if (!token) return;
    const result = await api('/users');
    if (result.success && result.data?.users) {
      usersCache = result.data.users.map(normalizeUser);
      saveUsersCache();
    }
  } catch {}
};

export const approveManager = async (userId) => {
  try {
    const result = await api(`/users/${userId}/approve`, { method: 'PUT' });
    if (result.success) {
      const updated = normalizeUser(result.data?.user || result.data);
      usersCache = usersCache.map(u => u.id === userId ? updated : u);
      saveUsersCache();
      return { success: true, data: updated };
    }
    return { success: false, error: result.error || 'Failed to approve' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const deactivateUser = async (userId) => {
  try {
    const result = await api(`/users/${userId}/deactivate`, { method: 'PUT' });
    if (result.success) {
      const updated = normalizeUser(result.data?.user || result.data);
      usersCache = usersCache.map(u => u.id === userId ? updated : u);
      saveUsersCache();
      return { success: true, data: updated };
    }
    return { success: false, error: result.error || 'Failed to deactivate' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const reactivateUser = async (userId) => {
  try {
    const result = await api(`/users/${userId}/reactivate`, { method: 'PUT' });
    if (result.success) {
      const updated = normalizeUser(result.data?.user || result.data);
      usersCache = usersCache.map(u => u.id === userId ? updated : u);
      saveUsersCache();
      return { success: true, data: updated };
    }
    return { success: false, error: result.error || 'Failed to reactivate' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const updateUser = async (userId, updates) => {
  try {
    const result = await api(`/users/${userId}`, {
      method: 'PATCH',
      body: updates,
    });
    if (result.success) {
      const updated = normalizeUser(result.data?.user || result.data);
      usersCache = usersCache.map(u => u.id === userId ? updated : u);
      saveUsersCache();
      return { success: true, data: updated };
    }
    return { success: false, error: result.error || 'Failed to update' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const unlockUserAccount = async (userId) => {
  try {
    const result = await api(`/users/${userId}/unlock`, { method: 'PUT' });
    if (result.success) {
      const updated = normalizeUser(result.data?.user || result.data);
      usersCache = usersCache.map(u => u.id === userId ? updated : u);
      saveUsersCache();
      return { success: true, data: updated };
    }
    return { success: false, error: result.error || 'Failed to unlock' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const verifyEmail = async (token) => {
  try {
    const result = await api('/auth/verify-email', { body: { token } });
    if (result.success) return { success: true, data: result.data?.user || result.data };
    return { success: false, error: result.error || 'Verification failed' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const requestPasswordReset = async (email) => {
  try {
    const result = await api('/auth/forgot-password', { body: { email } });
    return { success: true, message: result.message || 'If that email exists, a reset link was sent.' };
  } catch {
    return { success: true, message: 'If that email exists, a reset link was sent.' };
  }
};

export const resetPassword = async (token, newPassword) => {
  try {
    const result = await api('/auth/reset-password', { body: { token, newPassword } });
    if (result.success) return { success: true };
    return { success: false, error: result.error || 'Failed to reset password' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
