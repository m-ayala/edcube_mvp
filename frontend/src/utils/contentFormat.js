// src/utils/contentFormat.js
// Put a block's section headers on their own lines, with a blank line between sections, so text
// generated as one run-on paragraph ("**Explain It**: ... **In Real Life**: ...") reads cleanly.
// Bold words inside a sentence are left alone. Same rules as backend/utils/content_format.py.

const HEADER = '\\*\\*([A-Za-z][^*\\n.!?]{0,40}?)\\*\\*:?[ \\t]*';
const MID = new RegExp(`(?<=[.!?)"'])[ \\t]+${HEADER}`, 'g');
const LINE_START = new RegExp(`(^|\\n)[ \\t]*${HEADER}(?=\\S)`, 'g');

export const tidyBlockContent = (text) => {
  if (typeof text !== 'string' || !text.includes('**')) return text;
  return text
    .replace(/\r\n/g, '\n')
    .replace(MID, (_, h) => `\n\n**${h.trim()}**\n`)
    .replace(LINE_START, (_, pre, h) => `${pre}**${h.trim()}**\n`)
    .replace(/([^\n])\n(\*\*[^*\n]{1,42}\*\*\n)/g, '$1\n\n$2')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
