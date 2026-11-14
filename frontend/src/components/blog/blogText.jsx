// frontend/src/components/blog/blogText.jsx
// Renders a post body (plain text) as paragraphs: blank lines split paragraphs, single newlines
// become line breaks, and http(s) links become clickable. No HTML from the post is ever injected.
const URL_RE = /(https?:\/\/[^\s<>"')]+)/g;

const linkify = (line, keyBase) => line.split(URL_RE).map((part, i) => (
  i % 2 === 1
    ? <a key={`${keyBase}-${i}`} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#1E5F99', textDecoration: 'underline', wordBreak: 'break-word' }}>{part}</a>
    : part
));

export const PostBody = ({ text, style }) => (
  <>
    {(text || '').split(/\n\s*\n/).filter((p) => p.trim()).map((para, i) => (
      <p key={i} style={style}>
        {para.split('\n').map((line, j, arr) => (
          <span key={j}>{linkify(line, `${i}-${j}`)}{j < arr.length - 1 && <br />}</span>
        ))}
      </p>
    ))}
  </>
);
