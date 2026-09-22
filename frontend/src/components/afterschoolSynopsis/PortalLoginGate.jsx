// frontend/src/components/afterschoolSynopsis/PortalLoginGate.jsx
//
// Shared-credential gate for the teacher-facing portal. Not Firebase auth —
// a single static portal-wide credential, verified server-side (the actual
// values are never present in this file or any other frontend code).

import { useState } from 'react';
import { portalLogin } from '../../services/afterschoolSynopsisService';
import { PORTAL_SESSION_KEY } from '../../constants/afterschoolSynopsisSchema';

const FONT = "'DM Sans', sans-serif";
const SERIF = "'DM Serif Display', serif";

const inputStyle = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1.5px solid rgba(255,255,255,0.9)', fontSize: 14,
  fontFamily: FONT, color: '#1e1e2e', background: 'rgba(255,255,255,0.8)',
  outline: 'none', boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600, color: '#8b7355',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em',
};

export default function PortalLoginGate({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await portalLogin(username, password);
      try { sessionStorage.setItem(PORTAL_SESSION_KEY, '1'); } catch { /* private mode etc — non-fatal */ }
      onSuccess();
    } catch (err) {
      setError(err.message || 'Incorrect username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: '80px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 26, color: '#1C1917', margin: '0 0 8px' }}>
          After-School &amp; ECA Synopsis
        </h1>
        <p style={{ fontSize: 14, color: '#6B6459', margin: 0 }}>
          Enter the shared teacher portal credentials to continue.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{
        background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.9)', borderRadius: 18, padding: '28px 26px',
      }}>
        {error && (
          <div style={{ fontSize: 13, color: '#c0392b', marginBottom: 16, padding: '10px 14px', background: '#fff5f5', borderRadius: 8 }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Username</label>
          <input
            type="text" value={username} onChange={(e) => setUsername(e.target.value)}
            required autoFocus style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 22 }}>
          <label style={labelStyle}>Password</label>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            required style={inputStyle}
          />
        </div>

        <button
          type="submit" disabled={loading}
          style={{
            width: '100%', padding: '13px', borderRadius: 100,
            background: loading ? '#c8bfb5' : '#1C1917', color: '#FAF8F4',
            border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 15, fontWeight: 600, fontFamily: FONT,
          }}
        >
          {loading ? 'Checking…' : 'Enter portal'}
        </button>
      </form>
    </div>
  );
}
