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

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const { data } = await newsAPI.refresh();
      toast.success(data.message || 'News refreshed');
      setConfirmRefresh(false);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'News refresh failed');
    } finally { setRefreshing(false); }
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
      <div><h1 className="page-title">News</h1>
        <p className="page-subtitle">Manage the latest automatically fetched news articles.</p></div>
      <div className="page-actions">
        <Button onClick={() => setConfirmRefresh(true)} loading={refreshing}>↻ Refresh News</Button>
      </div>
    </div>

    <div className="stats-grid">
      <StatCard label="Total News" value={total} icon="📰" color="green" />
      <StatCard label="Last Updated" value={lastUpdated} icon="◷" color="blue" />
      <StatCard label="News Source" value="Spaceflight News" icon="◎" color="amber" />
      <StatCard label="Next Scheduled Refresh" value={nextRefresh()} icon="↻" color="green" sub="12:05 AM UTC" />
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
      onConfirm={handleRefresh} onCancel={() => setConfirmRefresh(false)} loading={refreshing} />
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
  </div>;
}
