import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signupTeacher, getOrgFromEmail, DOMAIN_ORG_MAP } from '../../firebase/authService';

const Signup = () => {
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    if (!getOrgFromEmail(formData.email)) {
      const allowed = Object.keys(DOMAIN_ORG_MAP).map(d => `@${d}`).join(', ');
      setError(`Email domain not allowed. Accepted: ${allowed}`);
      setLoading(false);
      return;
    }

    try {
      const result = await signupTeacher(formData.email, formData.password, formData.displayName);
      setSuccess(result.message);
      setTimeout(() => navigate('/'), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const detectedOrg = getOrgFromEmail(formData.email);

  return (
    <div style={{
      minHeight: '100vh', background: '#FAF8F4', display: 'flex',
      flexDirection: 'column', fontFamily: "'DM Sans', sans-serif"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');

        .su-input {
          width: 100%; padding: 11px 14px; background: #FAF8F4;
          border: 1px solid #E5E0D8; border-radius: 10px;
          font-family: 'DM Sans', sans-serif; font-size: 14px;
          color: #1C1917; outline: none; box-sizing: border-box;
          transition: border-color 0.18s;
        }
        .su-input:focus { border-color: #1C1917; background: #fff; }
        .su-input::placeholder { color: #C4BDB4; }

        .su-submit {
          width: 100%; padding: 13px; background: #1C1917; color: #FAF8F4;
          border: none; border-radius: 100px; font-family: 'DM Sans', sans-serif;
          font-size: 15px; font-weight: 600; cursor: pointer;
          transition: opacity 0.18s; margin-top: 8px;
        }
        .su-submit:hover { opacity: 0.85; }
        .su-submit:disabled { opacity: 0.5; cursor: not-allowed; }

        .su-back {
          display: inline-flex; align-items: center; gap: 6px;
          background: none; border: none; cursor: pointer;
          font-family: 'DM Sans', sans-serif; font-size: 14px;
          color: #6B6459; padding: 0; transition: color 0.15s;
        }
        .su-back:hover { color: #1C1917; }
      `}</style>

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 40px', borderBottom: '0.5px solid #E5E0D8'
      }}>
        <button className="su-back" onClick={() => navigate('/')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
        <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 18, color: '#1C1917', letterSpacing: '-0.5px' }}>
          EdCube
        </div>
        <div style={{ width: 60 }} />
      </div>

      {/* Form */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px'
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Logo + heading */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <img src="/edcube-logo.png" alt="EdCube" style={{ width: 56, height: 56, objectFit: 'contain', marginBottom: 16 }} />
            <h1 style={{
              fontFamily: "'Sora', sans-serif", fontSize: 26, fontWeight: 800,
              letterSpacing: '-0.8px', color: '#1C1917', margin: '0 0 8px'
            }}>
              Create your account
            </h1>
            <p style={{ fontSize: 14, color: '#6B6459', margin: 0, lineHeight: 1.6 }}>
              Join your school's EdCube workspace.
            </p>
          </div>

          {success ? (
            <div style={{
              background: '#E5F4E9', border: '0.5px solid #A8D8B0', borderRadius: 14,
              padding: '28px 24px', textAlign: 'center'
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', background: '#A8D8B0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, margin: '0 auto 14px'
              }}>✓</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1917', margin: '0 0 6px' }}>Account created!</p>
              <p style={{ fontSize: 13, color: '#6B6459', margin: 0, lineHeight: 1.6 }}>{success}</p>
              <p style={{ fontSize: 12, color: '#A89F94', marginTop: 8 }}>Redirecting you shortly…</p>
            </div>
          ) : (
            <form onSubmit={handleSignup} style={{
              background: '#fff', borderRadius: 18, border: '0.5px solid #E5E0D8',
              padding: '28px 28px'
            }}>

              {error && (
                <div style={{
                  fontSize: 13, color: '#C05A2A', marginBottom: 16,
                  padding: '10px 14px', background: '#FDEEE6',
                  borderRadius: 8, border: '0.5px solid #F9C0A8'
                }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#A89F94', marginBottom: 6 }}>
                  Full Name
                </label>
                <input className="su-input" type="text" name="displayName" placeholder="Jane Smith"
                  value={formData.displayName} onChange={handleChange} required />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#A89F94', marginBottom: 6 }}>
                  Email
                </label>
                <input className="su-input" type="email" name="email" placeholder="you@yourschool.org"
                  value={formData.email} onChange={handleChange} required />
                {detectedOrg && (
                  <p style={{ fontSize: 11, color: '#2E7A43', marginTop: 5, fontWeight: 500 }}>
                    ✓ Organisation: {detectedOrg}
                  </p>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#A89F94', marginBottom: 6 }}>
                  Password
                </label>
                <input className="su-input" type="password" name="password" placeholder="Min. 6 characters"
                  value={formData.password} onChange={handleChange} required />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#A89F94', marginBottom: 6 }}>
                  Confirm Password
                </label>
                <input className="su-input" type="password" name="confirmPassword" placeholder="Re-enter password"
                  value={formData.confirmPassword} onChange={handleChange} required />
              </div>

              <button type="submit" className="su-submit" disabled={loading}>
                {loading ? 'Creating account…' : 'Create account'}
              </button>

              <p style={{ textAlign: 'center', fontSize: 13, color: '#6B6459', marginTop: 18, marginBottom: 0 }}>
                Already have an account?{' '}
                <Link to="/" style={{ color: '#1C1917', fontWeight: 600, textDecoration: 'none' }}>
                  Log in
                </Link>
              </p>
            </form>
          )}

          <p style={{ textAlign: 'center', fontSize: 12, color: '#C4BDB4', marginTop: 20 }}>
            Accepted domains: {Object.keys(DOMAIN_ORG_MAP).map(d => `@${d}`).join(', ')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
