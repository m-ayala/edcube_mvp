// Helpers for a block's "Links & Resources": three groups (articles, images, videos)
// stored together in the block's existing `links` array.

export const LINK_GROUPS = ['article', 'image', 'video'];

const VIDEO_HOST = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com)$/i;
const IMAGE_FILE = /\.(jpe?g|png|webp|gif)$/i;

// Pick a group for a URL the teacher adds by hand (Add Link / Library).
export const typeFromUrl = (url) => {
  try {
    const { hostname, pathname } = new URL(url);
    if (VIDEO_HOST.test(hostname)) return 'video';
    if (IMAGE_FILE.test(pathname)) return 'image';
  } catch {
    // Not a parseable URL: treat as an article link.
  }
  return 'article';
};

// Which group a saved link belongs to. Older links have type "video", "worksheet" or none.
export const linkGroupOf = (link) => {
  if (link?.type === 'video' || link?.type === 'image') return link.type;
  return 'article';
};

// Build a link for a URL the teacher adds by hand.
export const manualLink = (url, label) => {
  const type = typeFromUrl(url);
  return {
    id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    url,
    label: label || url,
    type,
    ...(type === 'image' ? { imageUrl: url } : {}),
  };
};

// Images are matched on the picture itself: two images can come from one page.
const linkKey = (link) => (linkGroupOf(link) === 'image'
  ? `image:${link.imageUrl || link.url}`
  : `${linkGroupOf(link)}:${link.url}`);

// Append incoming links to existing ones, skipping any already present.
export const mergeLinks = (existing = [], incoming = []) => {
  const seen = new Set(existing.map(linkKey));
  const added = [];
  for (const link of incoming) {
    const key = linkKey(link);
    if (seen.has(key)) continue;
    seen.add(key);
    added.push(link);
  }
  return [...existing, ...added];
};
