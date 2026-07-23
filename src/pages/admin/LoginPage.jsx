import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import Button from '../../components/Button.jsx';
import toast from 'react-hot-toast';
import { FiEye, FiEyeOff } from 'react-icons/fi';

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (isAuthenticated) navigate('/admin/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    const result = await login(email.trim(), password);
    setLoading(false);
    if (result.ok) {
      toast.success('Welcome back!');
      const from = location.state?.from?.pathname || '/admin/dashboard';
      navigate(from, { replace: true });
    } else {
      setError(result.message);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Brand */}
        <div style={styles.brand}>
          <div style={styles.brandIcon}>💊</div>
          <h1 style={styles.brandTitle}>Indufar</h1>
          <p style={styles.brandSub}>Admin Portal</p>
        </div>

        <h2 style={styles.heading}>Sign in to your account</h2>

        {error && (
          <div className="alert alert--danger" style={{ marginBottom: 16 }}>
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              className="form-control"
              placeholder="admin@indufar.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div style={styles.passwordField}>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              style={{ paddingRight: 44 }}
            />
              <button
                type="button"
                style={styles.passwordToggle}
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            style={{ width: '100%', marginTop: 8 }}
          >
            Sign in
          </Button>
        </form>

        <p style={styles.hint}>
          Only authorised Indufar administrators can access this area.
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #f9fafb 100%)',
    padding: '24px 16px',
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
    border: '1px solid #e5e7eb',
  },
  brand: {
    textAlign: 'center',
    marginBottom: 28,
  },
  brandIcon: { fontSize: 40, marginBottom: 8 },
  brandTitle: { fontSize: 26, fontWeight: 800, color: '#111827', marginBottom: 4 },
  brandSub: { fontSize: 13, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' },
  heading: { fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 20, textAlign: 'center' },
  passwordField: { position: 'relative' },
  passwordToggle: {
    position: 'absolute',
    top: '50%',
    right: 12,
    transform: 'translateY(-50%)',
    display: 'grid',
    placeItems: 'center',
    padding: 4,
    border: 0,
    background: 'transparent',
    color: '#6b7280',
    fontSize: 19,
    cursor: 'pointer',
  },
  hint: { fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 20, lineHeight: 1.5 },
};
