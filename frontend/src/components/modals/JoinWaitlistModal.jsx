// frontend/src/components/modals/JoinWaitlistModal.jsx
// Every Upgrade / enterprise button opens this. There is no payment and no price:
// it only records interest (POST /api/waitlist) for when paid and enterprise versions open.
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { authFetch } from '../../services/authFetch';

const inputStyle = {
  width: '100%', padding: '10px 12px', border: '1px solid #D0CAC0', borderRadius: '6px',
  fontSize: '15px', fontFamily: 'inherit', boxSizing: 'border-box',
};
const readOnlyStyle = { ...inputStyle, backgroundColor: '#F4F4F2', color: '#666' };
const labelStyle = { display: 'block', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#444', margin: '12px 0 4px' };

const JoinWaitlistModal = ({ onClose }) => {
  const { currentUser } = useAuth();
  const email = currentUser?.email || '';
  const name = currentUser?.displayName || email.split('@')[0] || 'EdCube user';
  const [interest, setInterest] = useState('teacher');
  const [orgName, setOrgName] = useState('');
  const [staffSize, setStaffSize] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setError('');
    const org = interest === 'organization';
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_BASE_URL}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          interest,
          ...(org ? { org_name: orgName.trim(), staff_size: staffSize.trim() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          source: 'upgrade',
        }),
      });
      if (!res.ok) {
        setError(res.status === 429
          ? 'Too many requests. Please try again a little later.'
          : res.status === 422 ? 'Please check the details and try again.' : 'Something went wrong. Please try again.');
        setStatus('error');
        return;
      }
      setStatus('success');
    } catch {
      setError('Something went wrong. Please try again.');
      setStatus('error');
    }
  };

  const primary = { padding: '12px 28px', backgroundColor: '#2C5F3A', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontFamily: 'inherit' };

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
        aria-label="Join the waitlist"
        style={{ backgroundColor: 'white', borderRadius: '8px', padding: '30px', maxWidth: '440px', width: '90%', textAlign: 'center', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {status === 'success' ? (
          <>
            <h2 style={{ marginTop: 0, color: '#2C5F3A', fontSize: '22px' }}>You're on the list</h2>
            <p data-testid="waitlist-thanks" style={{ color: '#666', marginBottom: '24px' }}>Thanks — we'll let you know when paid plans open.</p>
            <button onClick={onClose} style={primary}>Close</button>
          </>
        ) : (
          <form onSubmit={submit}>
            <h2 style={{ marginTop: 0, color: '#2C5F3A', fontSize: '22px' }}>Join the waitlist</h2>
            <p style={{ color: '#666', margin: 0 }}>Join the waitlist for when we open paid and enterprise versions.</p>
            <label style={labelStyle} htmlFor="wl-name">Name</label>
            <input id="wl-name" style={readOnlyStyle} value={name} readOnly />
            <label style={labelStyle} htmlFor="wl-email">Email</label>
            <input id="wl-email" style={readOnlyStyle} value={email} readOnly />
            <label style={labelStyle} htmlFor="wl-interest">I'm interested in</label>
            <select id="wl-interest" style={inputStyle} value={interest} onChange={(e) => setInterest(e.target.value)}>
              <option value="teacher">Teacher plan</option>
              <option value="organization">School or organization</option>
            </select>
            {interest === 'organization' && (
              <>
                <label style={labelStyle} htmlFor="wl-org">School or organization name</label>
                <input id="wl-org" style={inputStyle} value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
                <label style={labelStyle} htmlFor="wl-staff">Approximate staff size</label>
                <input id="wl-staff" style={inputStyle} value={staffSize} onChange={(e) => setStaffSize(e.target.value)} inputMode="numeric" required />
              </>
            )}
            <label style={labelStyle} htmlFor="wl-note">Anything you'd like us to know? (optional)</label>
            <textarea id="wl-note" rows={3} style={{ ...inputStyle, resize: 'vertical' }} value={note} onChange={(e) => setNote(e.target.value)} />
            {status === 'error' && <p style={{ color: '#dc3545', fontSize: '14px', margin: '10px 0 0' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button type="button" onClick={onClose} style={{ flex: 1, padding: '12px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === 'loading'}
                style={{ flex: 1, padding: '12px', backgroundColor: '#E8761A', color: 'white', border: 'none', borderRadius: '4px', cursor: status === 'loading' ? 'wait' : 'pointer', fontSize: '16px', fontWeight: 600, fontFamily: 'inherit', opacity: status === 'loading' ? 0.7 : 1 }}
              >
                {status === 'loading' ? 'Sending…' : 'Join the waitlist'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default JoinWaitlistModal;
