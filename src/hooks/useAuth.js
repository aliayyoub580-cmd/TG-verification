import { useState, useCallback } from 'react';
import { authAPI } from '../services/api.js';

export function useAuth() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('admin_user') || 'null'); }
    catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const { data } = await authAPI.login(email, password);
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_user', JSON.stringify(data.admin));
      setUser(data.admin);
      return { ok: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      return { ok: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try { await authAPI.logout(); } catch { /* local logout must still complete */ }
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setUser(null);
  }, []);

  const isAuthenticated = Boolean(user && localStorage.getItem('admin_token'));

  return { user, loading, login, logout, isAuthenticated };
}
