// frontend/src/components/admin/BlogTab.jsx
// Write, edit, publish/unpublish and delete the blog posts shown on the front page.
// Drafts are only visible here; published posts appear on the landing page and at /blog.
import { useState, useEffect, useCallback } from 'react';
import { adminListPosts, createPost, updatePost, deletePost } from '../../services/blogApi';
import { fmtDate, btn, input, card } from './adminStyles';
import { ConfirmButton, ErrorLine } from './adminUi';

const EMPTY = { id: null, title: '', summary: '', body: '' };

const BlogTab = () => {
  const [posts, setPosts] = useState(null);
  const [draft, setDraft] = useState(null); // the post being edited (EMPTY for a new one)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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
        <label style={lbl}>Post <span style={{ fontWeight: 400, color: '#78716C' }}>(leave a blank line between paragraphs)</span></label>
        <textarea data-testid="blog-body" value={draft.body} onChange={set('body')} rows={18} style={{ ...input, width: '100%', lineHeight: 1.6, resize: 'vertical' }} />
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
        <button type="button" onClick={() => { setDraft(EMPTY); setNotice(''); setError(''); }} style={btn('orange')}>+ New post</button>
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
              <button type="button" disabled={busy} onClick={() => { setDraft({ ...p }); setNotice(''); setError(''); }} style={btn('ghost', busy)}>Edit</button>
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

const lbl = { display: 'block', fontSize: 13, fontWeight: 700, color: '#44403C', marginBottom: 6 };

export default BlogTab;
