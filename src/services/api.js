import axios from 'axios';

const BASE = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
  baseURL: BASE,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Attach JWT on every request ──────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Global error normalisation ───────────────────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      if (window.location.pathname.startsWith('/admin') &&
          !window.location.pathname.includes('/login')) {
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;

/* ── Auth ──────────────────────────────────────────────────────────────────── */
export const authAPI = {
  login: (email, password) => api.post('/api/admin/auth/login', { email, password }),
  logout: () => api.post('/api/admin/auth/logout'),
  me: () => api.get('/api/admin/auth/me'),
};

/* ── Verify (public) ───────────────────────────────────────────────────────── */
export const verifyAPI = {
  check: (code) => api.get(`/api/verify`, { params: { code } }),
};

/* ── Dashboard ─────────────────────────────────────────────────────────────── */
export const dashboardAPI = {
  stats: () => api.get('/api/admin/scans/dashboard'),
};

/* ── Products ──────────────────────────────────────────────────────────────── */
export const productsAPI = {
  list: (params) => api.get('/api/admin/products', { params }),
  get: (id) => api.get(`/api/admin/products/${id}`),
  create: (formData) =>
    api.post('/api/admin/products', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, formData) =>
    api.put(`/api/admin/products/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id) => api.delete(`/api/admin/products/${id}`),
};

/* ── QR Codes ──────────────────────────────────────────────────────────────── */
export const qrAPI = {
  list: (params) => api.get('/api/admin/qr-codes', { params }),
  get: (id) => api.get(`/api/admin/qr-codes/${id}`),
  update: (id, data) => api.put(`/api/admin/qr-codes/${id}`, data),
  delete: (id) => api.delete(`/api/admin/qr-codes/${id}`),
  bulkStatus: (ids, status) => api.patch('/api/admin/qr-codes/bulk-status', { ids, status }),
  bulkDelete: (ids) => api.delete('/api/admin/qr-codes/bulk-delete', { data: { ids } }),
  pending: (params) => api.get('/api/admin/qr-codes/pending', { params }),
  generate: (ids) => api.post('/api/admin/qr-codes/generate', { ids }),
  export: (params) =>
    api.get('/api/admin/qr-codes/export', { params, responseType: 'blob' }),
  downloadTemplate: () =>
    api.get('/api/admin/qr-codes/template', { responseType: 'blob' }),
  previewImport: (file, productId) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('productId', productId);
    return api.post('/api/admin/qr-codes/preview-import', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  import: (file, productId) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('productId', productId);
    return api.post('/api/admin/qr-codes/import', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  history: () => api.get('/api/admin/qr-codes/import-history'),
  downloadZip: (ids, filters) => api.post('/api/admin/qr-codes/download-zip', { ids, filters }, { responseType: 'blob' }),
  downloadPNG: (id) => api.get(`/api/admin/qr-codes/${id}/download`, { responseType: 'blob' }),
};

/* ── Scans ─────────────────────────────────────────────────────────────────── */
export const scansAPI = {
  list: (params) => api.get('/api/admin/scans', { params }),
  get: (id) => api.get(`/api/admin/scans/${id}`),
  export: (params) =>
    api.get('/api/admin/scans/export', { params, responseType: 'blob' }),
};
