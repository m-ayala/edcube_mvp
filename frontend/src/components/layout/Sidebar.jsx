import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { logoutTeacher } from '../../firebase/authService';

const Sidebar = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logoutTeacher();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const navItems = [
    { to: '/home',              label: 'Home',            icon: 'H' },
    { to: '/my-courses',        label: 'My Courses',      icon: 'M' },
    { to: '/course-designer',   label: 'Course Designer', icon: 'D' },
    { to: '/course-workspace',  label: 'Workspace',       icon: 'W' },
  ];

  return (
    <aside style={{
      width: '220px',
      minWidth: '220px',
      height: '100vh',
      backgroundColor: '#1e1e2e',
      color: '#cdd6f4',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none'
    }}>

      {/* Logo / Brand */}
      <div style={{
        padding: '24px 20px 20px',
        borderBottom: '1px solid #313244'
      }}>
        <span style={{ fontSize: '22px', fontWeight: '700', color: '#cba6f7' }}>
          EdCube
        </span>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: '16px 12px' }}>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              marginBottom: '4px',
              borderRadius: '6px',
              textDecoration: 'none',
              color: isActive ? '#1e1e2e' : '#cdd6f4',
              backgroundColor: isActive ? '#cba6f7' : 'transparent',
              fontWeight: isActive ? '600' : '400',
              fontSize: '14px',
              transition: 'background-color 0.15s, color 0.15s'
            })}
          >
            <span style={{ fontSize: '16px' }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: user info + logout */}
      <div style={{
        borderTop: '1px solid #313244',
        padding: '16px 12px'
      }}>
        <div style={{
          fontSize: '13px',
          color: '#a6adc8',
          marginBottom: '12px',
          paddingLeft: '12px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {currentUser?.displayName || currentUser?.email || 'Teacher'}
        </div>
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '8px 12px',
            backgroundColor: 'transparent',
            color: '#f38ba8',
            border: '1px solid #45475a',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            textAlign: 'left'
          }}
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;