// frontend/src/components/notifications/NotificationBell.jsx
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationContext';


// Format ISO timestamp to relative text like "2 hours ago"
const timeAgo = (iso) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const NotificationBell = () => {
  const { notifications, unreadCount, refresh, markRead, remove } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleToggle = () => {
    setOpen(prev => {
      if (!prev) refresh(); // refresh on open
      return !prev;
    });
  };

  const handleUserClick = (fromUid, notifId) => {
    markRead(notifId);
    setOpen(false);
    navigate(`/profile/${fromUid}`);
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Bell button */}
      <button
        onClick={handleToggle}
        title="Notifications"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '38px',
          height: '38px',
          border: '1px solid #E7E5E4',
          borderRadius: '8px',
          backgroundColor: open ? '#F5F5F4' : '#FFFFFF',
          color: '#78716C',
          cursor: 'pointer',
          transition: 'background-color 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F5F5F4'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = open ? '#F5F5F4' : '#FFFFFF'; }}
      >
        <span style={{ fontSize: '17px', lineHeight: 1 }}>🔔</span>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-5px',
            left: '-5px',
            minWidth: '18px',
            height: '18px',
            borderRadius: '9px',
            backgroundColor: '#EF4444',
            color: '#FFFFFF',
            fontSize: '10px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            fontFamily: "'DM Sans', sans-serif",
            lineHeight: 1,
            boxShadow: '0 0 0 2px #fff',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: '320px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E7E5E4',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 1000,
          fontFamily: "'DM Sans', sans-serif",
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #F5F5F4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#1C1917' }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <span style={{
                fontSize: '11px',
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                padding: '2px 8px',
                borderRadius: '10px',
                fontWeight: '600',
              }}>
                {unreadCount} unread
              </span>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{
                padding: '28px 16px',
                textAlign: 'center',
                color: '#78716C',
                fontSize: '13px',
              }}>
                No notifications yet
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '12px 16px',
                    borderBottom: '1px solid #F5F5F4',
                    backgroundColor: notif.status === 'unread' ? '#FAFAF9' : '#FFFFFF',
                    transition: 'background-color 0.1s',
                  }}
                >
                  {/* Unread dot */}
                  <div style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: notif.status === 'unread' ? '#EF4444' : 'transparent',
                    flexShrink: 0,
                    marginTop: '5px',
                  }} />

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '13px', color: '#1C1917', lineHeight: '1.5' }}>
                      <button
                        onClick={() => handleUserClick(notif.fromUid, notif.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: '#166534',
                          fontWeight: '600',
                          fontSize: '13px',
                          fontFamily: "'DM Sans', sans-serif",
                          textDecoration: 'underline',
                          textUnderlineOffset: '2px',
                        }}
                      >
                        {notif.fromName}
                      </button>
                      {' forked your '}
                      <strong style={{ color: '#1C1917' }}>{notif.courseName}</strong>
                      {' course'}
                    </p>
                    <span style={{ fontSize: '11px', color: '#A8A29E', marginTop: '3px', display: 'block' }}>
                      {timeAgo(notif.createdAt)}
                    </span>
                  </div>

                  {/* Dismiss */}
                  <button
                    onClick={() => remove(notif.id)}
                    title="Dismiss"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#A8A29E',
                      fontSize: '16px',
                      lineHeight: 1,
                      padding: '0 2px',
                      flexShrink: 0,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#78716C'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#A8A29E'; }}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
