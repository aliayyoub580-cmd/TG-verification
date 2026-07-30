import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { newsAPI } from '../../services/api.js';
import Button from '../../components/Button.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Modal, { ConfirmModal } from '../../components/Modal.jsx';
import StatCard from '../../components/StatCard.jsx';
import { useDebounce } from '../../hooks/useDebounce.js';
import { fmtDate } from '../../utils/download.js';

function nextRefresh() {
  const next = new Date();
  next.setUTCHours(0, 5, 0, 0);
  if (next <= new Date()) next.setUTCDate(next.getUTCDate() + 1);
  return fmtDate(next.toISOString());
}

function NewsSkeleton() {
  return <div className="news-skeleton" aria-label="Loading news">
    {[1, 2, 3, 4].map((row) => <div className="news-skeleton__row" key={row} />)}
  </div>;
}

export default function NewsPage() {
  const [articles, setArticles] = useState([]);
  const [sources, setSources] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Auto-fetch test schedule configuration state
  const [autoFetchInterval, setAutoFetchInterval] = useState(() => {
    return localStorage.getItem('news_auto_fetch_interval') || 'daily';
  });
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const debouncedSearch = useDebounce(search, 350);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await newsAPI.list({
        search: debouncedSearch || undefined,
        source: source || undefined,
        sort,
      });
      setArticles(data.data || []);
      setSources(data.sources || []);
      setTotal(data.total || 0);
    } catch {
      setError('News could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, source, sort]);

  useEffect(() => { load(); }, [load]);

  const lastUpdated = useMemo(() => {
    const dates = articles.map((item) => item.fetched_at).filter(Boolean);
    return dates.length ? fmtDate(dates.sort().at(-1)) : 'Not yet';
  }, [articles]);

  const handleRefresh = useCallback(async (opts = {}) => {
    setRefreshing(true);
    try {
      const { data } = await newsAPI.refresh();
      if (opts.isAuto) {
        toast.success('⚡ Auto-fetch timer triggered: News refreshed automatically!');
      } else {
        toast.success(data.message || 'News refreshed successfully');
      }
      setConfirmRefresh(false);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'News refresh failed');
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  // Interval countdown effect for automatic testing
  useEffect(() => {
    if (autoFetchInterval === 'off') {
      setSecondsLeft(null);
      return;
    }

    const intervalSecs = {
      '1min': 60,
      '5min': 300,
      '15min': 900,
      '1hour': 3600,
      'daily': 86400,
    }[autoFetchInterval] || 60;

    setSecondsLeft(intervalSecs);

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          handleRefresh({ isAuto: true });
          return intervalSecs;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoFetchInterval, handleRefresh]);

  function handleSaveInterval(mode) {
    setAutoFetchInterval(mode);
    localStorage.setItem('news_auto_fetch_interval', mode);
    toast.success(`Auto-fetch schedule updated: ${mode}`);
  }

  function formatSeconds(secs) {
    if (secs === null) return 'Paused';
    if (secs >= 3600) {
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      return `${h}h ${m}m`;
    }
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await newsAPI.delete(deleteTarget.id);
      toast.success('News article deleted');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally { setDeleting(false); }
  }

  return <div className="news-page">
    <div className="page-header">
      <div>
        <h1 className="page-title">News</h1>
        <p className="page-subtitle">Manage and test automatically fetched daily news articles.</p>
      </div>
      <div className="page-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Button variant="secondary" onClick={() => setShowConfigModal(true)}>
          ⚙️ Auto-Fetch Schedule ({autoFetchInterval === 'daily' ? 'Daily' : autoFetchInterval === 'off' ? 'Paused' : autoFetchInterval})
        </Button>
        <Button onClick={() => setConfirmRefresh(true)} loading={refreshing}>
          ↻ Refresh News Now
        </Button>
      </div>
    </div>

    <div className="stats-grid">
      <StatCard label="Total News" value={total} icon="📰" color="green" />
      <StatCard label="Last Updated" value={lastUpdated} icon="◷" color="blue" />
      <StatCard label="News Source" value="Spaceflight News" icon="◎" color="amber" />
      <StatCard
        label="Auto-Fetch Schedule"
        value={
          autoFetchInterval === 'off'
            ? 'Paused'
            : autoFetchInterval === 'daily'
            ? nextRefresh()
            : `Next in ${formatSeconds(secondsLeft)}`
        }
        icon="⏱️"
        color={autoFetchInterval === 'off' ? 'amber' : 'green'}
        sub={autoFetchInterval !== 'off' && autoFetchInterval !== 'daily' ? `Mode: Every ${autoFetchInterval}` : '12:05 AM UTC Daily'}
      />
    </div>

    <div className="filter-bar">
      <input className="form-control" placeholder="Search by title…"
        value={search} onChange={(event) => setSearch(event.target.value)} />
      <select className="form-control form-select" value={source}
        onChange={(event) => setSource(event.target.value)} style={{ maxWidth: 210 }}>
        <option value="">All news sources</option>
        {sources.map((item) => <option value={item} key={item}>{item}</option>)}
      </select>
      <select className="form-control form-select" value={sort}
        onChange={(event) => setSort(event.target.value)} style={{ maxWidth: 180 }}>
        <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
      </select>
    </div>

    <div className="card">
      {loading ? <NewsSkeleton /> : error ? <div className="news-error">
        <p>{error}</p><Button variant="secondary" size="sm" onClick={load}>Try Again</Button>
      </div> : articles.length === 0 ? <EmptyState icon="📰" title="No news found"
        description="Refresh news or adjust the current search and filters." /> : (
        <div className="table-wrap news-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="news-table"><thead><tr>
            <th>Image</th><th>Title</th><th>News Site</th><th>Published Date</th>
            <th>Fetched Date</th><th>Status</th><th>Actions</th>
          </tr></thead><tbody>{articles.map((item) => <tr key={item.id}>
            <td data-label="Image">{item.image_url
              ? <img className="news-thumb" src={item.image_url} alt="" loading="lazy" />
              : <div className="news-thumb news-thumb--empty">📰</div>}</td>
            <td data-label="Title"><strong className="news-title">{item.title}</strong></td>
            <td data-label="News Site">{item.news_site || '—'}</td>
            <td data-label="Published">{fmtDate(item.published_at)}</td>
            <td data-label="Fetched">{fmtDate(item.fetched_at)}</td>
            <td data-label="Status"><span className="badge badge-green">Published</span></td>
            <td data-label="Actions"><div className="td-actions">
              <Button variant="ghost" size="sm" onClick={() => setDetail(item)}>View Details</Button>
              <a className="btn btn--sm btn-ghost" href={item.article_url}
                target="_blank" rel="noopener noreferrer">Open Original</a>
              <Button variant="danger" size="sm" onClick={() => setDeleteTarget(item)}>Delete</Button>
            </div></td>
          </tr>)}</tbody></table>
        </div>)}
    </div>

    <ConfirmModal open={confirmRefresh} title="Refresh News"
      message="Fetch and replace the current news with the latest articles?"
      onConfirm={() => handleRefresh()} onCancel={() => setConfirmRefresh(false)} loading={refreshing} />
    <ConfirmModal open={Boolean(deleteTarget)} title="Delete News Article" danger
      message={`Delete “${deleteTarget?.title || ''}”? This cannot be undone.`}
      onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    <Modal open={Boolean(detail)} title="News Details" onClose={() => setDetail(null)}
      footer={detail && <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <a className="btn btn--md btn-primary" href={detail.article_url}
          target="_blank" rel="noopener noreferrer">Open Original Article ↗</a></div>}>
      {detail && <div className="news-detail">
        {detail.image_url && <img src={detail.image_url} alt="" className="news-detail__image" />}
        <h3>{detail.title}</h3><p>{detail.summary || 'No summary is available.'}</p>
        <dl><dt>News source</dt><dd>{detail.news_site || '—'}</dd>
          <dt>Published</dt><dd>{fmtDate(detail.published_at)}</dd>
          <dt>Fetched</dt><dd>{fmtDate(detail.fetched_at)}</dd></dl>
      </div>}
    </Modal>

    {/* Auto-Fetch Schedule & Test Configuration Modal */}
    <Modal
      open={showConfigModal}
      title="⏱️ Configure News Auto-Fetch Schedule"
      onClose={() => setShowConfigModal(false)}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <Button
            variant="secondary"
            onClick={() => {
              setShowConfigModal(false);
              handleRefresh({ isAuto: true });
            }}
            loading={refreshing}
          >
            ⚡ Run Auto-Fetch Test Now
          </Button>
          <Button variant="primary" onClick={() => setShowConfigModal(false)}>
            Save & Close
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={{ color: 'var(--gray-600)', fontSize: '14px', lineHeight: '1.5', margin: 0 }}>
          Configure the automatic news fetching frequency. Choose a fast interval (1 min or 5 min) to test and verify automatic news replacement in real-time.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { id: '1min', label: '⚡ Every 1 Minute (Rapid Test Mode)', desc: 'Automatically triggers news fetch & replacement every 60 seconds.' },
            { id: '5min', label: '⚡ Every 5 Minutes (Fast Test Mode)', desc: 'Automatically triggers news fetch & replacement every 5 minutes.' },
            { id: '15min', label: '⏱️ Every 15 Minutes', desc: 'Triggers news fetch & replacement every 15 minutes.' },
            { id: '1hour', label: '⏱️ Every 1 Hour', desc: 'Triggers news fetch & replacement every hour.' },
            { id: 'daily', label: '📅 Daily (Default - 12:05 AM UTC)', desc: 'Standard daily production schedule.' },
            { id: 'off', label: '⏸️ Paused / Off', desc: 'Disables automatic test timer.' },
          ].map((opt) => (
            <label
              key={opt.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '8px',
                border: autoFetchInterval === opt.id ? '2px solid var(--green-600)' : '1px solid var(--gray-200)',
                background: autoFetchInterval === opt.id ? 'var(--green-50, #f0fdf4)' : '#fff',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="radio"
                name="autoFetchInterval"
                value={opt.id}
                checked={autoFetchInterval === opt.id}
                onChange={() => handleSaveInterval(opt.id)}
                style={{ marginTop: '3px' }}
              />
              <div>
                <strong style={{ display: 'block', fontSize: '14px', color: 'var(--gray-900)' }}>{opt.label}</strong>
                <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{opt.desc}</span>
              </div>
            </label>
          ))}
        </div>

        {autoFetchInterval !== 'off' && autoFetchInterval !== 'daily' && (
          <div style={{ padding: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '13px', color: '#1e40af' }}>
            ⏱️ <strong>Active Test Countdown:</strong> Next automatic fetch in <strong>{formatSeconds(secondsLeft)}</strong>.
          </div>
        )}
      </div>
    </Modal>
  </div>;
}

