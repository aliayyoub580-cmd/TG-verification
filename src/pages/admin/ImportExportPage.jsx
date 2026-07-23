import React, { useState, useRef } from 'react';
import { qrAPI } from '../../services/api.js';
import Button from '../../components/Button.jsx';
import Badge from '../../components/Badge.jsx';
import { downloadBlob, fmt } from '../../utils/download.js';
import toast from 'react-hot-toast';

export default function ImportExportPage() {
  const [tab, setTab]             = useState('import'); // 'import' | 'export'
  const fileRef = useRef(null);

  // Import state
  const [file, setFile]           = useState(null);
  const [preview, setPreview]     = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Export state
  const [exportStatus, setExportStatus]   = useState('');
  const [exporting, setExporting]         = useState(false);

  /* ── File handling ─────────────────────────────────────────────────────── */
  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.csv')) {
      toast.error('Only CSV files are accepted');
      return;
    }
    setFile(f);
    setPreview(null);
    setImportResult(null);
  };

  const handlePreview = async () => {
    if (!file) return;
    setPreviewLoading(true);
    try {
      const { data } = await qrAPI.previewImport(file);
      setPreview(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Preview failed');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const { data } = await qrAPI.import(file, skipDuplicates);
      setImportResult(data.data);
      toast.success(`Import complete: ${fmt(data.data.imported)} codes imported`);
      setFile(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  /* ── Export ────────────────────────────────────────────────────────────── */
  const handleExport = async () => {
    setExporting(true);
    try {
      const baseUrl = window.location.origin;
      const { data } = await qrAPI.export({
        status: exportStatus || undefined,
        baseUrl,
      });
      downloadBlob(data, `qr-export-${Date.now()}.csv`);
      toast.success('CSV exported');
    } catch { toast.error('Export failed'); } finally { setExporting(false); }
  };

  const handleTemplate = async () => {
    try {
      const { data } = await qrAPI.downloadTemplate();
      downloadBlob(data, 'qr-import-template.csv');
    } catch { toast.error('Failed to download template'); }
  };

  /* ── Drag & drop ───────────────────────────────────────────────────────── */
  const onDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Import / Export</h1>
          <p className="page-subtitle">Bulk import QR codes from CSV or export existing codes</p>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:4, marginBottom:24, borderBottom:'2px solid var(--gray-200)', paddingBottom:0 }}>
        {['import','export'].map((t) => (
          <button key={t}
            onClick={() => setTab(t)}
            style={{
              padding:'10px 20px',
              fontWeight:600,
              fontSize:14,
              color: tab === t ? 'var(--green-700)' : 'var(--gray-500)',
              borderBottom: tab === t ? '2px solid var(--green-600)' : '2px solid transparent',
              marginBottom: -2,
              background: 'transparent',
              transition: 'color 0.15s',
            }}
          >
            {t === 'import' ? '📥 Import CSV' : '📤 Export CSV'}
          </button>
        ))}
      </div>

      {/* ── IMPORT ─────────────────────────────────────────────────────────── */}
      {tab === 'import' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, alignItems:'start' }}>
          <div>
            <div className="card" style={{ marginBottom:20 }}>
              <div className="card-header">
                <span className="card-title">Upload CSV File</span>
                <Button size="sm" variant="ghost" onClick={handleTemplate}>⬇ Download Template</Button>
              </div>
              <div className="card-body">
                {/* CSV format info */}
                <div className="alert alert--info" style={{ marginBottom:20 }}>
                  <span>ℹ️</span>
                  <div>
                    <strong>Accepted CSV format:</strong>
                    <pre style={{ marginTop:6, fontSize:12, fontFamily:'monospace', background:'rgba(0,0,0,0.04)', padding:'8px 10px', borderRadius:6 }}>
{`code,batch_number,status
AFMU000SZQ,batch-2,active
BKMU921XRT,batch-2,active`}
                    </pre>
                    <p style={{ marginTop:6, fontSize:12 }}>Codes are preserved exactly as supplied (trimmed &amp; uppercased only).</p>
                  </div>
                </div>

                {/* Drop zone */}
                <div
                  className={`upload-zone ${isDragging ? 'upload-zone--drag' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                >
                  <div className="upload-zone__icon">📂</div>
                  <p className="upload-zone__title">
                    {file ? file.name : 'Drop CSV here or click to browse'}
                  </p>
                  <p className="upload-zone__sub">
                    {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Max 20 MB · CSV format'}
                  </p>
                  <input ref={fileRef} type="file" accept=".csv" style={{ display:'none' }}
                    onChange={(e) => handleFile(e.target.files[0])} />
                </div>

                {file && !preview && (
                  <Button variant="outline" style={{ width:'100%', marginTop:16 }}
                    onClick={handlePreview} loading={previewLoading}>
                    🔍 Preview Import
                  </Button>
                )}

                {/* Skip duplicates */}
                <div className="checkbox-row" style={{ marginTop:12 }}>
                  <input type="checkbox" id="skip-dup" checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)} />
                  <label htmlFor="skip-dup">Skip duplicate codes (already in database)</label>
                </div>
              </div>
            </div>
          </div>

          <div>
            {/* Preview results */}
            {preview && (
              <div className="card" style={{ marginBottom:20 }}>
                <div className="card-header">
                  <span className="card-title">Preview Results</span>
                </div>
                <div className="card-body">
                  <div className="result-summary">
                    <div className="result-chip result-chip--gray">
                      <div className="result-chip__num">{fmt(preview.totalRows)}</div>
                      <div className="result-chip__label">Total Rows</div>
                    </div>
                    <div className="result-chip result-chip--green">
                      <div className="result-chip__num">{fmt(preview.importReady)}</div>
                      <div className="result-chip__label">Ready to Import</div>
                    </div>
                    <div className="result-chip result-chip--amber">
                      <div className="result-chip__num">{fmt(preview.duplicatesInFile + preview.duplicatesInDB)}</div>
                      <div className="result-chip__label">Duplicates</div>
                    </div>
                    <div className="result-chip result-chip--red">
                      <div className="result-chip__num">{fmt(preview.invalid)}</div>
                      <div className="result-chip__label">Invalid</div>
                    </div>
                  </div>

                  {preview.sample?.length > 0 && (
                    <div style={{ marginTop:16 }}>
                      <p style={{ fontSize:12, fontWeight:600, color:'var(--gray-600)', marginBottom:8 }}>Sample (first 5 valid rows)</p>
                      <div className="table-wrap">
                        <table>
                          <thead><tr><th>Code</th><th>Batch Number</th><th>Status</th></tr></thead>
                          <tbody>
                            {preview.sample.map((s, i) => (
                              <tr key={i}>
                                <td className="td-code">{s.code}</td>
                                <td>{s.batch_number}</td>
                                <td><Badge label={s.status} type={s.status} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {preview.importReady > 0 && (
                    <Button variant="primary" size="lg" style={{ width:'100%', marginTop:20 }}
                      onClick={handleImport} loading={importing}>
                      ✅ Confirm Import {fmt(preview.importReady)} Codes
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Import result */}
            {importResult && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Import Complete</span>
                </div>
                <div className="card-body">
                  <div className="result-summary">
                    <div className="result-chip result-chip--green">
                      <div className="result-chip__num">{fmt(importResult.imported)}</div>
                      <div className="result-chip__label">Imported</div>
                    </div>
                    <div className="result-chip result-chip--amber">
                      <div className="result-chip__num">{fmt(importResult.skipped)}</div>
                      <div className="result-chip__label">Skipped</div>
                    </div>
                    <div className="result-chip result-chip--red">
                      <div className="result-chip__num">{fmt(importResult.failed)}</div>
                      <div className="result-chip__label">Failed</div>
                    </div>
                  </div>
                  {importResult.details?.failed?.length > 0 && (
                    <div style={{ marginTop:16 }}>
                      <p style={{ fontSize:12, fontWeight:600, color:'var(--red-700)', marginBottom:8 }}>
                        Failed rows ({importResult.details.failed.length}):
                      </p>
                      <div style={{ maxHeight:160, overflowY:'auto', fontSize:12, fontFamily:'monospace', background:'var(--red-50)', padding:10, borderRadius:6, border:'1px solid var(--red-100)' }}>
                        {importResult.details.failed.slice(0, 50).map((f, i) => (
                          <div key={i} style={{ marginBottom:2 }}>
                            Row {f.row}: {f.code} — {f.reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── EXPORT ─────────────────────────────────────────────────────────── */}
      {tab === 'export' && (
        <div style={{ maxWidth:520 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">Export QR Codes to CSV</span></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Filter by Status</label>
                <select className="form-control form-select" value={exportStatus}
                  onChange={(e) => setExportStatus(e.target.value)}>
                  <option value="">All statuses</option>
                  <option value="active">Active only</option>
                  <option value="inactive">Inactive only</option>
                </select>
              </div>
              <div className="alert alert--info" style={{ marginBottom:20 }}>
                <span>ℹ️</span>
                <div style={{ fontSize:13 }}>
                  Exported CSV columns: <code>code, batch_number, status</code>
                </div>
              </div>

              <Button variant="primary" size="lg" style={{ width:'100%' }}
                onClick={handleExport} loading={exporting}>
                📤 Export CSV
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
