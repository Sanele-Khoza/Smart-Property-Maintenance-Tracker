import { api, getToken, setToken, clearTokens, getBaseUrl } from '../api/client.js';

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

function notifyUsersChanged() {
  try { window.dispatchEvent(new Event('spmt:users-updated')); } catch {}
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

const STATUS_TITLES = {
  ACTIVE: 'Active',
  PENDING: 'Pending',
  SUSPENDED: 'Suspended',
  LOCKED: 'Locked',
  DEACTIVATED: 'Deactivated',
};

function titleCaseStatus(raw) {
  const key = String(raw || '').toUpperCase();
  return STATUS_TITLES[key] || raw || 'Active';
}

function normalizeUser(u) {
  const status = titleCaseStatus(u.account_status || u.status);
  return {
    ...u,
    id: u.id,
    name: u.name,
    surname: u.surname,
    email: u.email,
    role: u.role,
    phone: u.phone || '',
    status,
    account_status: status,
    approved: u.approved !== undefined ? u.approved : true,
    preferredNotificationChannel: u.preferredNotificationChannel || 'EMAIL',
    failedLoginCount: u.failed_login_count ?? u.failedLoginCount ?? 0,
  };
}

export const registerUser = async (userData) => {
  try {
    const result = await api('/auth/register', {
      skipAuthRetry: true,
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
      return { success: true, data: result.data.user, verificationToken: result.data.verificationToken };
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
    const result = await api('/users?limit=500');
    if (result.success && result.data?.users) {
      usersCache = result.data.users.map(normalizeUser);
      saveUsersCache();
      notifyUsersChanged();
    }
  } catch {}
};

export const connectRealtime = (handlers = {}) => {
  const token = getToken();
  if (!token || typeof window === 'undefined') return null;

  const base = getBaseUrl().replace(/\/$/, '');
  const es = new EventSource(`${base}/realtime/subscribe?token=${encodeURIComponent(token)}`);

  es.addEventListener('users:changed', () => {
    refreshUsers();
  });

  es.addEventListener('user:status-changed', (event) => {
    try {
      const payload = JSON.parse(event.data || '{}');
      if (handlers.onUserStatusChanged) handlers.onUserStatusChanged(payload);
    } catch {}
  });

  return es;
};

export const approveManager = async (userId) => {
  try {
    const result = await api(`/users/${userId}/approve`, { method: 'PUT' });
    if (result.success) {
      const updated = normalizeUser(result.data?.user || result.data);
      if (updated.id) {
        usersCache = usersCache.map(u => u.id === userId ? updated : u);
      } else {
        usersCache = usersCache.map(u => u.id === userId ? { ...u, status: 'Active', approved: true } : u);
      }
      saveUsersCache();
      notifyUsersChanged();
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
      notifyUsersChanged();
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
      notifyUsersChanged();
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
      notifyUsersChanged();
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
      notifyUsersChanged();
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
