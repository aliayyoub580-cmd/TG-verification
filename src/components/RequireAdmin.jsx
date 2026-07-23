import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export default function RequireAdmin({ children }) {
  const token = localStorage.getItem('admin_token');
  const location = useLocation();
  if (!token) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }
  return children;
}
