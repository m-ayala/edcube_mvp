// frontend/src/contexts/NotificationContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getNotifications, markAsRead, deleteNotification } from '../services/notificationService';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  const refresh = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await getNotifications(currentUser);
      setNotifications(data);
    } catch (err) {
      console.error('Notifications fetch failed:', err);
    }
  }, [currentUser]);

  // Poll every 30 s while logged in
  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }
    refresh();
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [currentUser, refresh]);

  const markRead = async (notifId) => {
    try {
      await markAsRead(currentUser, notifId);
      setNotifications(prev =>
        prev.map(n => n.id === notifId ? { ...n, status: 'read' } : n)
      );
    } catch (err) {
      console.error('Mark read failed:', err);
    }
  };

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter(n => n.status === 'unread');
    if (unread.length === 0) return;
    // Optimistically update UI immediately
    setNotifications(prev => prev.map(n => n.status === 'unread' ? { ...n, status: 'read' } : n));
    // Await all API calls so a subsequent refresh sees the updated state
    await Promise.all(unread.map(n => markAsRead(currentUser, n.id).catch(err => console.error('Mark read failed:', err))));
  }, [notifications, currentUser]);

  const remove = async (notifId) => {
    try {
      await deleteNotification(currentUser, notifId);
      setNotifications(prev => prev.filter(n => n.id !== notifId));
    } catch (err) {
      console.error('Delete notification failed:', err);
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, refresh, markRead, markAllRead, remove }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
