// Organization path of Signup: no account is created. Collects interest for the
// paid / enterprise versions and sends it to POST /api/waitlist.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { submitWaitlist } from '../../firebase/authService';

const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#A89F94', marginBottom: 6 };

const OrgWaitlistForm = ({ onBack }) => {
  const [f, setF] = useState({ name: '', email: '', org_name: '', role: '', staff_size: '', note: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const set = (e) => setF({ ...f, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const optional = (v) => (v.trim() ? v.trim() : undefined);
    try {
      await submitWaitlist({
        name: f.name.trim(),
        email: f.email.trim(),
        interest: 'organization',
        org_name: f.org_name.trim(),
        role: optional(f.role),
        staff_size: optional(f.staff_size),
        note: optional(f.note),
        source: 'signup_org'
      });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div style={{ background: '#E5F4E9', border: '0.5px solid #A8D8B0', borderRadius: 14, padding: '28px 24px', textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#A8D8B0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, margin: '0 auto 14px' }}>✓</div>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1917', margin: '0 0 6px' }}>
          Thanks — we'll be in touch when enterprise plans open.
        </p>
        <Link to="/" style={{ color: '#1C1917', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>Back to home</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ background: '#fff', borderRadius: 18, border: '0.5px solid #E5E0D8', padding: '28px 28px' }}>
      <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 800, letterSpacing: '-0.4px', color: '#1C1917', margin: '0 0 18px', lineHeight: 1.3 }}>
        Join the waitlist for when we open paid and enterprise versions
      </h2>

      {error && (
        <div role="alert" style={{ fontSize: 13, color: '#C05A2A', marginBottom: 16, padding: '10px 14px', background: '#FDEEE6', borderRadius: 8, border: '0.5px solid #F9C0A8' }}>
          {error}
        </div>
      )}

      {[
        ['name', 'Your name', 'text', 'Jane Smith', true],
        ['email', 'Work email', 'email', 'you@yourschool.org', true],
        ['org_name', 'Organization name', 'text', 'Springfield Academy', true],
        ['role', 'Your role', 'text', 'Principal, Curriculum lead…', false],
        ['staff_size', 'Approximate staff size', 'text', 'e.g. 40', false]
      ].map(([name, text, type, ph, req]) => (
        <div key={name} style={{ marginBottom: 16 }}>
          <label htmlFor={`wl-${name}`} style={labelStyle}>{text}</label>
          <input id={`wl-${name}`} className="su-input" name={name} type={type} placeholder={ph}
            value={f[name]} onChange={set} required={req} />
        </div>
      ))}

      <div style={{ marginBottom: 20 }}>
        <label htmlFor="wl-note" style={labelStyle}>Anything you'd like us to know</label>
        <textarea id="wl-note" className="su-input" name="note" rows={3} value={f.note} onChange={set}
          style={{ resize: 'vertical' }} />
      </div>

      <button type="submit" className="su-submit" disabled={loading}>
        {loading ? 'Sending…' : 'Join the waitlist'}
      </button>

      <p style={{ textAlign: 'center', fontSize: 13, color: '#6B6459', marginTop: 18, marginBottom: 0 }}>
        Already part of a school on EdCube?{' '}
        <Link to="/login" style={{ color: '#1C1917', fontWeight: 600, textDecoration: 'none' }}>
          Just log in with your school email.
        </Link>
      </p>
      <p style={{ textAlign: 'center', marginTop: 10, marginBottom: 0 }}>
        <button type="button" className="su-back" onClick={onBack} style={{ fontSize: 13 }}>Choose a different option</button>
      </p>
    </form>
  );
};

export default OrgWaitlistForm;
