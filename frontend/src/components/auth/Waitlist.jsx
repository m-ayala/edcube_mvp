import { Link, useLocation } from 'react-router-dom';
import { WAITLIST_MESSAGE } from '../../firebase/authService';

const Waitlist = () => {
  const location = useLocation();
  const message = location.state?.message || WAITLIST_MESSAGE;

  return (
    <div style={{
      minHeight: '100vh', background: '#FAF8F4', display: 'flex',
      flexDirection: 'column', fontFamily: "'DM Sans', sans-serif"
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '18px 40px', borderBottom: '0.5px solid #E5E0D8'
      }}>
        <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 18, color: '#1C1917', letterSpacing: '-0.5px' }}>
          EdCube
        </div>
      </div>

      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px'
      }}>
        <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
          <img src="/edcube-logo.png" alt="EdCube" style={{ width: 56, height: 56, objectFit: 'contain', marginBottom: 16 }} />
          <h1 style={{
            fontFamily: "'Sora', sans-serif", fontSize: 26, fontWeight: 800,
            letterSpacing: '-0.8px', color: '#1C1917', margin: '0 0 20px'
          }}>
            You're on the waitlist
          </h1>
          <div style={{
            background: '#FDF5DC', border: '0.5px solid #F9E0A0', borderRadius: 14,
            padding: '24px', marginBottom: 20
          }}>
            <p style={{ fontSize: 14, color: '#6B6459', margin: 0, lineHeight: 1.6 }}>{message}</p>
          </div>
          <Link to="/login" style={{ color: '#1C1917', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Waitlist;
