import React, { useState, useEffect } from 'react';
import { qrAPI, productsAPI } from '../../services/api.js';
import Button from '../../components/Button.jsx';
import Badge from '../../components/Badge.jsx';
import Spinner from '../../components/Spinner.jsx';
import { downloadBlob, fmt, fmtDate } from '../../utils/download.js';
import toast from 'react-hot-toast';

const QUICK_QTYS = [10, 100, 1000, 5000, 10000, 20000];

export default function GeneratePage() {
  const [products, setProducts]   = useState([]);
  const [form, setForm]           = useState({
    productId: '', quantity: '', codeLength: 10,
    prefix: '', status: 'active',
  });
  const [domainConfirmed, setDomainConfirmed] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [batches, setBatches]     = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);

  const baseUrl = import.meta.env.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL.replace('/api', '').replace(':5000', '')
    : window.location.origin;

  useEffect(() => {
    productsAPI.list({ limit: 200 })
      .then(({ data }) => setProducts(data.data || []))
      .catch(() => {});
    loadBatches();
  }, []);

  const loadBatches = () => {
    setBatchLoading(true);
    qrAPI.batches({ limit: 10 })
      .then(({ data }) => setBatches(data.data || []))
      .catch(() => {})
      .finally(() => setBatchLoading(false));
  };

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!form.productId)          { toast.error('Select a product'); return; }
    const qty = parseInt(form.quantity, 10);
    if (!qty || qty < 1)          { toast.error('Enter a valid quantity'); return; }
    if (qty > 50000)              { toast.error('Maximum 50,000 per generation'); return; }
    if (!domainConfirmed)         { toast.error('Please confirm the verification domain first'); return; }

    setLoading(true);
    setResult(null);
    try {
      const { data } = await qrAPI.generate({
        productId: form.productId,
        quantity: qty,
        codeLength: parseInt(form.codeLength, 10) || 10,
        prefix: form.prefix || '',
        status: form.status,
        baseUrl,
        confirmDomain: true,
      });
      setResult(data.data);
      toast.success(`Generated ${fmt(data.data.generatedQuantity)} codes`);
      loadBatches();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExportBatch = async (batchId, productName) => {
    try {
      const { data } = await qrAPI.export({ batch_id: batchId, baseUrl });
      downloadBlob(data, `batch-${batchId.slice(0,8)}.csv`);
      toast.success('CSV downloaded');
    } catch { toast.error('Export failed'); }
  };

  const handleZipBatch = async (batchId, productName) => {
    // Get codes for this batch first
    const tid = toast.loading('Preparing ZIP…');
    try {
      const { data: codesRes } = await qrAPI.list({ limit: 50000, batch_id: batchId });
      const ids = (codesRes.data || []).map((c) => c.id);
      if (!ids.length) { toast.error('No codes in batch', { id: tid }); return; }
      const { data } = await qrAPI.downloadZip(ids, productName, baseUrl);
      downloadBlob(data, `batch-${batchId.slice(0,8)}.zip`);
      toast.success('ZIP downloaded', { id: tid });
    } catch (err) {
      toast.error(err.response?.data?.message || 'ZIP failed', { id: tid });
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Generate QR Codes</h1>
          <p className="page-subtitle">Create up to 50,000 cryptographically unique codes in one click</p>
        </div>
      </div>

      {/* Domain warning */}
      <div className="alert alert--warning" style={{ marginBottom:24 }}>
        <span style={{ fontSize:20 }}>⚠️</span>
        <div>
          <strong>Important:</strong> The verification domain cannot be changed after QR codes are printed.
          Current domain: <strong>{baseUrl}</strong>. Confirm below before generating production codes.
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, alignItems:'start' }}>
        {/* Form */}
        <div className="card">
          <div className="card-header"><span className="card-title">Generation Settings</span></div>
          <div className="card-body">
            <form onSubmit={handleGenerate}>
              {/* Product */}
              <div className="form-group">
                <label className="form-label">Product <span className="req">*</span></label>
                <select className="form-control form-select" value={form.productId}
                  onChange={(e) => set('productId')(e.target.value)}>
                  <option value="">Select product…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Quantity */}
              <div className="form-group">
                <label className="form-label">Quantity <span className="req">*</span></label>
                <div className="qty-grid">
                  {QUICK_QTYS.map((q) => (
                    <button type="button" key={q}
                      className={`qty-btn ${parseInt(form.quantity, 10) === q ? 'qty-btn--active' : ''}`}
                      onClick={() => set('quantity')(String(q))}
                    >{fmt(q)}</button>
                  ))}
                </div>
                <input className="form-control" type="number" min={1} max={50000}
                  placeholder="Or enter custom quantity…"
                  value={form.quantity}
                  onChange={(e) => set('quantity')(e.target.value)} />
              </div>

              {/* Code length & prefix */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div className="form-group">
                  <label className="form-label">Code Length</label>
                  <input className="form-control" type="number" min={6} max={32}
                    value={form.codeLength}
                    onChange={(e) => set('codeLength')(e.target.value)} />
                  <p className="form-hint">Default: 10 characters</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Prefix (optional)</label>
                  <input className="form-control" maxLength={8}
                    placeholder="e.g. IND"
                    value={form.prefix}
                    onChange={(e) => set('prefix')(e.target.value.toUpperCase())}
                    style={{ textTransform:'uppercase' }} />
                </div>
              </div>

              {/* Status */}
              <div className="form-group">
                <label className="form-label">Initial Status</label>
                <select className="form-control form-select" value={form.status}
                  onChange={(e) => set('status')(e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Domain confirmation */}
              <div className="checkbox-row" style={{ background:'var(--amber-50)', borderRadius:8, padding:'12px 14px', border:'1px solid var(--amber-100)', marginBottom:20 }}>
                <input type="checkbox" id="confirm-domain"
                  checked={domainConfirmed}
                  onChange={(e) => setDomainConfirmed(e.target.checked)} />
                <label htmlFor="confirm-domain" style={{ fontWeight:500 }}>
                  I confirm that <strong>{baseUrl}</strong> is the final verification domain and
                  I understand this cannot be changed after printing.
                </label>
              </div>

              <Button type="submit" variant="primary" size="lg" loading={loading}
                style={{ width:'100%' }}
                disabled={!domainConfirmed || loading}>
                ⚡ Generate {form.quantity ? fmt(parseInt(form.quantity, 10)) : ''} QR Codes
              </Button>
            </form>
          </div>
        </div>

        {/* Result */}
        <div>
          {result && (
            <div className="card" style={{ marginBottom:20 }}>
              <div className="card-header">
                <span className="card-title">Generation Complete</span>
                <Badge label={result.status} type={result.status} />
              </div>
              <div className="card-body">
                <div className="result-summary">
                  <div className="result-chip result-chip--green">
                    <div className="result-chip__num">{fmt(result.generatedQuantity)}</div>
                    <div className="result-chip__label">Generated</div>
                  </div>
                  <div className="result-chip result-chip--amber">
                    <div className="result-chip__num">{fmt(result.requestedQuantity)}</div>
                    <div className="result-chip__label">Requested</div>
                  </div>
                  {result.failedQuantity > 0 && (
                    <div className="result-chip result-chip--red">
                      <div className="result-chip__num">{fmt(result.failedQuantity)}</div>
                      <div className="result-chip__label">Failed</div>
                    </div>
                  )}
                </div>

                <div style={{ display:'flex', gap:10, marginTop:20, flexWrap:'wrap' }}>
                  <Button variant="primary" onClick={() => handleExportBatch(result.batchId)}>
                    📄 Download CSV
                  </Button>
                  <Button variant="secondary" onClick={() => handleZipBatch(result.batchId)}>
                    📦 Download ZIP
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Batch history */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Batches</span>
              <Button size="sm" variant="ghost" onClick={loadBatches}>↻ Refresh</Button>
            </div>
            <div className="table-wrap" style={{ border:'none', borderRadius:0 }}>
              {batchLoading ? (
                <div style={{ display:'flex', justifyContent:'center', padding:24 }}><Spinner size={24} /></div>
              ) : batches.length === 0 ? (
                <p style={{ padding:24, textAlign:'center', color:'var(--gray-400)', fontSize:14 }}>No batches yet</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((b) => (
                      <tr key={b.id}>
                        <td style={{ fontSize:13 }}>{b.products?.name || '—'}</td>
                        <td style={{ fontWeight:600 }}>{fmt(b.generated_quantity)}<span style={{ color:'var(--gray-400)', fontWeight:400 }}>/{fmt(b.requested_quantity)}</span></td>
                        <td><Badge label={b.status} type={b.status} /></td>
                        <td style={{ fontSize:12, color:'var(--gray-400)', whiteSpace:'nowrap' }}>{fmtDate(b.created_at)}</td>
                        <td>
                          <div className="td-actions">
                            <Button size="sm" variant="secondary"
                              onClick={() => handleExportBatch(b.id, b.products?.name)}>CSV</Button>
                            <Button size="sm" variant="ghost"
                              onClick={() => handleZipBatch(b.id, b.products?.name)}>ZIP</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
