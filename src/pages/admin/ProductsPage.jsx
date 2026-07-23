import React, { useState, useEffect, useCallback } from 'react';
import { productsAPI } from '../../services/api.js';
import Button from '../../components/Button.jsx';
import Badge from '../../components/Badge.jsx';
import Pagination from '../../components/Pagination.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Modal, { ConfirmModal } from '../../components/Modal.jsx';
import Spinner from '../../components/Spinner.jsx';
import toast from 'react-hot-toast';
import { fmtDate } from '../../utils/download.js';

/* ── Form ─────────────────────────────────────────────────────────────────── */
function ProductForm({ initial, onSave, onCancel, loading }) {
  const [form, setForm] = useState({
    name: '', medicine_name: '', dosage: '', description: '',
    company_name: 'Indufar',
    success_message: "This code matches our records. Compare it with the code printed on your product's packaging.",
    footer_text: 'Secured verification · Powered by Indufar',
    status: 'active',
    ...initial,
  });
  const [productImage, setProductImage] = useState(null);
  const [companyLogo, setCompanyLogo]   = useState(null);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.company_name.trim()) {
      toast.error('Name and company name are required.');
      return;
    }
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, v); });
    if (productImage) fd.append('product_image', productImage);
    if (companyLogo)  fd.append('company_logo',  companyLogo);
    onSave(fd);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div className="form-group" style={{ gridColumn:'1/-1' }}>
          <label className="form-label">Product Name <span className="req">*</span></label>
          <input className="form-control" value={form.name} onChange={set('name')} placeholder="T.G. 15 mg" />
        </div>
        <div className="form-group">
          <label className="form-label">Medicine Name</label>
          <input className="form-control" value={form.medicine_name} onChange={set('medicine_name')} placeholder="Tirzepatida" />
        </div>
        <div className="form-group">
          <label className="form-label">Dosage</label>
          <input className="form-control" value={form.dosage} onChange={set('dosage')} placeholder="15 mg/0.5mL" />
        </div>
        <div className="form-group" style={{ gridColumn:'1/-1' }}>
          <label className="form-label">Description</label>
          <textarea className="form-control" rows={2} value={form.description} onChange={set('description')} />
        </div>
        <div className="form-group">
          <label className="form-label">Company Name <span className="req">*</span></label>
          <input className="form-control" value={form.company_name} onChange={set('company_name')} />
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-control form-select" value={form.status} onChange={set('status')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="form-group" style={{ gridColumn:'1/-1' }}>
          <label className="form-label">Success Message</label>
          <textarea className="form-control" rows={2} value={form.success_message} onChange={set('success_message')} />
        </div>
        <div className="form-group" style={{ gridColumn:'1/-1' }}>
          <label className="form-label">Footer Text</label>
          <input className="form-control" value={form.footer_text} onChange={set('footer_text')} />
        </div>

        {/* Images */}
        <div className="form-group">
          <label className="form-label">Product Image</label>
          <input type="file" className="form-control" accept="image/*"
            onChange={(e) => setProductImage(e.target.files[0] || null)} />
          {(initial?.product_image_url && !productImage) && (
            <img src={initial.product_image_url} className="img-preview" alt="Current product" />
          )}
          {productImage && (
            <img src={URL.createObjectURL(productImage)} className="img-preview" alt="Preview" />
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Company Logo</label>
          <input type="file" className="form-control" accept="image/*"
            onChange={(e) => setCompanyLogo(e.target.files[0] || null)} />
          {(initial?.company_logo_url && !companyLogo) && (
            <img src={initial.company_logo_url} className="img-preview" alt="Current logo" />
          )}
          {companyLogo && (
            <img src={URL.createObjectURL(companyLogo)} className="img-preview" alt="Preview" />
          )}
        </div>
      </div>

      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
        <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit" loading={loading}>
          {initial?.id ? 'Save Changes' : 'Create Product'}
        </Button>
      </div>
    </form>
  );
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function ProductsPage() {
  const [products, setProducts]     = useState([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [search, setSearch]         = useState('');
  const [formModal, setFormModal]   = useState(null); // null | 'create' | product object
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    productsAPI.list({ page, limit: 20, search: search || undefined })
      .then(({ data }) => {
        setProducts(data.data || []);
        setTotal(data.pagination?.total || 0);
      })
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (formData) => {
    setSaving(true);
    try {
      if (formModal?.id) {
        await productsAPI.update(formModal.id, formData);
        toast.success('Product updated');
      } else {
        await productsAPI.create(formData);
        toast.success('Product created');
      }
      setFormModal(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await productsAPI.delete(deleteTarget.id);
      toast.success('Product deleted');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">{total} product{total !== 1 ? 's' : ''} total</p>
        </div>
        <div className="page-actions">
          <Button variant="primary" onClick={() => setFormModal('create')}>+ Add Product</Button>
        </div>
      </div>

      <div className="filter-bar">
        <input
          className="form-control"
          placeholder="Search products…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <div className="card">
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner size={32} /></div>
        ) : products.length === 0 ? (
          <EmptyState icon="💊" title="No products yet"
            description="Add your first product to start generating QR codes."
            action={<Button variant="primary" onClick={() => setFormModal('create')}>+ Add Product</Button>}
          />
        ) : (
          <div className="table-wrap" style={{ border:'none', borderRadius:0 }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Medicine</th>
                  <th>Company</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        {p.company_logo_url && (
                          <img src={p.company_logo_url} alt="" style={{ width:32, height:32, objectFit:'contain', borderRadius:4 }} />
                        )}
                        <div>
                          <div style={{ fontWeight:600, fontSize:14 }}>{p.name}</div>
                          {p.dosage && <div style={{ fontSize:12, color:'var(--gray-500)' }}>{p.dosage}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize:13 }}>{p.medicine_name || '—'}</td>
                    <td style={{ fontSize:13 }}>{p.company_name}</td>
                    <td><Badge label={p.status} type={p.status} /></td>
                    <td style={{ fontSize:12, color:'var(--gray-400)', whiteSpace:'nowrap' }}>{fmtDate(p.created_at)}</td>
                    <td>
                      <div className="td-actions">
                        <Button size="sm" variant="secondary" onClick={() => setFormModal(p)}>Edit</Button>
                        <Button size="sm" variant="danger" onClick={() => setDeleteTarget(p)}>Delete</Button>
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

      {/* Create / Edit Modal */}
      <Modal
        open={formModal !== null}
        title={formModal?.id ? 'Edit Product' : 'Add Product'}
        onClose={() => setFormModal(null)}
      >
        {formModal !== null && (
          <ProductForm
            initial={formModal === 'create' ? {} : formModal}
            onSave={handleSave}
            onCancel={() => setFormModal(null)}
            loading={saving}
          />
        )}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete Product"
        message={`Delete "${deleteTarget?.name}"? This action cannot be undone. Products with associated QR codes cannot be deleted.`}
        danger
        loading={saving}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
