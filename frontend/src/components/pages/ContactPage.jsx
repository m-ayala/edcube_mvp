// frontend/src/components/pages/ContactPage.jsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

const ContactPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', org: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | loading | success | error

  useEffect(() => { document.title = 'Request a Demo — EdCube'; }, []);

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch(`${API_BASE}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, type: 'demo' }),
      });
      if (!res.ok) throw new Error('Request failed');
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#FAF8F4', color: '#1C1917', minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@400;500&display=swap');

        .cp-input {
          width: 100%; padding: 12px 16px; border-radius: 10px;
          border: 1px solid #D0CAC0; background: #fff;
          font-size: 15px; font-family: 'DM Sans', sans-serif; color: #1C1917;
          outline: none; box-sizing: border-box; transition: border-color 0.15s;
        }
        .cp-input:focus { border-color: #1C1917; }
        .cp-input::placeholder { color: #A89F94; }
        .cp-label { display: block; font-size: 13px; font-weight: 500; color: #6B6459; margin-bottom: 6px; }
        .cp-field { margin-bottom: 20px; }

        .cp-submit {
          width: 100%; padding: 14px; border-radius: 100px;
          background: #1C1917; color: #FAF8F4;
          font-size: 15px; font-weight: 600; font-family: 'Sora', sans-serif;
          border: none; cursor: pointer; transition: opacity 0.15s;
        }
        .cp-submit:hover { opacity: 0.85; }
        .cp-submit:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      {/* NAV */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 48px', borderBottom: '0.5px solid #E5E0D8',
        position: 'sticky', top: 0, background: '#FAF8F4', zIndex: 10
      }}>
        <button
          onClick={() => navigate('/')}
          style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 20, color: '#1C1917', background: 'none', border: 'none', cursor: 'pointer', padding: 0, letterSpacing: '-0.5px' }}
        >
          EdCube
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => navigate('/login')}
            style={{ background: 'transparent', color: '#1C1917', padding: '10px 20px', borderRadius: 100, fontSize: 14, fontWeight: 500, border: '0.5px solid #D0CAC0', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
          >
            Log in
          </button>
          <button
            onClick={() => navigate('/signup')}
            style={{ background: '#1C1917', color: '#FAF8F4', padding: '10px 22px', borderRadius: 100, fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
          >
            Sign up free
          </button>
        </div>
      </nav>

      {/* CONTENT */}
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '72px 24px 80px' }}>

        {status === 'success' ? (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 24 }}>🎉</div>
            <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 32, fontWeight: 700, letterSpacing: '-0.8px', marginBottom: 16 }}>
              Message received!
            </h1>
            <p style={{ fontSize: 16, color: '#6B6459', lineHeight: 1.7, marginBottom: 36 }}>
              Thanks for reaching out. We'll be in touch with you shortly to schedule a demo.
            </p>
            <button
              onClick={() => navigate('/')}
              style={{ background: '#1C1917', color: '#FAF8F4', padding: '12px 28px', borderRadius: 100, fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
            >
              Back to home
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ marginBottom: 48 }}>
              <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 100, background: '#FDEEE6', color: '#C05A2A', marginBottom: 16 }}>
                For Organizations
              </span>
              <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 38, fontWeight: 300, lineHeight: 1.18, letterSpacing: '-1.2px', marginBottom: 14 }}>
                Request a{' '}
                <em style={{ fontStyle: 'normal', fontWeight: 800, color: '#A8CCEF' }}>demo</em>
              </h1>
              <p style={{ fontSize: 16, color: '#6B6459', lineHeight: 1.7 }}>
                EdCube is built for schools and districts. Fill out the form below and we'll reach out to walk you through a live demo.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div className="cp-field">
                <label className="cp-label">Your name *</label>
                <input
                  className="cp-input" name="name" required
                  placeholder="Jane Smith"
                  value={form.name} onChange={handleChange}
                />
              </div>
              <div className="cp-field">
                <label className="cp-label">Work email *</label>
                <input
                  className="cp-input" name="email" type="email" required
                  placeholder="jane@school.org"
                  value={form.email} onChange={handleChange}
                />
              </div>
              <div className="cp-field">
                <label className="cp-label">School or organization</label>
                <input
                  className="cp-input" name="org"
                  placeholder="Lincoln Elementary School"
                  value={form.org} onChange={handleChange}
                />
              </div>
              <div className="cp-field">
                <label className="cp-label">Anything you'd like us to know?</label>
                <textarea
                  className="cp-input" name="message"
                  placeholder="Tell us about your team, grade levels, or what you're hoping EdCube can help with..."
                  rows={4}
                  value={form.message} onChange={handleChange}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {status === 'error' && (
                <p style={{ color: '#C05A2A', fontSize: 13, marginBottom: 16 }}>
                  Something went wrong. Please try again or email us directly at manaswini@indiacc.org.
                </p>
              )}

              <button type="submit" className="cp-submit" disabled={status === 'loading'}>
                {status === 'loading' ? 'Sending…' : 'Send request'}
              </button>
            </form>
          </>
        )}
      </div>

      {/* FOOTER */}
      <div style={{ textAlign: 'center', padding: '24px 48px', fontSize: 13, color: '#A89F94', borderTop: '0.5px solid #E5E0D8' }}>
        © 2026 EdCube · A curriculum design studio for K–12 educators
      </div>
    </div>
  );
};

export default ContactPage;
