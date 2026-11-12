// frontend/src/hooks/useFavoriteLinks.js
// The signed-in teacher's favorite links, live from Firestore. Every star on screen reads from one
// listener per component tree, so starring in a block shows up in the profile's Favorites tab at once.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { addFavorite, favoriteIdFor, removeFavorite, subscribeFavorites } from '../firebase/favoritesService';

export const useFavoriteLinks = () => {
  const { currentUser, org } = useAuth();
  const uid = currentUser?.uid;
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState({}); // { [favId]: true|false } optimistic state while a write runs

  useEffect(() => {
    if (!uid || !org) { setFavorites([]); setLoading(false); return undefined; }
    setLoading(true);
    return subscribeFavorites(uid, org, (list) => { setFavorites(list); setLoading(false); }, () => setLoading(false));
  }, [uid, org]);

  const ids = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);

  const isFavorite = useCallback((url) => {
    if (!url) return false;
    const id = favoriteIdFor(url);
    return id in pending ? pending[id] : ids.has(id);
  }, [ids, pending]);

  const toggleFavorite = useCallback(async (link) => {
    if (!uid || !org || !link?.url) return;
    const id = favoriteIdFor(link.url);
    const next = !(id in pending ? pending[id] : ids.has(id));
    setPending((p) => ({ ...p, [id]: next }));
    try {
      if (next) await addFavorite(uid, org, link);
      else await removeFavorite(uid, org, link.url);
    } catch (err) {
      console.error('Favorite toggle failed:', err);
    } finally {
      setPending((p) => { const n = { ...p }; delete n[id]; return n; });
    }
  }, [uid, org, ids, pending]);

  return { favorites, loading, isFavorite, toggleFavorite };
};
