// frontend/src/utils/blogFormat.js
// Small text helpers for blog post cards.
import { formatCardDate } from './formatDate';

// Card text: the summary if there is one, otherwise the start of the body.
export const excerpt = (post, max = 180) => {
  const src = (post.summary || post.body || '').replace(/\s+/g, ' ').trim();
  return src.length > max ? `${src.slice(0, max).replace(/\s+\S*$/, '')}…` : src;
};

export const postDate = (post) => formatCardDate(post.published_at);
