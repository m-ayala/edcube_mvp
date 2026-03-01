// frontend/src/components/layout/Sidebar.jsx

import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { logoutTeacher } from '../../firebase/authService';

const Sidebar = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [hoveredItem, setHoveredItem] = useState(null);

  const handleLogout = async () => {
    try {
      await logoutTeacher();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const navItems = [
    { to: '/profile',           label: 'My Profile',      icon: ProfileIcon },
    { to: '/my-courses',        label: 'My Courses',      icon: CoursesIcon },
    { to: '/course-designer',   label: 'Course Designer', icon: DesignerIcon },
    { to: '/course-workspace',  label: 'Workspace',       icon: WorkspaceIcon },
    { to: '/search',            label: 'Search',          icon: SearchIcon },
  ];

  const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Teacher';
  const initials = displayName.slice(0, 1).toUpperCase();

  return (
    <aside style={{
      width: '220px',
      minWidth: '220px',
      height: '100vh',
      backgroundColor: '#1C1917',
      color: '#A8A29E',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      fontFamily: "'DM Sans', sans-serif"
    }}>

      {/* Logo */}
      <div style={{
        padding: '26px 20px 22px',
        borderBottom: '1px solid #292524'
      }}>
        <span style={{
          fontFamily: "'Fraunces', serif",
          fontSize: '22px',
          fontWeight: '500',
          color: '#FAFAF9',
          letterSpacing: '-0.3px'
        }}>
          Ed<span style={{ color: '#86EFAC' }}>Cube</span>
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onMouseEnter={() => setHoveredItem(to)}
            onMouseLeave={() => setHoveredItem(null)}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '9px 12px',
              borderRadius: '6px',
              textDecoration: 'none',
              color: isActive ? '#FFFFFF' : hoveredItem === to ? '#E7E5E4' : '#A8A29E',
              backgroundColor: isActive ? '#292524' : hoveredItem === to ? '#292524' : 'transparent',
              fontWeight: isActive ? '500' : '400',
              fontSize: '13.5px',
              transition: 'all 0.15s ease'
            })}
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer: user + logout */}
      <div style={{ borderTop: '1px solid #292524', padding: '14px 10px' }}>
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
            background: 'linear-gradient(135deg, #86EFAC, #4ADE80)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: '600',
            color: '#14532D',
            flexShrink: 0
          }}>
            {initials}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '13px', color: '#D6D3D1', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </div>
            <div style={{ fontSize: '11px', color: '#78716C' }}>ICC Teacher</div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '7px 12px',
            backgroundColor: 'transparent',
            color: '#78716C',
            border: '1px solid #292524',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12.5px',
            textAlign: 'left',
            transition: 'all 0.15s ease',
            fontFamily: "'DM Sans', sans-serif"
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#292524'; e.currentTarget.style.color = '#E57373'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#78716C'; }}
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
};

// SVG icon components (inline, no external dependency)
const ProfileIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const CoursesIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
  </svg>
);
const DesignerIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
  </svg>
);
const WorkspaceIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
  </svg>
);
const SearchIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
  </svg>
);

export default Sidebar;
