// frontend/src/components/courses/CourseComments.jsx
// "Comments" card at the bottom of a course. Shown to the owner, editors ("Can edit") and commenters
// ("Can comment"). Viewers never see it: the backend answers 403 comments_not_allowed and this renders
// nothing. Comments are suggestions about the course as a whole; they never change the course.
import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, Trash2, Loader2 } from 'lucide-react';
import { addComment, deleteComment, listComments } from '../../services/sharingApi';

const FONT = "'DM Sans', sans-serif";
const MAX = 2000;

const ROLE_CHIP = {
  owner: { label: 'Owner', bg: '#EFF6FF', color: '#1D4ED8' },
  collaborate: { label: 'Can edit', bg: '#ECFDF5', color: '#047857' },
  comment: { label: 'Can comment', bg: '#FEF3C7', color: '#92400E' },
};

const initials = (name) => {
  const parts = String(name || '?').trim().split(/\s+/);
  return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
};

const AVATAR_COLORS = ['#8B7355', '#3E62BC', '#BF2066', '#2C7A5B', '#7C3AED', '#B45309'];
const avatarColor = (seed) => {
  let h = 0;
  for (const ch of String(seed || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

const Avatar = ({ name, seed }) => (
  <div aria-hidden style={{
    width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
    background: avatarColor(seed || name), color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600,
  }}>{initials(name)}</div>
);

const timeAgo = (iso) => {
  if (!iso) return '';
  const then = new Date(iso);
  const secs = Math.max(0, (Date.now() - then.getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 7 * 86400) return `${Math.floor(secs / 86400)}d ago`;
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: then.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};

const CourseComments = ({ courseId, currentUser, style }) => {
  const saved = !!courseId && courseId !== 'new-course';
  const [state, setState] = useState('loading'); // 'loading' | 'ready' | 'hidden' | 'error'
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const listEndRef = useRef(null);

  const load = useCallback(async (quiet = false) => {
    if (!saved) { setState('hidden'); return; }
    try {
      const r = await listComments(courseId);
      setComments(r.comments || []);
      setState('ready');
    } catch (err) {
      if (err?.status === 403 || err?.status === 404) setState('hidden');
      else if (!quiet) setState('error');
    }
  }, [courseId, saved]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState !== 'hidden') load(true); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  if (state === 'hidden' || !saved) return null;

  const submit = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || posting) return;
    setPosting(true);
    setError(null);
    try {
      const r = await addComment(courseId, body);
      setComments((prev) => [...prev, r.comment]);
      setText('');
      setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    } catch (err) {
      setError(err.message || 'Could not post the comment.');
      if (err?.status === 403 || err?.status === 404) load(true);
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id) => {
    setConfirmDelete(null);
    const before = comments;
    setComments((prev) => prev.filter((c) => c.id !== id));
    try {
      await deleteComment(courseId, id);
    } catch (err) {
      setComments(before);
      setError(err.message || 'Could not delete the comment.');
    }
  };

  const myName = currentUser?.displayName || currentUser?.email || 'You';
  const over = text.length > MAX;

  return (
    <section
      aria-label="Comments"
      style={{
        maxWidth: '920px', margin: '32px auto 40px', background: '#FFFFFF',
        border: '1px solid #E7E5E4', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        fontFamily: FONT, overflow: 'hidden', ...style,
      }}
    >
      <style>{'@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 22px', borderBottom: '1px solid #F0EEEA' }}>
        <MessageSquare size={18} color="#3E62BC" />
        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#111' }}>Comments</h3>
        {comments.length > 0 && (
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#3E62BC', background: '#EEF2FF', borderRadius: '999px', padding: '2px 9px' }}>
            {comments.length}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '12.5px', color: '#8A8A8A' }}>
          Visible to the owner, editors and commenters
        </span>
      </div>

      {/* Thread */}
      <div style={{ padding: '6px 22px' }}>
        {state === 'loading' && (
          <div style={{ padding: '18px 0', color: '#8A8A8A', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading comments…
          </div>
        )}
        {state === 'error' && (
          <div style={{ padding: '18px 0', color: '#B91C1C', fontSize: '14px' }}>
            Comments could not be loaded. <button type="button" onClick={() => { setState('loading'); load(); }}
              style={{ background: 'none', border: 'none', color: '#3E62BC', cursor: 'pointer', fontWeight: 600, padding: 0, fontFamily: FONT }}>Try again</button>
          </div>
        )}
        {state === 'ready' && comments.length === 0 && (
          <div style={{ padding: '22px 0', textAlign: 'center', color: '#8A8A8A', fontSize: '14px' }}>
            No comments yet. Share a suggestion for how this course could be improved.
          </div>
        )}
        {comments.map((c, i) => {
          const chip = ROLE_CHIP[c.author_role];
          const mine = c.author_uid && c.author_uid === currentUser?.uid;
          return (
            <div key={c.id} data-testid="comment" style={{
              display: 'flex', gap: '12px', padding: '14px 0',
              borderTop: i === 0 ? 'none' : '1px solid #F3F2EF',
            }}>
              <Avatar name={c.author_name} seed={c.author_uid} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#1C1917' }}>{mine ? `${c.author_name} (you)` : c.author_name}</span>
                  {chip && (
                    <span style={{ fontSize: '11px', fontWeight: 700, color: chip.color, background: chip.bg, borderRadius: '999px', padding: '1px 8px' }}>
                      {chip.label}
                    </span>
                  )}
                  <span title={c.created_at ? new Date(c.created_at).toLocaleString() : ''} style={{ fontSize: '12.5px', color: '#A3A3A3' }}>
                    {timeAgo(c.created_at)}
                  </span>
                  {c.can_delete && (
                    confirmDelete === c.id ? (
                      <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12.5px', color: '#B91C1C' }}>Delete this comment?</span>
                        <button type="button" onClick={() => remove(c.id)} style={smallBtn('#B91C1C')}>Delete</button>
                        <button type="button" onClick={() => setConfirmDelete(null)} style={smallBtn('#57534E')}>Keep</button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirmDelete(c.id)} title="Delete comment" aria-label="Delete comment"
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#C4C4C4', padding: '2px', display: 'flex' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#C4C4C4'; }}>
                        <Trash2 size={14} />
                      </button>
                    )
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.55, color: '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {c.text}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={listEndRef} />
      </div>

      {/* Composer */}
      {state !== 'loading' && (
        <form onSubmit={submit} style={{ display: 'flex', gap: '12px', padding: '14px 22px 16px', background: '#FAFAF8', borderTop: '1px solid #F0EEEA' }}>
          <Avatar name={myName} seed={currentUser?.uid} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e); }}
              placeholder="Suggest how this course could be improved…"
              aria-label="Add a comment"
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: '72px',
                padding: '10px 12px', borderRadius: '10px', border: `1px solid ${over ? '#F87171' : '#D6D3D1'}`,
                fontFamily: FONT, fontSize: '14px', lineHeight: 1.5, color: '#111', background: '#fff', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
              {error ? (
                <span role="alert" style={{ fontSize: '12.5px', color: '#B91C1C' }}>{error}</span>
              ) : (
                <span style={{ fontSize: '12px', color: '#A3A3A3' }}>⌘/Ctrl + Enter to post</span>
              )}
              {text.length > MAX - 200 && (
                <span style={{ fontSize: '12px', color: over ? '#B91C1C' : '#A3A3A3' }}>{text.length}/{MAX}</span>
              )}
              <button
                type="submit"
                disabled={posting || !text.trim() || over}
                style={{
                  marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px',
                  height: '34px', padding: '0 16px', borderRadius: '9px', border: 'none',
                  background: posting || !text.trim() || over ? '#C7D2FE' : '#3E62BC', color: '#fff',
                  cursor: posting || !text.trim() || over ? 'default' : 'pointer', fontFamily: FONT, fontSize: '13.5px', fontWeight: 600,
                }}
              >
                {posting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
                {posting ? 'Posting…' : 'Comment'}
              </button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
};

const smallBtn = (color) => ({
  height: '24px', padding: '0 9px', borderRadius: '6px', border: `1px solid ${color}55`,
  background: '#fff', color, cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: FONT,
});

export default CourseComments;
