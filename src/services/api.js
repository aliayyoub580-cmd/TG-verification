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
  create: (data) => api.post('/api/admin/qr-codes', data),
  update: (id, data) => api.put(`/api/admin/qr-codes/${id}`, data),
  delete: (id) => api.delete(`/api/admin/qr-codes/${id}`),
  bulkStatus: (ids, status) => api.patch('/api/admin/qr-codes/bulk-status', { ids, status }),
  bulkDelete: (ids) => api.delete('/api/admin/qr-codes/bulk-delete', { data: { ids } }),
  generate: (data) => api.post('/api/admin/qr-codes/generate', data),
  export: (params) =>
    api.get('/api/admin/qr-codes/export', { params, responseType: 'blob' }),
  downloadTemplate: () =>
    api.get('/api/admin/qr-codes/template', { responseType: 'blob' }),
  previewImport: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/api/admin/qr-codes/preview-import', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  import: (file, skipDuplicates = true) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('skipDuplicates', String(skipDuplicates));
    return api.post('/api/admin/qr-codes/import', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  downloadZip: (ids, productName, baseUrl) =>
    api.post('/api/admin/qr-codes/download-zip', { ids, productName, baseUrl }, { responseType: 'blob' }),
  qrPreview: (id) => api.get(`/api/admin/qr-codes/${id}/qr-preview`),
  batches: (params) => api.get('/api/admin/qr-codes/generation-batches', { params }),
  batch: (id) => api.get(`/api/admin/qr-codes/generation-batches/${id}`),
};

/* ── Scans ─────────────────────────────────────────────────────────────────── */
export const scansAPI = {
  list: (params) => api.get('/api/admin/scans', { params }),
  get: (id) => api.get(`/api/admin/scans/${id}`),
  export: (params) =>
    api.get('/api/admin/scans/export', { params, responseType: 'blob' }),
};
