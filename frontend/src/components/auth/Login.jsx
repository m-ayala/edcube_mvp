import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginTeacher, resendVerificationEmail } from '../../firebase/authService';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setShowResend(false);
    setLoading(true);
    try {
      await loginTeacher(email, password);
      navigate('/my-courses');
    } catch (err) {
      setError(err.message);
      if (err.message?.includes('verify your email')) setShowResend(true);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      await resendVerificationEmail();
      setError('Verification email sent — check your inbox.');
      setShowResend(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#FAF8F4', display: 'flex',
      flexDirection: 'column', fontFamily: "'DM Sans', sans-serif"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');

        .li-input {
          width: 100%; padding: 11px 14px; background: #FAF8F4;
          border: 1px solid #E5E0D8; border-radius: 10px;
          font-family: 'DM Sans', sans-serif; font-size: 14px;
          color: #1C1917; outline: none; box-sizing: border-box;
          transition: border-color 0.18s;
        }
        .li-input:focus { border-color: #1C1917; background: #fff; }
        .li-input::placeholder { color: #C4BDB4; }

        .li-submit {
          width: 100%; padding: 13px; background: #1C1917; color: #FAF8F4;
          border: none; border-radius: 100px; font-family: 'DM Sans', sans-serif;
          font-size: 15px; font-weight: 600; cursor: pointer;
          transition: opacity 0.18s; margin-top: 8px;
        }
        .li-submit:hover { opacity: 0.85; }
        .li-submit:disabled { opacity: 0.5; cursor: not-allowed; }

        .li-resend {
          width: 100%; padding: 11px; background: transparent; color: #8A6B00;
          border: 1px solid #F9E0A0; border-radius: 100px;
          font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
          cursor: pointer; transition: background 0.18s; margin-top: 8px;
        }
        .li-resend:hover { background: #FDF5DC; }

        .li-back {
          display: inline-flex; align-items: center; gap: 6px;
          background: none; border: none; cursor: pointer;
          font-family: 'DM Sans', sans-serif; font-size: 14px;
          color: #6B6459; padding: 0; transition: color 0.15s;
        }
        .li-back:hover { color: #1C1917; }
      `}</style>

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 40px', borderBottom: '0.5px solid #E5E0D8'
      }}>
        <button className="li-back" onClick={() => navigate('/')}>
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
              Welcome back
            </h1>
            <p style={{ fontSize: 14, color: '#6B6459', margin: 0, lineHeight: 1.6 }}>
              Log in to your EdCube workspace.
            </p>
          </div>

          <form onSubmit={handleLogin} style={{
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
                Email
              </label>
              <input className="li-input" type="email" placeholder="you@yourschool.org"
                value={email} onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin(e)}
                required />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#A89F94', marginBottom: 6 }}>
                Password
              </label>
              <input className="li-input" type="password" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin(e)}
                required />
            </div>

            {showResend && (
              <button type="button" className="li-resend" onClick={handleResend} disabled={loading}>
                Resend verification email
              </button>
            )}

            <button type="submit" className="li-submit" disabled={loading}>
              {loading ? 'Logging in…' : 'Log in'}
            </button>

            <p style={{ textAlign: 'center', fontSize: 13, color: '#6B6459', marginTop: 18, marginBottom: 0 }}>
              Don't have an account?{' '}
              <Link to="/signup" style={{ color: '#1C1917', fontWeight: 600, textDecoration: 'none' }}>
                Sign up free
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
