import React, { useState, useEffect, useCallback } from 'react';
import { scansAPI } from '../../services/api.js';
import Badge from '../../components/Badge.jsx';
import Button from '../../components/Button.jsx';
import Pagination from '../../components/Pagination.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Modal from '../../components/Modal.jsx';
import Spinner from '../../components/Spinner.jsx';
import { useDebounce } from '../../hooks/useDebounce.js';
import { downloadBlob, fmtDate, fmt } from '../../utils/download.js';
import toast from 'react-hot-toast';

const RESULTS = ['authentic','not_found','inactive','missing_code'];

function resultLabel(r) {
  return {
    authentic: 'Authentic',
    not_found: 'Not Found',
    inactive: 'Inactive',
    missing_code: 'Missing Code',
  }[r] || r;
}

export default function ScansPage() {
  const [scans, setScans]       = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [resultFilter, setResult] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [detail, setDetail]     = useState(null);
  const [exporting, setExporting] = useState(false);

  const dSearch = useDebounce(search, 400);

  const load = useCallback(() => {
    setLoading(true);
    scansAPI.list({
      page, limit: 20,
      search: dSearch || undefined,
      result: resultFilter || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    })
      .then(({ data }) => {
        setScans(data.data || []);
        setTotal(data.pagination?.total || 0);
      })
      .catch(() => toast.error('Failed to load scans'))
      .finally(() => setLoading(false));
  }, [page, dSearch, resultFilter, dateFrom, dateTo]);

  useEffect(() => { setPage(1); }, [dSearch, resultFilter, dateFrom, dateTo]);
  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data } = await scansAPI.export({
        result: resultFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      downloadBlob(data, `scans-${Date.now()}.csv`);
      toast.success('Scan history exported');
    } catch { toast.error('Export failed'); } finally { setExporting(false); }
  };

  const handleViewDetail = async (id) => {
    try {
      const { data } = await scansAPI.get(id);
      setDetail(data.data);
    } catch { toast.error('Failed to load scan detail'); }
  };

  const resultBadgeType = (r) => r === 'inactive' ? 'inactive_scan' : r;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Scan History</h1>
          <p className="page-subtitle">{fmt(total)} total verification attempt{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" onClick={handleExport} loading={exporting}>📤 Export CSV</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input className="form-control" placeholder="Search by code…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="form-control form-select" style={{ maxWidth:180 }}
          value={resultFilter} onChange={(e) => setResult(e.target.value)}>
          <option value="">All results</option>
          {RESULTS.map((r) => <option key={r} value={r}>{resultLabel(r)}</option>)}
        </select>
        <input className="form-control" type="date" style={{ maxWidth:160 }}
          value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          title="From date" />
        <input className="form-control" type="date" style={{ maxWidth:160 }}
          value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          title="To date" />
        {(search || resultFilter || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => {
            setSearch(''); setResult(''); setDateFrom(''); setDateTo('');
          }}>✕ Clear filters</Button>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:20 }}>
        {RESULTS.map((r) => {
          const count = scans.filter((s) => s.verification_result === r).length;
          return count > 0 ? (
            <div key={r} style={{ background:'#fff', border:'1px solid var(--gray-200)', borderRadius:8, padding:'8px 14px', fontSize:13 }}>
              <Badge label={resultLabel(r)} type={resultBadgeType(r)} /> <strong>{count}</strong> on page
            </div>
          ) : null;
        })}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner size={32} /></div>
        ) : scans.length === 0 ? (
          <EmptyState icon="📋" title="No scans yet"
            description="Verification attempts will appear here after QR codes are scanned." />
        ) : (
          <div className="table-wrap" style={{ border:'none', borderRadius:0 }}>
            <table>
              <thead>
                <tr>
                  <th>Code Submitted</th>
                  <th>Result</th>
                  <th>Matched Code</th>
                  <th>Product</th>
                  <th>Scanned At</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {scans.map((s) => (
                  <tr key={s.id}>
                    <td className="td-code">{s.submitted_code || '—'}</td>
                    <td>
                      <Badge
                        label={resultLabel(s.verification_result)}
                        type={resultBadgeType(s.verification_result)}
                      />
                    </td>
                    <td className="td-code" style={{ fontSize:12, color:'var(--gray-500)' }}>
                      {s.qr_codes?.code || '—'}
                    </td>
                    <td style={{ fontSize:13 }}>{s.qr_codes?.products?.name || '—'}</td>
                    <td style={{ fontSize:12, color:'var(--gray-400)', whiteSpace:'nowrap' }}>
                      {fmtDate(s.scanned_at)}
                    </td>
                    <td>
                      <Button size="sm" variant="ghost" onClick={() => handleViewDetail(s.id)}>View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ padding:'0 20px' }}>
          <Pagination page={page} totalPages={Math.ceil(total / 20)} onPage={setPage} />
        </div>
      </div>

      {/* Detail Modal */}
      <Modal open={!!detail} title="Scan Detail" onClose={() => setDetail(null)}>
        {detail && (
          <div style={{ fontSize:14 }}>
            {[
              ['ID', detail.id],
              ['Submitted Code', detail.submitted_code || '—'],
              ['Result', <Badge key="r" label={resultLabel(detail.verification_result)} type={resultBadgeType(detail.verification_result)} />],
              ['Matched QR Code', detail.qr_codes?.code || '—'],
              ['Product', detail.qr_codes?.products?.name || '—'],
              ['Scanned At', fmtDate(detail.scanned_at)],
              ['User Agent', detail.user_agent || '—'],
              ['Referrer', detail.referrer || '—'],
            ].map(([label, val]) => (
              <div key={label} style={{ display:'flex', gap:12, padding:'10px 0', borderBottom:'1px solid var(--gray-100)' }}>
                <span style={{ width:130, color:'var(--gray-500)', fontWeight:500, flexShrink:0 }}>{label}</span>
                <span style={{ color:'var(--gray-800)', wordBreak:'break-all' }}>{val}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
