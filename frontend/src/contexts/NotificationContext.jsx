// frontend/src/contexts/NotificationContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getNotifications, markNotificationsSeen, deleteNotification } from '../services/notificationService';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);

  // Notifications are delete-on-seen (tasks/firestore-reorg-spec.md, decision
  // 6): there's no `status` field any more, so everything the backend
  // returns from GET / is by definition still unseen. The badge count is
  // just the length of that list.
  const unreadCount = notifications.length;

  // Plain fetch, used for the background poll -- does NOT mark anything
  // seen. Returns the fetched list so callers that need to act on exactly
  // what was just loaded (see markSeen below) don't hit a stale-closure
  // issue reading `notifications` state right after calling this.
  const refresh = useCallback(async () => {
    if (!currentUser) return [];
    try {
      const data = await getNotifications(currentUser);
      setNotifications(data);
      return data;
    } catch (err) {
      console.error('Notifications fetch failed:', err);
      return [];
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

  // Called when the bell opens: loads+displays the current list, then marks
  // everything just shown as seen (deleted server-side). The teacher keeps
  // seeing the list locally for this viewing; the next refresh (next open,
  // or the next poll) won't include them since they're gone server-side.
  const openAndMarkSeen = useCallback(async () => {
    const data = await refresh();
    const ids = data.map(n => n.id);
    if (ids.length === 0) return;
    try {
      await markNotificationsSeen(currentUser, ids);
    } catch (err) {
      console.error('Mark seen failed:', err);
    }
  }, [currentUser, refresh]);

  const remove = async (notifId) => {
    try {
      await deleteNotification(currentUser, notifId);
      setNotifications(prev => prev.filter(n => n.id !== notifId));
    } catch (err) {
      console.error('Delete notification failed:', err);
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, refresh, openAndMarkSeen, remove }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
