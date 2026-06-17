// frontend/src/components/synopsis/AdminLoginModal.jsx
import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { X } from 'lucide-react';

export default function AdminLoginModal({ onClose }) {
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
      onClose();
    } catch (err) {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      backgroundColor: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#FFFFFF', borderRadius: 20, padding: '36px 40px',
        width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        position: 'relative', fontFamily: "'DM Sans', sans-serif",
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#6B6459', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={18} />
        </button>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: '#1C1917', marginBottom: 6 }}>
            Admin login
          </div>
          <div style={{ fontSize: 13, color: '#6B6459', lineHeight: 1.5 }}>
            This portal is only for ICC staff with an{' '}
            <span style={{ fontWeight: 600, color: '#1C1917' }}>@indiacc.org</span> email address.
            Teachers do not need to log in.
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5c4a32', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="admin@indiacc.org"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                border: '1px solid #E5E0D8', fontSize: 14, color: '#1C1917',
                fontFamily: "'DM Sans', sans-serif", outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5c4a32', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                border: '1px solid #E5E0D8', fontSize: 14, color: '#1C1917',
                fontFamily: "'DM Sans', sans-serif", outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{ fontSize: 13, color: '#c0392b', marginBottom: 16, padding: '8px 12px', background: '#fff5f5', borderRadius: 8 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px', borderRadius: 100,
              background: loading ? '#c8bfb5' : '#1C1917', color: '#FAF8F4',
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 500, fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
