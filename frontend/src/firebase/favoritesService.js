// frontend/src/firebase/favoritesService.js
// Favorite links: Users/{org}/teachers/{uid}/favoriteLinks/{id}. Private to the teacher (same rule as
// libraryFolders). The doc id is a hash of the normalized URL, so starring the same link from the
// Resource Library and from a block's Discover results is one favorite, and toggling is idempotent.
import { deleteDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './config';
import { teacherSubCol, teacherSubDoc } from './paths';

const SUB = 'favoriteLinks';

export const normalizeUrl = (url) => {
  const raw = String(url || '').trim();
  try {
    const u = new URL(raw);
    u.hash = '';
    return `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch {
    return raw;
  }
};

// cyrb53: small, fast 53-bit string hash (collisions are negligible at a teacher's scale).
const hash = (str) => {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};

export const favoriteIdFor = (url) => `fav-${hash(normalizeUrl(url))}`;

/** Live list of favorites, newest first. Returns the unsubscribe function. */
export const subscribeFavorites = (uid, org, onChange, onError) => onSnapshot(
  query(teacherSubCol(db, org, uid, SUB), orderBy('createdAt', 'desc')),
  (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  (err) => { console.error('Favorites listener failed:', err); onError?.(err); },
);

/** link: { url, title?, description?, kind?, source?, imageUrl? } */
export const addFavorite = async (uid, org, link) => {
  const id = favoriteIdFor(link.url);
  await setDoc(teacherSubDoc(db, org, uid, SUB, id), {
    url: String(link.url).trim(),
    title: (link.title || '').trim() || String(link.url).trim(),
    description: (link.description || '').trim(),
    kind: link.kind || 'article',
    source: link.source || 'library',
    ...(link.imageUrl ? { imageUrl: String(link.imageUrl) } : {}),
    createdAt: serverTimestamp(),
  });
  return id;
};

export const removeFavorite = async (uid, org, url) => {
  await deleteDoc(teacherSubDoc(db, org, uid, SUB, favoriteIdFor(url)));
};
