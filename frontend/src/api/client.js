const TOKEN_KEY = 'spmt_access_token';
const REFRESH_KEY = 'spmt_refresh_token';

function getBaseUrl() {
  return process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
}

function getStaticOrigin() {
  return getBaseUrl().replace(/\/api\/?$/, '');
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(accessToken, refreshToken) {
  if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

const DEFAULT_TIMEOUT_MS = 20000;

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

let onLogout = null;
export function setLogoutHandler(fn) {
  onLogout = fn;
}

async function tryRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetchWithTimeout(`${getBaseUrl()}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const body = await res.json();
    if (body.success && body.data) {
      setToken(body.data.accessToken, body.data.refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function api(endpoint, options = {}) {
  const { body, method, headers: extraHeaders, formData, skipAuthRetry, ...rest } = options;
  const token = getToken();
  const headers = { ...extraHeaders };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!formData) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetchWithTimeout(`${getBaseUrl()}${endpoint}`, {
      method: method || (body || formData ? 'POST' : 'GET'),
      headers,
      body: formData || (body ? JSON.stringify(body) : undefined),
      cache: 'no-store',
      ...rest,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out — the server is taking too long to respond.');
    }
    throw new Error('Network error — is the server running?');
  }

  if (response.status === 401 && !skipAuthRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newToken = getToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetchWithTimeout(`${getBaseUrl()}${endpoint}`, {
        method: method || (body || formData ? 'POST' : 'GET'),
        headers,
        body: formData || (body ? JSON.stringify(body) : undefined),
        cache: 'no-store',
        ...rest,
      });
    } else {
      clearTokens();
      if (onLogout) onLogout();
      throw new Error('Session expired — please log in again.');
    }
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = result?.error || result?.message || `Request failed (${response.status})`;
    const err = new Error(message);
    err.status = response.status;
    err.data = result;
    throw err;
  }

  if (result.success === false) {
    const err = new Error(result.error || result.message || 'Request failed');
    err.status = response.status;
    err.data = result;
    throw err;
  }

  return result;
}

export { getToken, setToken, clearTokens, getRefreshToken, getBaseUrl, getStaticOrigin, TOKEN_KEY, REFRESH_KEY };
