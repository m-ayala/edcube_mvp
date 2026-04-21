// frontend/src/components/layout/Sidebar.jsx

import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { logoutTeacher } from '../../firebase/authService';
import { useNotifications } from '../../contexts/NotificationContext';

const dotColors = {
  '/profile':          '#F2C0D4',
  '/my-courses':       '#ACD8F0',
  '/course-designer':  '#F7E4A0',
  '/course-workspace': '#B2E8C8',
  '/search':           '#F2C0D4',
};

const Sidebar = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [hoveredItem, setHoveredItem] = useState(null);
  const { unreadCount } = useNotifications();

  const handleLogout = async () => {
    try {
      await logoutTeacher();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const navItems = [
    { to: '/profile',           label: 'My Profile' },
    { to: '/my-courses',        label: 'My Courses' },
    { to: '/course-designer',   label: 'Course Designer' },
    { to: '/course-workspace',  label: 'Workspace' },
    { to: '/search',            label: 'Search' },
  ];

  const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Teacher';
  const initials = displayName.slice(0, 1).toUpperCase();

  return (
    <aside style={{
      width: '220px',
      minWidth: '220px',
      height: '100vh',
      background: 'rgba(255,255,255,0.52)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderRight: '1px solid rgba(255,255,255,0.75)',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      fontFamily: "'DM Sans', sans-serif",
      position: 'relative',
      zIndex: 10
    }}>

      {/* Logo */}
      <div style={{
        padding: '26px 20px 22px',
        borderBottom: '1px solid rgba(0,0,0,0.07)'
      }}>
        <span style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: '24.2px',
          color: '#111',
          letterSpacing: '-0.3px'
        }}>
          EdCube
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            onMouseEnter={() => setHoveredItem(to)}
            onMouseLeave={() => setHoveredItem(null)}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              padding: '9px 12px',
              borderRadius: '8px',
              textDecoration: 'none',
              color: isActive ? '#111' : hoveredItem === to ? '#111' : '#333',
              backgroundColor: isActive ? 'rgba(255,255,255,0.85)' : hoveredItem === to ? 'rgba(255,255,255,0.45)' : 'transparent',
              boxShadow: isActive ? '0 0 0 1px rgba(0,0,0,0.08)' : 'none',
              fontWeight: isActive ? '500' : '400',
              fontSize: '14.9px',
              transition: 'all 0.15s ease',
              position: 'relative',
            })}
          >
            <div style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: dotColors[to] || '#D1D5DB',
              flexShrink: 0
            }} />
            {label}
            {to === '/profile' && unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '5px',
                right: '8px',
                minWidth: '16px',
                height: '16px',
                borderRadius: '8px',
                backgroundColor: '#EF4444',
                color: '#FFFFFF',
                fontSize: '9.9px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
                lineHeight: 1,
              }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer: user + logout */}
      <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', padding: '14px 10px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 12px',
          marginBottom: '6px'
        }}>
          <div style={{
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            background: '#B2E8C8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13.2px',
            fontWeight: '600',
            color: '#1C5C35',
            flexShrink: 0
          }}>
            {initials}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '14.3px', color: '#111', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </div>
            <div style={{ fontSize: '12.1px', color: '#555' }}>ICC Teacher</div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '7px 12px',
            backgroundColor: 'transparent',
            color: '#444',
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13.8px',
            textAlign: 'left',
            transition: 'all 0.15s ease',
            fontFamily: "'DM Sans', sans-serif"
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.6)'; e.currentTarget.style.color = '#E57373'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#444'; }}
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
