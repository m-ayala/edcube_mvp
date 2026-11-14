// frontend/src/components/admin/BlogTab.jsx
// Write, edit, publish/unpublish and delete the blog posts shown on the front page.
// Drafts are only visible here; published posts appear on the landing page and at /blog.
import { useState, useEffect, useCallback, useRef } from 'react';
import { adminListPosts, createPost, updatePost, deletePost } from '../../services/blogApi';
import { fmtDate, btn, input, card } from './adminStyles';
import { ConfirmButton, ErrorLine } from './adminUi';
import { PostBody } from '../blog/blogText';

const EMPTY = { id: null, title: '', summary: '', body: '' };

const BlogTab = () => {
  const [posts, setPosts] = useState(null);
  const [draft, setDraft] = useState(null); // the post being edited (EMPTY for a new one)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(false);
  const bodyRef = useRef(null);

  // Formatting buttons: wrap the selected text (bold, italic, link) or prefix the selected lines
  // (heading, quote, list). The marks are what the public page turns into formatting.
  const format = (kind) => {
    const ta = bodyRef.current;
    if (!ta) return;
    const v = draft.body;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const sel = v.slice(s, e);
    let next; let selStart; let selEnd;
    const WRAP = { bold: ['**', '**', 'bold text'], italic: ['*', '*', 'italic text'] };
    const PREFIX = { h2: '## ', h3: '### ', quote: '> ', ul: '- ', ol: '1. ' };
    if (WRAP[kind]) {
      const [a, b, ph] = WRAP[kind];
      const inner = sel || ph;
      next = v.slice(0, s) + a + inner + b + v.slice(e);
      selStart = s + a.length; selEnd = selStart + inner.length;
    } else if (kind === 'link') {
      const label = sel || 'link text';
      const ins = `[${label}](https://)`;
      next = v.slice(0, s) + ins + v.slice(e);
      selStart = s + label.length + 3; selEnd = selStart + 8;
    } else if (kind === 'hr') {
      const ins = '\n\n---\n\n';
      next = v.slice(0, e) + ins + v.slice(e);
      selStart = selEnd = e + ins.length;
    } else {
      const lineStart = v.lastIndexOf('\n', s - 1) + 1;
      const block = v.slice(lineStart, e);
      const pre = PREFIX[kind];
      const strip = /^(#{1,3} |> |- |\d+\. )/;
      const changed = block.split('\n').map((l, i) => (l.trim()
        ? (kind === 'ol' ? `${i + 1}. ` : pre) + l.replace(strip, '')
        : l)).join('\n');
      next = v.slice(0, lineStart) + changed + v.slice(e);
      selStart = lineStart; selEnd = lineStart + changed.length;
    }
    setDraft({ ...draft, body: next });
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(selStart, selEnd); });
  };

  const load = useCallback(async () => {
    try { setPosts((await adminListPosts()).posts || []); } catch (e) { setError(e.message); setPosts([]); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (publish) => {
    if (!draft.title.trim() || !draft.body.trim()) { setError('A post needs a title and some text.'); return; }
    setBusy(true); setError(''); setNotice('');
    const fields = { title: draft.title, summary: draft.summary, body: draft.body };
    try {
      if (draft.id) {
        await updatePost(draft.id, publish === undefined ? fields : { ...fields, published: publish });
      } else {
        await createPost({ ...fields, published: !!publish });
      }
      setNotice(publish ? 'Published. It is now on the front page.' : 'Saved.');
      setDraft(null);
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const togglePublished = async (p) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await updatePost(p.id, { published: !p.published });
      setNotice(p.published ? 'Unpublished. It is hidden from the front page.' : 'Published. It is now on the front page.');
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const remove = async (p) => {
    setBusy(true); setError(''); setNotice('');
    try { await deletePost(p.id); setNotice('Deleted.'); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (draft) {
    const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
    return (
      <div style={{ ...card, maxWidth: 820 }}>
        <h2 style={{ margin: '0 0 14px', fontSize: 18 }}>{draft.id ? 'Edit post' : 'New post'}</h2>
        <label style={lbl}>Title</label>
        <input data-testid="blog-title" value={draft.title} onChange={set('title')} maxLength={200} style={{ ...input, width: '100%', marginBottom: 14, fontSize: 16 }} />
        <label style={lbl}>Short summary <span style={{ fontWeight: 400, color: '#78716C' }}>(optional, shown on the front-page card)</span></label>
        <textarea value={draft.summary} onChange={set('summary')} maxLength={500} rows={2} style={{ ...input, width: '100%', marginBottom: 14, resize: 'vertical' }} />
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <label style={{ ...lbl, marginBottom: 0 }}>Post <span style={{ fontWeight: 400, color: '#78716C' }}>(leave a blank line between paragraphs)</span></label>
          <div role="tablist" style={{ display: 'flex', gap: 4 }}>
            {[['Write', false], ['Preview', true]].map(([label, val]) => (
              <button key={label} type="button" role="tab" aria-selected={preview === val} onClick={() => setPreview(val)}
                style={{ ...btn(preview === val ? 'primary' : 'ghost'), padding: '5px 12px' }}>{label}</button>
            ))}
          </div>
        </div>
        {preview ? (
          <div style={{ border: '1px solid #D0CAC0', borderRadius: 6, padding: '8px 28px', minHeight: 380, background: '#FAF8F4', fontFamily: "'Sora', sans-serif" }}>
            <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.6px', margin: '18px 0 8px', color: '#1C1917' }}>{draft.title || 'Untitled'}</h1>
            {draft.summary && <p style={{ fontSize: 18, fontWeight: 300, color: '#6B6459', margin: '0 0 24px' }}>{draft.summary}</p>}
            <PostBody text={draft.body} style={{ fontSize: 16, lineHeight: 1.8, color: '#33302B', fontWeight: 300 }} />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: 6, border: '1px solid #D0CAC0', borderBottom: 'none', borderRadius: '6px 6px 0 0', background: '#FAFAF8' }}>
              {TOOLS.map((t) => (
                <button key={t.kind} type="button" title={t.title} onMouseDown={(e) => e.preventDefault()} onClick={() => format(t.kind)}
                  style={{ padding: '5px 10px', border: '1px solid #E7E5E4', borderRadius: 5, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#1C1917', ...t.style }}>
                  {t.label}
                </button>
              ))}
            </div>
            <textarea ref={bodyRef} data-testid="blog-body" value={draft.body} onChange={set('body')} rows={22}
              style={{ ...input, width: '100%', lineHeight: 1.6, resize: 'vertical', borderRadius: '0 0 6px 6px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13.5 }} />
            <div style={{ fontSize: 12, color: '#78716C', marginTop: 4 }}>
              Select text, then click a button. Click <b>Preview</b> to see how it will look.
            </div>
          </>
        )}
        <ErrorLine error={error} />
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {draft.published ? (
            <button type="button" disabled={busy} onClick={() => save()} style={btn('primary', busy)}>Save changes</button>
          ) : (
            <>
              <button type="button" disabled={busy} onClick={() => save(true)} style={btn('primary', busy)}>Publish</button>
              <button type="button" disabled={busy} onClick={() => save(false)} style={btn('ghost', busy)}>Save as draft</button>
            </>
          )}
          <button type="button" disabled={busy} onClick={() => { setDraft(null); setError(''); }} style={btn('ghost', busy)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, color: '#78716C', fontSize: 14 }}>Published posts appear on the front page for everyone. Drafts are only visible here.</p>
        <button type="button" onClick={() => { setDraft(EMPTY); setPreview(false); setNotice(''); setError(''); }} style={btn('orange')}>+ New post</button>
      </div>
      {notice && <div style={{ color: '#2C5F3A', fontSize: 13, marginBottom: 10 }}>{notice}</div>}
      <ErrorLine error={error} />
      {posts === null && <div style={{ color: '#78716C' }}>Loading…</div>}
      {posts && posts.length === 0 && <div style={{ ...card, color: '#78716C' }}>No posts yet. Click “New post” to write your first one.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(posts || []).map((p) => (
          <div key={p.id} style={{ ...card, display: 'flex', gap: 14, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 15 }}>{p.title}</strong>
                <span style={{
                  fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px',
                  background: p.published ? '#E5F4E9' : '#FEF3C7', color: p.published ? '#2E7A43' : '#92400E',
                }}>{p.published ? 'Published' : 'Draft'}</span>
              </div>
              <div style={{ fontSize: 12.5, color: '#78716C', marginTop: 4 }}>
                {p.published ? `Published ${fmtDate(p.published_at)}` : `Created ${fmtDate(p.created_at)}`}
                {p.updated_at && p.updated_at !== p.created_at ? ` · edited ${fmtDate(p.updated_at)}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {p.published && <a href={`/blog/${p.id}`} target="_blank" rel="noreferrer" style={{ ...btn('ghost'), textDecoration: 'none' }}>View</a>}
              <button type="button" disabled={busy} onClick={() => { setDraft({ ...p }); setPreview(false); setNotice(''); setError(''); }} style={btn('ghost', busy)}>Edit</button>
              <button type="button" disabled={busy} onClick={() => togglePublished(p)} style={btn(p.published ? 'ghost' : 'primary', busy)}>
                {p.published ? 'Unpublish' : 'Publish'}
              </button>
              <ConfirmButton label="Delete" confirmText="Delete this post for good?" disabled={busy} onConfirm={() => remove(p)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TOOLS = [
  { kind: 'h2', label: 'Heading', title: 'Section heading (## at the start of the line)', style: { fontWeight: 700 } },
  { kind: 'h3', label: 'Subheading', title: 'Smaller heading (### at the start of the line)', style: { fontWeight: 600 } },
  { kind: 'bold', label: 'B', title: 'Bold (**text**)', style: { fontWeight: 800, minWidth: 30 } },
  { kind: 'italic', label: 'I', title: 'Italic (*text*)', style: { fontStyle: 'italic', fontFamily: 'Georgia, serif', minWidth: 30 } },
  { kind: 'quote', label: '❝ Quote', title: 'Quote block (> at the start of the line)' },
  { kind: 'ul', label: '• List', title: 'Bulleted list (- at the start of each line)' },
  { kind: 'ol', label: '1. List', title: 'Numbered list' },
  { kind: 'link', label: '🔗 Link', title: 'Link ([text](https://...))' },
  { kind: 'hr', label: '— Divider', title: 'Divider line (---)' },
];

const lbl = { display: 'block', fontSize: 13, fontWeight: 700, color: '#44403C', marginBottom: 6 };

export default BlogTab;
