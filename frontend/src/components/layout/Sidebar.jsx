// frontend/src/components/layout/Sidebar.jsx

import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { BookOpen, FilePlus, User, Search as SearchIcon, LogOut } from 'lucide-react';
import edcubeLogo from '../../assets/edcube_logo.png';
import { logoutTeacher } from '../../firebase/authService';
import { useNotifications } from '../../contexts/NotificationContext';

const COLLAPSED_W = 48;
const EXPANDED_W = 237;
const ACTIVE = '#AD004B';
const INACTIVE = '#C8CDD6';

const navItems = [
  { to: '/my-courses',      label: 'My Courses',    Icon: BookOpen },
  { to: '/course-designer', label: 'Create Course', Icon: FilePlus },
  { to: '/profile',         label: 'Profile',       Icon: User },
  { to: '/search',          label: 'Search',        Icon: SearchIcon },
];

const Divider = ({ expanded }) => (
  <div style={{ height: 1, background: '#DFDFDF', margin: expanded ? '0 14px' : '0 8px' }} />
);

const label = (expanded) => ({
  fontSize: 14,
  fontWeight: 500,
  whiteSpace: 'nowrap',
  opacity: expanded ? 1 : 0,
  maxWidth: expanded ? 160 : 0,
  overflow: 'hidden',
  transition: 'opacity 0.18s ease, max-width 0.22s ease',
});

const Sidebar = () => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(null);
  const { unreadCount } = useNotifications();

  const handleLogout = async () => {
    try {
      await logoutTeacher();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => { setExpanded(false); setHovered(null); }}
      style={{
        width: expanded ? EXPANDED_W : COLLAPSED_W,
        minWidth: expanded ? EXPANDED_W : COLLAPSED_W,
        height: '100vh',
        background: '#FFF4F8',
        borderRight: '1px solid rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        fontFamily: "'DM Sans', sans-serif",
        position: 'relative',
        zIndex: 10,
        overflow: 'hidden',
        transition: 'width 0.22s ease, min-width 0.22s ease',
      }}
    >
      {/* Logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: expanded ? '16px 20px 14px' : '16px 0 14px',
        justifyContent: expanded ? 'flex-start' : 'center',
        transition: 'padding 0.22s ease',
      }}>
        <img
          src={edcubeLogo}
          alt="EdCube"
          style={{ width: expanded ? 40 : 30, height: expanded ? 40 : 30, objectFit: 'contain', flexShrink: 0, transition: 'width 0.22s ease, height 0.22s ease' }}
        />
        <span style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: 25,
          color: '#000',
          textTransform: 'capitalize',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          opacity: expanded ? 1 : 0,
          maxWidth: expanded ? 170 : 0,
          overflow: 'hidden',
          transition: 'opacity 0.18s ease, max-width 0.22s ease',
        }}>
          EdCube
        </span>
      </div>

      <Divider expanded={expanded} />

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 0', display: 'flex', flexDirection: 'column' }}>
        {navItems.map(({ to, label: text, Icon }) => {
          const IconComp = Icon;
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/profile'}
              onMouseEnter={() => setHovered(text)}
              onMouseLeave={() => setHovered(null)}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: expanded ? 12 : 0,
                padding: expanded ? '13px 16px' : '13px 0',
                margin: expanded ? '2px 14px' : '2px 8px',
                borderRadius: 10,
                textDecoration: 'none',
                position: 'relative',
                justifyContent: expanded ? 'flex-start' : 'center',
                background: hovered === text && !isActive ? 'rgba(173,0,75,0.05)' : 'transparent',
                transition: 'color .15s ease, background .15s ease',
              })}
            >
              {({ isActive }) => {
                const color = isActive || hovered === text ? ACTIVE : INACTIVE;
                return (
                  <>
                    <IconComp size={20} strokeWidth={1.75} color={color} style={{ flexShrink: 0 }} />
                    <span style={{ ...label(expanded), color }}>{text}</span>
                    {to === '/profile' && unreadCount > 0 && (
                      <span style={{
                        position: 'absolute',
                        top: expanded ? 8 : 5,
                        right: expanded ? 12 : 6,
                        minWidth: 16,
                        height: 16,
                        borderRadius: 8,
                        background: '#EF4444',
                        color: '#FFFFFF',
                        fontSize: 10,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 3px',
                        lineHeight: 1,
                      }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </>
                );
              }}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer: Sign Out */}
      <Divider expanded={expanded} />
      <button
        onClick={handleLogout}
        onMouseEnter={() => setHovered('__signout')}
        onMouseLeave={() => setHovered(null)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: expanded ? 12 : 0,
          padding: expanded ? '14px 16px' : '14px 0',
          margin: expanded ? '10px 14px 16px' : '10px 8px 16px',
          justifyContent: expanded ? 'flex-start' : 'center',
          border: 'none',
          borderRadius: 10,
          cursor: 'pointer',
          background: hovered === '__signout' ? 'rgba(173,0,75,0.05)' : 'transparent',
          color: ACTIVE,
          fontFamily: "'DM Sans', sans-serif",
          transition: 'background .15s ease',
        }}
      >
        <LogOut size={20} strokeWidth={1.75} color={ACTIVE} style={{ flexShrink: 0 }} />
        <span style={{ ...label(expanded) }}>Sign Out</span>
      </button>
    </aside>
  );
};

export default Sidebar;
