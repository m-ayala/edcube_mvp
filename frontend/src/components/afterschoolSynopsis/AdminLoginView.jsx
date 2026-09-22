// frontend/src/components/afterschoolSynopsis/AdminLoginView.jsx
//
// Full-page Firebase email/password admin login (not a modal), same shape as
// the camp feature's AdminLoginModal.jsx but rendered as its own page view
// per this feature's mockup. Real Firebase auth, separate from the teacher's
// shared portal credential.

import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { ArrowLeft } from 'lucide-react';

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

export default function AdminLoginView({ onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // AfterschoolSynopsisPage watches currentUser via useAuth() and
      // transitions to the admin home once Firebase auth state updates.
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: '80px 24px' }}>
      <button onClick={onBack} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 13, color: '#6B6459', padding: 0, marginBottom: 24,
      }}>
        <ArrowLeft size={15} /> Back
      </button>

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 24, color: '#1C1917', margin: '0 0 8px' }}>
          Admin login
        </h1>
        <p style={{ fontSize: 13, color: '#6B6459', lineHeight: 1.5, margin: 0 }}>
          This portal is only for ICC staff with an{' '}
          <span style={{ fontWeight: 600, color: '#1C1917' }}>@indiacc.org</span> email address.
          Teachers do not need to log in here.
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
          <label style={labelStyle}>Email</label>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            required placeholder="admin@indiacc.org" style={inputStyle}
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
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
