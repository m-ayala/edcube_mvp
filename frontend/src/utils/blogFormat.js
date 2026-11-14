// frontend/src/utils/blogFormat.js
// Small text helpers for blog post cards.
import { formatCardDate } from './formatDate';

// Removes the formatting marks (## heading, **bold**, > quote, [text](url), ...) for plain previews.
export const plainText = (s) => (s || '')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/^\s*(#{1,3}|>|[-*•]|\d+[.)])\s+/gm, '')
  .replace(/^\s*(-{3,}|_{3,})\s*$/gm, '')
  .replace(/\*+/g, '');

// Card text: the summary if there is one, otherwise the start of the body.
export const excerpt = (post, max = 180) => {
  const src = plainText(post.summary || post.body).replace(/\s+/g, ' ').trim();
  return src.length > max ? `${src.slice(0, max).replace(/\s+\S*$/, '')}…` : src;
};

export const postDate = (post) => formatCardDate(post.published_at);
