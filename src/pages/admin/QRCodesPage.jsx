import React, { useState, useEffect, useCallback } from 'react';
import { qrAPI, productsAPI } from '../../services/api.js';
import Button from '../../components/Button.jsx';
import Badge from '../../components/Badge.jsx';
import Pagination from '../../components/Pagination.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Modal, { ConfirmModal } from '../../components/Modal.jsx';
import Spinner from '../../components/Spinner.jsx';
import { useDebounce } from '../../hooks/useDebounce.js';
import { downloadBlob, fmtDate, fmt } from '../../utils/download.js';
import toast from 'react-hot-toast';

export default function QRCodesPage() {
  const [codes, setCodes]           = useState([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('');
  const [productFilter, setProduct] = useState('');
  const [products, setProducts]     = useState([]);
  const [selected, setSelected]     = useState(new Set());
  const [saving, setSaving]         = useState(false);

  // Modals
  const [addModal, setAddModal]       = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [previewCode, setPreviewCode] = useState(null);

  // Add QR form
  const [addForm, setAddForm] = useState({ code:'', product_id:'', status:'active' });

  const dSearch = useDebounce(search, 400);

  // Load products for filter & add form
  useEffect(() => {
    productsAPI.list({ limit: 200 })
      .then(({ data }) => setProducts(data.data || []))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    qrAPI.list({
      page, limit: 20,
      search: dSearch || undefined,
      status: statusFilter || undefined,
      product_id: productFilter || undefined,
    })
      .then(({ data }) => {
        setCodes(data.data || []);
        setTotal(data.pagination?.total || 0);
      })
      .catch(() => toast.error('Failed to load QR codes'))
      .finally(() => setLoading(false));
  }, [page, dSearch, statusFilter, productFilter]);

  useEffect(() => { setPage(1); }, [dSearch, statusFilter, productFilter]);
  useEffect(() => { load(); }, [load]);

  // Selection helpers
  const toggleSelect = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selected.size === codes.length) setSelected(new Set());
    else setSelected(new Set(codes.map((c) => c.id)));
  };

  const clearSelected = () => setSelected(new Set());

  // Bulk status
  const bulkStatus = async (status) => {
    if (!selected.size) return;
    setSaving(true);
    try {
      await qrAPI.bulkStatus([...selected], status);
      toast.success(`${selected.size} code(s) set to ${status}`);
      clearSelected(); load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  // Bulk delete
  const bulkDelete = async () => {
    setSaving(true);
    try {
      await qrAPI.bulkDelete([...selected]);
      toast.success(`${selected.size} code(s) deleted`);
      clearSelected(); setBulkDeleteOpen(false); load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  // Single delete
  const doDelete = async () => {
    setSaving(true);
    try {
      await qrAPI.delete(deleteTarget.id);
      toast.success('QR code deleted');
      setDeleteTarget(null); load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  // Add single code
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.code.trim() || !addForm.product_id) {
      toast.error('Code and product are required'); return;
    }
    setSaving(true);
    try {
      await qrAPI.create(addForm);
      toast.success('QR code created');
      setAddModal(false);
      setAddForm({ code:'', product_id:'', status:'active' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  // Export CSV
  const handleExport = async () => {
    try {
      const { data } = await qrAPI.export({
        status: statusFilter || undefined,
        product_id: productFilter || undefined,
        ids: selected.size > 0 ? [...selected].join(',') : undefined,
        baseUrl: import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || window.location.origin,
      });
      downloadBlob(data, `qr-codes-${Date.now()}.csv`);
      toast.success('CSV exported');
    } catch { toast.error('Export failed'); }
  };

  // Download ZIP of selected
  const handleZip = async () => {
    if (!selected.size) { toast.error('Select codes first'); return; }
    const tid = toast.loading(`Generating ZIP for ${selected.size} codes…`);
    try {
      const { data } = await qrAPI.downloadZip(
        [...selected],
        codes.find((c) => selected.has(c.id))?.products?.name,
        window.location.origin,
      );
      downloadBlob(data, `indufar-qr-${Date.now()}.zip`);
      toast.success('ZIP downloaded', { id: tid });
    } catch (err) {
      toast.error(err.response?.data?.message || 'ZIP failed', { id: tid });
    }
  };

  // QR preview
  const loadPreview = async (id) => {
    try {
      const { data } = await qrAPI.qrPreview(id);
      setPreviewCode(data.data);
    } catch { toast.error('Failed to load QR preview'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">QR Codes</h1>
          <p className="page-subtitle">{fmt(total)} code{total !== 1 ? 's' : ''} total</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" size="sm" onClick={handleExport}>📤 Export CSV</Button>
          <Button variant="secondary" size="sm" onClick={handleZip} disabled={!selected.size}>
            📦 Download ZIP {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
          <Button variant="primary" onClick={() => setAddModal(true)}>+ Add Code</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input className="form-control" placeholder="Search by code…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="form-control form-select" style={{ maxWidth:160 }}
          value={statusFilter} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select className="form-control form-select" style={{ maxWidth:200 }}
          value={productFilter} onChange={(e) => setProduct(e.target.value)}>
          <option value="">All products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {selected.size > 0 && (
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ fontSize:13, color:'var(--gray-600)', fontWeight:500 }}>{selected.size} selected</span>
            <Button size="sm" variant="outline" onClick={() => bulkStatus('active')} loading={saving}>✅ Activate</Button>
            <Button size="sm" variant="secondary" onClick={() => bulkStatus('inactive')} loading={saving}>⛔ Deactivate</Button>
            <Button size="sm" variant="danger" onClick={() => setBulkDeleteOpen(true)}>🗑 Delete</Button>
            <Button size="sm" variant="ghost" onClick={clearSelected}>Clear</Button>
          </div>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner size={32} /></div>
        ) : codes.length === 0 ? (
          <EmptyState icon="🔲" title="No QR codes found"
            description="Generate or add codes to get started."
          />
        ) : (
          <div className="table-wrap" style={{ border:'none', borderRadius:0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width:40 }}>
                    <input type="checkbox" checked={selected.size === codes.length && codes.length > 0}
                      onChange={toggleAll} />
                  </th>
                  <th>Code</th>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Scans</th>
                  <th>Last Scanned</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <input type="checkbox" checked={selected.has(c.id)}
                        onChange={() => toggleSelect(c.id)} />
                    </td>
                    <td className="td-code">{c.code}</td>
                    <td style={{ fontSize:13 }}>{c.products?.name || '—'}</td>
                    <td><Badge label={c.status} type={c.status} /></td>
                    <td style={{ fontWeight:600 }}>{fmt(c.scan_count)}</td>
                    <td style={{ fontSize:12, color:'var(--gray-400)', whiteSpace:'nowrap' }}>{fmtDate(c.last_scanned_at)}</td>
                    <td style={{ fontSize:12, color:'var(--gray-400)', whiteSpace:'nowrap' }}>{fmtDate(c.created_at)}</td>
                    <td>
                      <div className="td-actions">
                        <Button size="sm" variant="ghost" onClick={() => loadPreview(c.id)} title="View QR">🔲</Button>
                        <Button size="sm" variant="secondary"
                          onClick={() => qrAPI.update(c.id, { status: c.status === 'active' ? 'inactive' : 'active' }).then(load)}
                        >{c.status === 'active' ? '⛔' : '✅'}</Button>
                        <Button size="sm" variant="danger" onClick={() => setDeleteTarget(c)}>🗑</Button>
                      </div>
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

      {/* Add Code Modal */}
      <Modal open={addModal} title="Add QR Code Manually" onClose={() => setAddModal(false)}>
        <form onSubmit={handleAdd}>
          <div className="form-group">
            <label className="form-label">Unique Code <span className="req">*</span></label>
            <input className="form-control" value={addForm.code}
              onChange={(e) => setAddForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
              placeholder="e.g. 7GG6Y89U8K" style={{ textTransform:'uppercase' }} />
            <p className="form-hint">4–64 characters, uppercase letters and numbers.</p>
          </div>
          <div className="form-group">
            <label className="form-label">Product <span className="req">*</span></label>
            <select className="form-control form-select" value={addForm.product_id}
              onChange={(e) => setAddForm((p) => ({ ...p, product_id: e.target.value }))}>
              <option value="">Select a product…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-control form-select" value={addForm.status}
              onChange={(e) => setAddForm((p) => ({ ...p, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <Button variant="ghost" type="button" onClick={() => setAddModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={saving}>Create Code</Button>
          </div>
        </form>
      </Modal>

      {/* QR Preview Modal */}
      <Modal open={!!previewCode} title="QR Code Preview" onClose={() => setPreviewCode(null)}>
        {previewCode && (
          <div style={{ textAlign:'center' }}>
            <img src={previewCode.dataUrl} alt="QR Code" style={{ maxWidth:280, margin:'0 auto 16px' }} />
            <p className="td-code" style={{ fontSize:16, marginBottom:8 }}>
              {previewCode.verificationUrl?.split('code=')[1]}
            </p>
            <p style={{ fontSize:12, color:'var(--gray-500)', wordBreak:'break-all' }}>
              {previewCode.verificationUrl}
            </p>
            <a href={previewCode.dataUrl} download={`${previewCode.verificationUrl?.split('code=')[1]}.png`}>
              <Button variant="primary" style={{ marginTop:16 }}>⬇ Download PNG</Button>
            </a>
          </div>
        )}
      </Modal>

      {/* Delete single */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete QR Code"
        message={`Delete code "${deleteTarget?.code}"? Its scan history will also be removed.`}
        danger loading={saving}
        onConfirm={doDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Bulk delete */}
      <ConfirmModal
        open={bulkDeleteOpen}
        title={`Delete ${selected.size} QR Codes`}
        message={`This will permanently delete ${selected.size} selected code(s) and their scan history. This cannot be undone.`}
        danger loading={saving}
        onConfirm={bulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />
    </div>
  );
}
