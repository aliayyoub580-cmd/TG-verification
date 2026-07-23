import React from 'react';

export default function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const delta = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  return (
    <div className="pagination">
      <button className="pagination-btn" disabled={page === 1} onClick={() => onPage(page - 1)}>‹ Prev</button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="pagination-ellipsis">…</span>
        ) : (
          <button
            key={p}
            className={`pagination-btn ${p === page ? 'pagination-btn--active' : ''}`}
            onClick={() => onPage(p)}
          >{p}</button>
        )
      )}
      <button className="pagination-btn" disabled={page === totalPages} onClick={() => onPage(page + 1)}>Next ›</button>
    </div>
  );
}
