import React from 'react';
import Spinner from './Spinner.jsx';

const variants = {
  primary:   'btn-primary',
  secondary: 'btn-secondary',
  danger:    'btn-danger',
  ghost:     'btn-ghost',
  outline:   'btn-outline',
};

export default function Button({
  children, variant = 'primary', loading = false,
  disabled = false, size = 'md', className = '', ...props
}) {
  return (
    <button
      className={`btn btn--${size} ${variants[variant] || variants.primary} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size={16} color="currentColor" />}
      {children}
    </button>
  );
}
