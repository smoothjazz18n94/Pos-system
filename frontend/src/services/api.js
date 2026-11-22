import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the latest access token to every protected request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  const branchId = localStorage.getItem('branchId');
  if (branchId) {
    config.headers = config.headers || {};
    config.headers['X-Branch-ID'] = branchId;
  }

  const deviceId = localStorage.getItem('deviceId');
  if (deviceId) {
    config.headers = config.headers || {};
    config.headers['X-Client-ID'] = deviceId;
  }

  return config;
});

// All requests that expire at the same time share one refresh request.
let refreshPromise = null;

const isAuthEndpoint = (url = '') =>
  /\/auth\/(login|refresh|logout)(?:[/?]|$)/.test(url);

const endLocalSession = () => {
  // Remove authentication state only. Do NOT clear localStorage wholesale:
  // device metadata and other POS state must be preserved.
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('pos-auth');
  window.location.href = '/login';
};

const refreshTokens = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    throw new Error('No refresh token is available. Please sign in again.');
  }

  const response = await axios.post(
    `${API_BASE}/auth/refresh`,
    { refreshToken },
    { timeout: 15000, headers: { 'Content-Type': 'application/json' } }
  );

  const tokens = response.data?.data;
  if (!tokens?.accessToken || !tokens?.refreshToken) {
    throw new Error('The server returned an invalid token refresh response.');
  }

  localStorage.setItem('accessToken', tokens.accessToken);
  localStorage.setItem('refreshToken', tokens.refreshToken);
  return tokens.accessToken;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status !== 401 ||
      !original ||
      original._retry ||
      isAuthEndpoint(original.url)
    ) {
      return Promise.reject(error);
    }

    // A missing, expired, or otherwise rejected access token can be renewed
    // if the refresh token is still valid.
    original._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshTokens().catch((refreshError) => {
          endLocalSession();
          throw refreshError;
        }).finally(() => {
          refreshPromise = null;
        });
      }

      const newAccessToken = await refreshPromise;
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(original);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  }
);

// Auth
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  register: (data) => api.post('/auth/register', data),
};

// Products
export const productAPI = {
  list: (params) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  getByBarcode: (code) => api.get(`/products/barcode/${code}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
};

// Categories
export const categoryAPI = {
  list: () => api.get('/categories'),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
};

// Sales
export const saleAPI = {
  list: (params) => api.get('/sales', { params }),
  getById: (id) => api.get(`/sales/${id}`),
  create: (data) => api.post('/sales', data),
  void: (id) => api.patch(`/sales/${id}/void`),
};

// Inventory
export const inventoryAPI = {
  list: (params) => api.get('/inventory', { params }),
  update: (id, data) => api.put(`/inventory/${id}`, data),
  adjust: (data) => api.post('/inventory/adjust', data),
};

// Reports
export const reportAPI = {
  daily: (params) => api.get('/reports/daily', { params }),
  weekly: (params) => api.get('/reports/weekly', { params }),
  monthly: (params) => api.get('/reports/monthly', { params }),
  lowStock: (params) => api.get('/reports/low-stock', { params }),
};

// Sync
export const syncAPI = {
  batch: (operations) => api.post('/sync/batch', { operations }),
  delta: (since) => api.get('/sync/delta', { params: { since } }),
  status: (since) => api.get('/sync/status', { params: { since } }),
};

// Branches
export const branchAPI = {
  list: () => api.get('/branches'),
  create: (data) => api.post('/branches', data),
  update: (id, data) => api.put(`/branches/${id}`, data),
};

// Users
export const userAPI = {
  list: (params) => api.get('/users', { params }),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

export default api;
