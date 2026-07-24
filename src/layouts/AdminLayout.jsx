import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import toast from 'react-hot-toast';

const NAV = [
  { to: '/admin/dashboard',     label: 'Dashboard',    icon: '📊' },
  { to: '/admin/products',      label: 'Products',     icon: '💊' },
  { to: '/admin/qr-codes',      label: 'QR Codes',     icon: '🔲' },
  { to: '/admin/generate',      label: 'Generate',     icon: '⚡' },
  { to: '/admin/import-export', label: 'Import/Export',icon: '📁' },
  { to: '/admin/scans',         label: 'Scan History', icon: '📋' },
  { to: '/admin/news',          label: 'News',         icon: '📰' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/admin/login');
  };

  return (
    <div className="admin-shell">
      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <span className="sidebar__logo">💊</span>
          <div>
            <p className="sidebar__brand-name">Indufar</p>
            <p className="sidebar__brand-sub">Admin Panel</p>
          </div>
        </div>

        <nav className="sidebar__nav">
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
              }
              onClick={() => setSidebarOpen(false)}
            >
              <span className="sidebar__link-icon">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <p className="sidebar__user">{user?.email || user?.fullName || 'Admin'}</p>
          <button className="sidebar__logout" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="admin-main">
        {/* Mobile header */}
        <header className="admin-topbar">
          <button
            className="topbar__menu-btn"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            ☰
          </button>
          <span className="topbar__title">Indufar Admin</span>
          <span className="topbar__user">{user?.fullName || user?.email || ''}</span>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
