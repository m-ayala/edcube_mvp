import { useAuth } from '../../contexts/AuthContext';

const Home = () => {
  const { currentUser } = useAuth();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '40px'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: '600',
          color: '#1e1e2e',
          marginBottom: '8px'
        }}>
          Hello, {currentUser?.displayName || 'Teacher'}
        </h1>
        <p style={{ color: '#888', fontSize: '16px' }}>
          Welcome to EdCube. Pick a page from the sidebar to get started.
        </p>
      </div>
    </div>
  );
};

export default Home;