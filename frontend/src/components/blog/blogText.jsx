// frontend/src/components/blog/blogText.jsx
// Renders a post body written with simple formatting marks (a small Markdown subset) as React
// elements. No HTML from the post is ever injected, so a post can't run scripts.
//
//   ## Heading        ### Smaller heading
//   **bold**   *italic*   ***bold italic***   [link text](https://...)   bare https://... links
//   > quote line      - bullet item      1. numbered item      --- (divider line)
//   Blank line = new paragraph. A single line break stays a line break.

const SORA = "'Sora', sans-serif";

const INLINE_RE = /(\*\*\*([^*]+?)\*\*\*|\*\*([^*]+?)\*\*|\*([^*\s](?:[^*]*?[^*\s])?)\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<>"')\]]+))/g;

// Body text is light (300); plain <strong> would only step up to 400, so bold is set explicitly.
const BOLD = { fontWeight: 700, color: '#1C1917' };

const linkStyle = { color: '#1E5F99', textDecoration: 'underline', wordBreak: 'break-word' };

const inline = (str, key) => {
  const out = [];
  let last = 0;
  let n = 0;
  for (const m of str.matchAll(INLINE_RE)) {
    if (m.index > last) out.push(str.slice(last, m.index));
    const k = `${key}-${n++}`;
    if (m[2] !== undefined) out.push(<strong key={k} style={BOLD}><em>{inline(m[2], k)}</em></strong>);
    else if (m[3] !== undefined) out.push(<strong key={k} style={BOLD}>{inline(m[3], k)}</strong>);
    else if (m[4] !== undefined) out.push(<em key={k}>{inline(m[4], k)}</em>);
    else if (m[5] !== undefined) out.push(<a key={k} href={m[6]} target="_blank" rel="noopener noreferrer" style={linkStyle}>{m[5]}</a>);
    else out.push(<a key={k} href={m[7]} target="_blank" rel="noopener noreferrer" style={linkStyle}>{m[7]}</a>);
    last = m.index + m[0].length;
  }
  if (last < str.length) out.push(str.slice(last));
  return out;
};

// Lines joined with <br />, each formatted inline.
const lines = (arr, key) => arr.map((line, j) => (
  <span key={j}>{inline(line, `${key}-${j}`)}{j < arr.length - 1 && <br />}</span>
));

const HEADING = /^(#{1,3})\s+(.*)$/;
const DIVIDER = /^\s*(-{3,}|_{3,})\s*$/;
const QUOTE = /^\s*>\s?/;
const UL = /^\s*[-*•]\s+/;
const OL = /^\s*\d+[.)]\s+/;
const startsBlock = (l) => HEADING.test(l) || DIVIDER.test(l) || QUOTE.test(l) || UL.test(l) || OL.test(l);

const parse = (text) => {
  const src = (text || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < src.length) {
    const l = src[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(HEADING))) {
      blocks.push({ type: m[1].length === 3 ? 'h3' : 'h2', text: m[2].trim() }); i++;
    } else if (DIVIDER.test(l)) {
      blocks.push({ type: 'hr' }); i++;
    } else if (QUOTE.test(l)) {
      const paras = [[]];
      while (i < src.length && QUOTE.test(src[i])) {
        const inner = src[i].replace(QUOTE, '');
        if (inner.trim()) paras[paras.length - 1].push(inner);
        else if (paras[paras.length - 1].length) paras.push([]);
        i++;
      }
      blocks.push({ type: 'quote', paras: paras.filter((p) => p.length) });
    } else if (UL.test(l) || OL.test(l)) {
      const re = UL.test(l) ? UL : OL;
      const items = [];
      while (i < src.length && re.test(src[i])) { items.push(src[i].replace(re, '')); i++; }
      blocks.push({ type: re === UL ? 'ul' : 'ol', items });
    } else {
      const para = [];
      while (i < src.length && src[i].trim() && !(para.length && startsBlock(src[i]))) { para.push(src[i]); i++; }
      blocks.push({ type: 'p', lines: para });
    }
  }
  return blocks;
};

export const PostBody = ({ text, style }) => {
  const p = { margin: '0 0 22px', ...style };
  return (
    <>
      {parse(text).map((b, i) => {
        switch (b.type) {
          case 'h2':
            return <h2 key={i} style={{ fontFamily: SORA, fontSize: '1.45em', fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.25, color: '#1C1917', margin: '44px 0 16px' }}>{inline(b.text, i)}</h2>;
          case 'h3':
            return <h3 key={i} style={{ fontFamily: SORA, fontSize: '1.15em', fontWeight: 700, lineHeight: 1.3, color: '#1C1917', margin: '32px 0 12px' }}>{inline(b.text, i)}</h3>;
          case 'hr':
            return <hr key={i} style={{ border: 'none', borderTop: '1px solid #E5E0D8', margin: '40px auto', width: '40%' }} />;
          case 'quote':
            return (
              <blockquote key={i} style={{ margin: '28px 0', padding: '4px 0 4px 22px', borderLeft: '4px solid #F6B89B', color: '#1C1917' }}>
                {b.paras.map((para, j) => <p key={j} style={{ ...p, margin: j < b.paras.length - 1 ? '0 0 14px' : 0, color: '#1C1917' }}>{lines(para, `${i}-${j}`)}</p>)}
              </blockquote>
            );
          case 'ul':
          case 'ol': {
            const List = b.type;
            return (
              <List key={i} style={{ ...p, paddingLeft: 26 }}>
                {b.items.map((it, j) => <li key={j} style={{ marginBottom: 8 }}>{inline(it, `${i}-${j}`)}</li>)}
              </List>
            );
          }
          default:
            return <p key={i} style={p}>{lines(b.lines, i)}</p>;
        }
      })}
    </>
  );
};
