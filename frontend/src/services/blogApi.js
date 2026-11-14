// frontend/src/services/blogApi.js
// Front-page blog. Public reads (/api/blog, no token) and admin writes (/api/admin/blog,
// admin claim required; the backend enforces it).
import { authFetch, detailFromResponse } from './authFetch';

const API = () => import.meta.env.VITE_API_BASE_URL;

const json = async (res, fallback) => {
  if (!res.ok) throw new Error(await detailFromResponse(res, fallback));
  return res.json();
};

// ---- public ----
export const listPosts = async (limit = 20) =>
  json(await fetch(`${API()}/api/blog/posts?limit=${limit}`), 'Could not load posts');
export const getPost = async (id) =>
  json(await fetch(`${API()}/api/blog/posts/${encodeURIComponent(id)}`), 'Post not found');

// ---- admin ----
const send = (path, method, body) => authFetch(`${API()}/api/admin/blog${path}`, {
  method,
  headers: { 'Content-Type': 'application/json' },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

export const adminListPosts = async () => json(await authFetch(`${API()}/api/admin/blog/posts`), 'Could not load posts');
export const createPost = async (post) => json(await send('/posts', 'POST', post), 'Could not save the post');
export const updatePost = async (id, patch) => json(await send(`/posts/${encodeURIComponent(id)}`, 'PATCH', patch), 'Could not save the post');
export const deletePost = async (id) => json(await send(`/posts/${encodeURIComponent(id)}`, 'DELETE'), 'Could not delete the post');
