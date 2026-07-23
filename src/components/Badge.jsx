import React from 'react';

const map = {
  active:    'badge-green',
  inactive:  'badge-gray',
  authentic: 'badge-green',
  not_found: 'badge-red',
  inactive_scan: 'badge-amber',
  missing_code: 'badge-red',
  completed: 'badge-green',
  processing:'badge-blue',
  pending:   'badge-amber',
  failed:    'badge-red',
  partial:   'badge-amber',
};

export default function Badge({ label, type }) {
  const cls = map[type] || map[label] || 'badge-gray';
  return <span className={`badge ${cls}`}>{label}</span>;
}
