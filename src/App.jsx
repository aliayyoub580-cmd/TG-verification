import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Public
import VerifyPage from './pages/VerifyPage.jsx';

// Auth
import LoginPage from './pages/admin/LoginPage.jsx';

// Admin layout + pages
import AdminLayout from './layouts/AdminLayout.jsx';
import DashboardPage from './pages/admin/DashboardPage.jsx';
import ProductsPage from './pages/admin/ProductsPage.jsx';
import QRCodesPage from './pages/admin/QRCodesPage.jsx';
import GeneratePage from './pages/admin/GeneratePage.jsx';
import ImportExportPage from './pages/admin/ImportExportPage.jsx';
import ScansPage from './pages/admin/ScansPage.jsx';

// Auth guard
import RequireAdmin from './components/RequireAdmin.jsx';

export default function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { maxWidth: '420px' },
        }}
      />
      <Routes>
        {/* Public verification */}
        <Route path="/verify" element={<VerifyPage />} />

        {/* Admin login */}
        <Route path="/admin/login" element={<LoginPage />} />

        {/* Protected admin routes */}
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="qr-codes" element={<QRCodesPage />} />
          <Route path="generate" element={<GeneratePage />} />
          <Route path="import-export" element={<ImportExportPage />} />
          <Route path="scans" element={<ScansPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="/" element={<Navigate to="/verify" replace />} />
        <Route path="*" element={<Navigate to="/verify" replace />} />
      </Routes>
    </>
  );
}
