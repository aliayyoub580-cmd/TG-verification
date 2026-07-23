import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardAPI } from '../../services/api.js';
import StatCard from '../../components/StatCard.jsx';
import Badge from '../../components/Badge.jsx';
import Spinner from '../../components/Spinner.jsx';
import { fmtDate } from '../../utils/download.js';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI.stats()
      .then(({ data }) => setStats(data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
      <Spinner size={40} />
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your QR verification system</p>
        </div>
        <div className="page-actions">
          <Link to="/admin/generate" className="btn btn--md btn-primary">⚡ Generate QR Codes</Link>
          <Link to="/admin/products" className="btn btn--md btn-secondary">+ Add Product</Link>
        </div>
      </div>

      {/* Stats grid */}
      <div className="stats-grid">
        <StatCard label="Active Products"  value={stats?.totalProducts}  icon="💊" color="green" />
        <StatCard label="Total QR Codes"   value={stats?.totalQRCodes}   icon="🔲" color="blue" />
        <StatCard label="Active Codes"     value={stats?.activeQRCodes}  icon="✅" color="green" />
        <StatCard label="Inactive Codes"   value={stats?.inactiveQRCodes}icon="⛔" color="amber" />
        <StatCard label="Total Scans"      value={stats?.totalScans}     icon="📊" color="blue" />
        <StatCard label="Today's Scans"    value={stats?.todayScans}     icon="📅" color="green" sub="since midnight" />
        <StatCard label="Valid Scans"      value={stats?.validScans}     icon="✔️" color="green" />
        <StatCard label="Invalid Attempts" value={stats?.invalidScans}   icon="⚠️" color="red" />
      </div>

      {/* Quick actions */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12, marginBottom:28 }}>
        {[
          { label:'Generate QR Codes', to:'/admin/generate',      icon:'⚡', color:'#16a34a' },
          { label:'Add Product',       to:'/admin/products',      icon:'💊', color:'#2563eb' },
          { label:'Import CSV',        to:'/admin/import-export', icon:'📥', color:'#d97706' },
          { label:'Export CSV',        to:'/admin/import-export', icon:'📤', color:'#7c3aed' },
        ].map((a) => (
          <Link key={a.label} to={a.to} style={{
            background:'#fff',
            border:`1px solid #e5e7eb`,
            borderRadius:12,
            padding:'18px 20px',
            display:'flex',
            alignItems:'center',
            gap:12,
            fontWeight:600,
            fontSize:14,
            color:'#111827',
            boxShadow:'0 1px 3px rgba(0,0,0,0.06)',
            transition:'box-shadow 0.2s',
          }}>
            <span style={{ fontSize:24 }}>{a.icon}</span>
            {a.label}
          </Link>
        ))}
      </div>

      {/* Recent tables */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        {/* Recent QR codes */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent QR Codes</span>
            <Link to="/admin/qr-codes" className="btn btn--sm btn-ghost">View all →</Link>
          </div>
          <div className="table-wrap" style={{ border:'none', borderRadius:0 }}>
            {stats?.recentQRCodes?.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Product</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentQRCodes.map((r) => (
                    <tr key={r.id}>
                      <td className="td-code">{r.code}</td>
                      <td style={{ fontSize:13, color:'var(--gray-500)' }}>{r.products?.name || '—'}</td>
                      <td><Badge label={r.status} type={r.status} /></td>
                      <td style={{ fontSize:12, color:'var(--gray-400)', whiteSpace:'nowrap' }}>{fmtDate(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ padding:'24px', color:'var(--gray-400)', fontSize:14, textAlign:'center' }}>No QR codes yet</p>
            )}
          </div>
        </div>

        {/* Recent scans */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Scans</span>
            <Link to="/admin/scans" className="btn btn--sm btn-ghost">View all →</Link>
          </div>
          <div className="table-wrap" style={{ border:'none', borderRadius:0 }}>
            {stats?.recentScans?.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Result</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentScans.map((s) => (
                    <tr key={s.id}>
                      <td className="td-code">{s.submitted_code || s.qr_codes?.code || '—'}</td>
                      <td>
                        <Badge
                          label={s.verification_result}
                          type={s.verification_result === 'inactive' ? 'inactive_scan' : s.verification_result}
                        />
                      </td>
                      <td style={{ fontSize:12, color:'var(--gray-400)', whiteSpace:'nowrap' }}>{fmtDate(s.scanned_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ padding:'24px', color:'var(--gray-400)', fontSize:14, textAlign:'center' }}>No scans yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
