// frontend/src/components/layout/Sidebar.jsx
// BEAUTIFUL BEIGE MINIMALIST SIDEBAR 🎨

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
    { to: '/profile',           label: 'My Profile',      icon: '👤' },
    { to: '/my-courses',        label: 'My Courses',      icon: '📚' },
    { to: '/course-designer',   label: 'Course Designer', icon: '✨' },
    { to: '/course-workspace',  label: 'Workspace',       icon: '⚙️' },
  ];

  return (
    <aside style={{
      width: '220px',
      minWidth: '220px',
      height: '100vh',
      backgroundColor: '#f5f5dc',  // Warm beige
      color: '#5a5a5a',            // Soft gray text
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      borderRight: '1px solid #d4c4a8'  // Subtle border
    }}>

      {/* Logo / Brand */}
      <div style={{
        padding: '24px 20px 20px',
        borderBottom: '1px solid #d4c4a8'
      }}>
        <span style={{ 
          fontSize: '22px', 
          fontWeight: '700', 
          color: '#8b7355'  // Warm brown
        }}>
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
              borderRadius: '8px',
              textDecoration: 'none',
              color: isActive ? '#ffffff' : '#5a5a5a',
              backgroundColor: isActive ? '#8b7355' : 'transparent',  // Warm brown when active
              fontWeight: isActive ? '600' : '400',
              fontSize: '14px',
              transition: 'all 0.15s ease'
            })}
          >
            <span style={{ fontSize: '16px' }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: user info + logout */}
      <div style={{
        borderTop: '1px solid #d4c4a8',
        padding: '16px 12px'
      }}>
        <div style={{
          fontSize: '13px',
          color: '#8b7355',
          marginBottom: '12px',
          paddingLeft: '12px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: '500'
        }}>
          {currentUser?.displayName || currentUser?.email || 'Teacher'}
        </div>
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '8px 12px',
            backgroundColor: 'transparent',
            color: '#d32f2f',
            border: '1px solid #d4c4a8',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            textAlign: 'left',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#fff5f0';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = 'transparent';
          }}
        >
          🚪 Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;