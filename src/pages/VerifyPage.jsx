import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { verifyAPI } from '../services/api.js';
import '../styles/verify.css';

export default function VerifyPage() {
  const [params] = useSearchParams();
  const code = params.get('code');

  const [state, setState] = useState('idle'); // idle | loading | authentic | inactive | not_found | missing_code | error
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!code) {
      setState('missing_code');
      return;
    }
    setState('loading');
    verifyAPI.check(code)
      .then(({ data: res }) => {
        setState(res.status);
        setData(res.data || null);
        setMessage(res.message || '');
      })
      .catch((err) => {
        const res = err.response?.data;
        const serverFailure = !err.response || err.response.status >= 500;
        setState(serverFailure ? 'error' : (res?.status || 'not_found'));
        setMessage(serverFailure ? 'Verification is temporarily unavailable. Please try again shortly.' : (res?.message || 'Verification failed. Please try again.'));
      });
  }, [code]);

  return (
    <div className="verify-page">
      <div className="verify-container">
        {state === 'loading' && <LoadingSkeleton />}
        {state === 'authentic' && <AuthenticView data={data} code={code} />}
        {state === 'inactive' && <InactiveView code={code} message={message} />}
        {state === 'not_found' && <NotFoundView message={message} />}
        {state === 'missing_code' && <MissingCodeView />}
        {state === 'error' && <ErrorView message={message} />}
      </div>
    </div>
  );
}

/* ── Loading skeleton ──────────────────────────────────────────────────────── */
function LoadingSkeleton() {
  return (
    <div className="verify-skeleton">
      <div className="skeleton-logo" />
      <div className="skeleton-banner" />
      <div className="skeleton-image" />
      <div className="skeleton-text" />
      <div className="skeleton-text skeleton-text--short" />
    </div>
  );
}

/* ── Authentic ─────────────────────────────────────────────────────────────── */
function AuthenticView({ data, code }) {
  const product = data?.product || {};
  const logoUrl = product.logoUrl || '/imgi_1_logo.png';
  const productImageUrl = product.imageUrl || '/T.G.%2020mg.png';
  const useFallback = (fallback) => (event) => {
    if (!event.currentTarget.src.endsWith(fallback)) event.currentTarget.src = fallback;
  };
  return (
    <>
      {/* Logo */}
      <div className="verify-logo-wrap">
        <img src={logoUrl} onError={useFallback('/imgi_1_logo.png')} alt={product.companyName || 'Indufar logo'} className="verify-logo" />
      </div>

      {/* Product name */}
      <p className="verify-product-name">{product.name || 'T.G. 15 mg'}</p>
      {product.medicineName && (
        <p className="verify-medicine-name">{product.medicineName} {product.dosage}</p>
      )}

      {/* Success banner */}
      <div className="verify-banner verify-banner--authentic">
        <div className="verify-check-circle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <p className="verify-status-title">Authentic Product</p>
          <p className="verify-code-display">{code?.toUpperCase()}</p>
        </div>
      </div>

      {/* Product image */}
      <div className="verify-product-image-wrap">
        <img src={productImageUrl} onError={useFallback('/T.G.%2020mg.png')} alt={product.name || 'T.G. 15 mg'} className="verify-product-image" />
      </div>

      {/* Description */}
      <p className="verify-description">
        {product.successMessage ||
          "This code matches our records. Compare it with the code printed on your product's packaging."}
      </p>

      <hr className="verify-divider" />
      <p className="verify-footer">
        {product.footerText || 'Secured verification · Powered by Indufar'}
      </p>
    </>
  );
}

/* ── Inactive ──────────────────────────────────────────────────────────────── */
function InactiveView({ code, message }) {
  return (
    <>
      <div className="verify-logo-wrap">
        <div className="verify-logo-placeholder">Indufar</div>
      </div>
      <div className="verify-banner verify-banner--inactive">
        <div className="verify-warn-circle verify-warn-circle--amber">⚠</div>
        <div>
          <p className="verify-status-title">Code Inactive</p>
          <p className="verify-code-display">{code?.toUpperCase()}</p>
        </div>
      </div>
      <p className="verify-description">
        {message || 'This code exists but is currently inactive. It may have been recalled or deactivated. Please contact the seller for assistance.'}
      </p>
      <hr className="verify-divider" />
      <p className="verify-footer">Secured verification · Powered by Indufar</p>
    </>
  );
}

/* ── Not found ─────────────────────────────────────────────────────────────── */
function NotFoundView({ message }) {
  return (
    <>
      <div className="verify-logo-wrap">
        <div className="verify-logo-placeholder">Indufar</div>
      </div>
      <div className="verify-banner verify-banner--notfound">
        <div className="verify-warn-circle verify-warn-circle--red">✕</div>
        <div>
          <p className="verify-status-title">Not Verified</p>
        </div>
      </div>
      <p className="verify-description">
        {message || 'This code does not match our official records. Please verify the code printed on the packaging or contact the seller.'}
      </p>
      <hr className="verify-divider" />
      <p className="verify-footer">Secured verification · Powered by Indufar</p>
    </>
  );
}

/* ── Missing code ──────────────────────────────────────────────────────────── */
function MissingCodeView() {
  return (
    <>
      <div className="verify-logo-wrap">
        <div className="verify-logo-placeholder">Indufar</div>
      </div>
      <div className="verify-banner verify-banner--notfound">
        <div className="verify-warn-circle verify-warn-circle--red">?</div>
        <div>
          <p className="verify-status-title">No Code Provided</p>
        </div>
      </div>
      <p className="verify-description">
        Please scan a valid QR code printed on your product packaging to verify authenticity.
      </p>
      <hr className="verify-divider" />
      <p className="verify-footer">Secured verification · Powered by Indufar</p>
    </>
  );
}

function ErrorView({ message }) {
  return (
    <>
      <div className="verify-logo-wrap"><div className="verify-logo-placeholder">Indufar</div></div>
      <div className="verify-banner verify-banner--inactive">
        <div className="verify-warn-circle verify-warn-circle--amber">!</div>
        <div><p className="verify-status-title">Verification Unavailable</p></div>
      </div>
      <p className="verify-description">{message}</p>
      <hr className="verify-divider" />
      <p className="verify-footer">Secured verification · Powered by Indufar</p>
    </>
  );
}
