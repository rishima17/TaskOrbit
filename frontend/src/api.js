export const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const API_BASE = `${API_ORIGIN}/api`;

export const getAssetUrl = (jobId) => `${API_BASE}/jobs/asset/${jobId}`;

export const getAuthToken = () => localStorage.getItem('taskorbit_token');
export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('taskorbit_token', token);
  } else {
    localStorage.removeItem('taskorbit_token');
  }
};

/**
 * Standard fetch wrapper supporting HttpOnly cookies, Authorization headers, and error normalization
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add Bearer token header if stored (supports cross-domain deployments)
  const token = getAuthToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    credentials: 'include', // Ensure cookies are included
    headers,
  };

  try {
    const res = await fetch(url, config);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const error = new Error(data.message || `Request failed with status ${res.status}`);
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    console.error(`[API Error] ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // Auth
  login: async (email, password) => {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data?.token) setAuthToken(data.token);
    return data;
  },

  register: async (name, email, password, role = 'user') => {
    const data = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
    });
    if (data?.token) setAuthToken(data.token);
    return data;
  },

  logout: async () => {
    try {
      await request('/auth/logout', {
        method: 'POST',
      });
    } finally {
      setAuthToken(null);
    }
  },

  getMe: () => request('/auth/me'),

  // Jobs
  createJob: (jobData) =>
    request('/jobs/create', {
      method: 'POST',
      body: JSON.stringify(jobData),
    }),

  createBatchJobs: (params = {}) =>
    request('/jobs/create-batch', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  getJobHistory: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/jobs/history${query ? `?${query}` : ''}`);
  },

  getJobDetails: (jobId) => request(`/jobs/${jobId}`),

  // Admin
  getDlqJobs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/dlq${query ? `?${query}` : ''}`);
  },

  requeueJob: (jobId, clearFailureFlag = true) =>
    request(`/admin/requeue/${jobId}`, {
      method: 'POST',
      body: JSON.stringify({ clearFailureFlag }),
    }),

  getMetrics: () => request('/admin/metrics'),

  // System
  checkHealth: async () => {
    try {
      const healthUrl = `${API_ORIGIN || ''}/health`;
      const res = await fetch(healthUrl, { credentials: 'include' });
      if (!res.ok) throw new Error('Health check failed');
      return await res.json();
    } catch {
      return {
        status: 'down',
        dependencies: { redis: 'offline', mongodb: 'offline' },
      };
    }
  },
};

