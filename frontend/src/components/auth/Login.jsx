import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginTeacher, resendVerificationEmail } from '../../firebase/authService';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setShowResendVerification(false);

    try {
      await loginTeacher(email, password);
      navigate('/my-courses');
    } catch (error) {
      setError(error.message);
      
      // Show resend verification option if email not verified
      if (error.message.includes('verify your email')) {
        setShowResendVerification(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      setLoading(true);
      await resendVerificationEmail();
      alert('Verification email sent! Please check your inbox.');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
      <h1>EdCube Login</h1>
      
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: '15px' }}>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>

        {error && (
          <div style={{ color: 'red', marginBottom: '15px' }}>
            {error}
          </div>
        )}

        {showResendVerification && (
          <button
            type="button"
            onClick={handleResendVerification}
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '10px',
              backgroundColor: '#f0ad4e',
              color: 'white',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Resend Verification Email
          </button>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <p style={{ marginTop: '20px', textAlign: 'center' }}>
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
};

export default Login;