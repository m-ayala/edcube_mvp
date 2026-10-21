// frontend/src/components/modals/UpgradeToProModal.jsx
// Pro waitlist/request form. There is no billing: this only emails the EdCube team
// through the existing contact route.
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const inputStyle = {
  width: '100%', padding: '10px 12px', border: '1px solid #D0CAC0', borderRadius: '6px',
  fontSize: '15px', fontFamily: 'inherit', boxSizing: 'border-box',
};
const labelStyle = { display: 'block', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#444', margin: '12px 0 4px' };

const UpgradeToProModal = ({ onClose }) => {
  const { currentUser } = useAuth();
  const [name, setName] = useState(currentUser?.displayName || '');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error

  const submit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || 'EdCube user',
          email: currentUser?.email || '',
          org: 'EdCube public space (Free plan)',
          message: `Pro plan request\n\n${message.trim() || '(no message)'}`,
          type: 'pro',
        }),
      });
      if (!res.ok) throw new Error('Request failed');
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2001,
        fontFamily: "'DM Sans', sans-serif",
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Upgrade to Pro"
        style={{ backgroundColor: 'white', borderRadius: '8px', padding: '30px', maxWidth: '420px', width: '90%', textAlign: 'center' }}
        onClick={(e) => e.stopPropagation()}
      >
        {status === 'success' ? (
          <>
            <h2 style={{ marginTop: 0, color: '#2C5F3A', fontSize: '22px' }}>Thanks — we'll be in touch</h2>
            <p style={{ color: '#666', marginBottom: '24px' }}>We got your Pro plan request and will email you at {currentUser?.email}.</p>
            <button
              onClick={onClose}
              style={{ padding: '12px 28px', backgroundColor: '#2C5F3A', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontFamily: 'inherit' }}
            >
              Close
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <h2 style={{ marginTop: 0, color: '#2C5F3A', fontSize: '22px' }}>Upgrade to Pro</h2>
            <p style={{ color: '#666', margin: 0 }}>Tell us a bit about how you use EdCube and we'll reach out about Pro.</p>
            <label style={labelStyle} htmlFor="upg-name">Name</label>
            <input id="upg-name" style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} required />
            <label style={labelStyle} htmlFor="upg-email">Email</label>
            <input id="upg-email" style={{ ...inputStyle, backgroundColor: '#F4F4F2', color: '#666' }} value={currentUser?.email || ''} readOnly />
            <label style={labelStyle} htmlFor="upg-msg">How do you use EdCube? (optional)</label>
            <textarea id="upg-msg" rows={3} style={{ ...inputStyle, resize: 'vertical' }} value={message} onChange={(e) => setMessage(e.target.value)} />
            {status === 'error' && (
              <p style={{ color: '#dc3545', fontSize: '14px', margin: '10px 0 0' }}>Something went wrong. Please try again.</p>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ flex: 1, padding: '12px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontFamily: 'inherit' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === 'loading'}
                style={{ flex: 1, padding: '12px', backgroundColor: '#E8761A', color: 'white', border: 'none', borderRadius: '4px', cursor: status === 'loading' ? 'wait' : 'pointer', fontSize: '16px', fontWeight: 600, fontFamily: 'inherit', opacity: status === 'loading' ? 0.7 : 1 }}
              >
                {status === 'loading' ? 'Sending…' : 'Send request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default UpgradeToProModal;
