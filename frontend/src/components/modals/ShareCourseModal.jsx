// frontend/src/components/modals/ShareCourseModal.jsx
// Google-Docs-style share modal — shows existing access, invite new, update/remove.

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getAllTeachers } from '../../utils/teacherService';
import {
  sendShareInvite,
  sendShareByEmail,
  getCollaborators,
  updateCollaboratorAccess,
  removeCollaborator,
} from '../../services/notificationService';

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const MAX_EMAILS = 20;
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

// Friendly text for a failed share-by-email call.
const shareErrorMessage = (err) => {
  if (err?.code === 'too_many_emails') return `You can share with at most ${err.max || MAX_EMAILS} email addresses at a time.`;
  if (err?.code === 'cannot_share_with_self') return "You can't share a course with yourself.";
  if (err?.code === 'rate_limited' || err?.status === 429) return 'Too many lookups — try again in a minute.';
  if (err?.status === 403) return 'Only the course owner can share this course.';
  if (err?.status === 503) return 'Sharing is temporarily unavailable. Please try again shortly.';
  return 'Failed to send invitations. Please try again.';
};

const Avatar = ({ name }) => (
  <div style={{
    width: '32px', height: '32px', borderRadius: '50%',
    backgroundColor: '#8B7355', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '13.2px', fontWeight: '600', flexShrink: 0,
  }}>
    {getInitials(name)}
  </div>
);

// ── Shared row component ──────────────────────────────────────────────────────
const PersonRow = ({ person, onAccessChange, onRemove }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '8px 12px', borderRadius: '8px',
    backgroundColor: '#F9FAFB', border: '1px solid #F3F4F6',
  }}>
    <Avatar name={person.display_name} />
    <span style={{ flex: 1, fontSize: '15.4px', color: '#1C1917', fontWeight: '500' }}>
      {person.display_name}
    </span>
    <select
      value={person.accessType}
      onChange={(e) => onAccessChange(e.target.value)}
      style={{
        border: '1px solid #D1D5DB', borderRadius: '6px',
        padding: '4px 8px', fontSize: '13.2px', color: '#374151',
        backgroundColor: '#fff', cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <option value="view">Viewer</option>
      <option value="collaborate">Collaborator</option>
    </select>
    <button
      onClick={onRemove}
      title="Remove access"
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#9CA3AF', fontSize: '19.8px', lineHeight: 1,
        padding: '0 2px', flexShrink: 0,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF'; }}
    >×</button>
  </div>
);

// ── Main modal ────────────────────────────────────────────────────────────────
const ShareCourseModal = ({ isOpen, onClose, courseId, courseName }) => {
  const { currentUser, isPublicUser } = useAuth();

  // Existing collaborators (already have access)
  const [collaborators, setCollaborators] = useState([]);
  const [loadingCollab, setLoadingCollab]   = useState(false);

  // Invite new people
  const [query, setQuery]       = useState('');
  const [allTeachers, setAllTeachers] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selected, setSelected] = useState([]);   // [{uid, display_name, accessType}]
  const [sending, setSending]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [error, setError]       = useState(null);

  // Public users: invite by email (chips) with one access level for the batch
  const [emailInput, setEmailInput] = useState('');
  const [emails, setEmails]         = useState([]);
  const [emailAccess, setEmailAccess] = useState('view');
  const [shareResult, setShareResult] = useState(null); // { count, notFound }

  const inputRef    = useRef(null);
  const dropdownRef = useRef(null);

  // Load org teachers once per open
  useEffect(() => {
    if (!isOpen || !currentUser || isPublicUser) return;
    getAllTeachers(currentUser)
      .then((all) => {
        setAllTeachers(
          all
            .filter((t) => t.teacher_uid !== currentUser.uid)
            .sort((a, b) => a.display_name.localeCompare(b.display_name))
        );
      })
      .catch(() => {});
  }, [isOpen, currentUser, isPublicUser]);

  // Load existing collaborators on open
  useEffect(() => {
    if (!isOpen || !currentUser || !courseId || courseId === 'new-course') return;
    setLoadingCollab(true);
    getCollaborators(currentUser, courseId)
      .then(setCollaborators)
      .catch(() => setCollaborators([]))
      .finally(() => setLoadingCollab(false));
  }, [isOpen, currentUser, courseId]);

  // Reset invite state on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelected([]);
      setEmailInput('');
      setEmails([]);
      setEmailAccess('view');
      setShareResult(null);
      setSent(false);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!isOpen) return null;

  const existingUids = new Set(collaborators.map((c) => c.uid));
  const selectedUids = new Set(selected.map((s) => s.uid));

  const suggestions = query.trim()
    ? allTeachers.filter(
        (t) =>
          t.display_name.toLowerCase().startsWith(query.trim().toLowerCase()) &&
          !existingUids.has(t.teacher_uid) &&
          !selectedUids.has(t.teacher_uid)
      )
    : [];

  // ── Invite handlers ───────────────────────────────────────────────────
  const handleSelectTeacher = (teacher) => {
    setSelected((prev) => [
      ...prev,
      { uid: teacher.teacher_uid, display_name: teacher.display_name, accessType: 'view' },
    ]);
    setQuery('');
    setDropdownOpen(false);
    inputRef.current?.focus();
  };

  const handleRemoveFromInvite = (uid) => setSelected((prev) => prev.filter((s) => s.uid !== uid));

  const handleInviteAccessChange = (uid, accessType) =>
    setSelected((prev) => prev.map((s) => (s.uid === uid ? { ...s, accessType } : s)));

  const handleShare = async () => {
    if (selected.length === 0) return;
    setSending(true);
    setError(null);
    try {
      await sendShareInvite(currentUser, {
        courseId,
        courseName,
        recipients: selected.map((s) => ({ uid: s.uid, access_type: s.accessType })),
      });
      setSent(true);
      // Refresh the persistent list
      const updated = await getCollaborators(currentUser, courseId);
      setCollaborators(updated);
      setSelected([]);
    } catch {
      setError('Failed to send invitations. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // ── Public-space email handlers ───────────────────────────────────────
  // Takes the typed text (one or several addresses separated by space/comma/semicolon)
  // and adds the valid, new ones as chips.
  const commitEmails = (raw) => {
    const parts = String(raw).split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) return;
    const invalid = parts.filter((x) => !EMAIL_RE.test(x));
    const next = [...emails];
    let overflow = false;
    parts.filter((x) => EMAIL_RE.test(x)).forEach((x) => {
      if (next.includes(x)) return;
      if (next.length >= MAX_EMAILS) { overflow = true; return; }
      next.push(x);
    });
    setEmails(next);
    setShareResult(null);
    if (overflow) setError(`You can share with at most ${MAX_EMAILS} email addresses at a time.`);
    else if (invalid.length) setError(`Not a valid email address: ${invalid.join(', ')}`);
    else setError(null);
    setEmailInput(invalid.join(' '));
  };

  const handleEmailKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ' || e.key === ';') {
      if (emailInput.trim()) { e.preventDefault(); commitEmails(emailInput); }
    } else if (e.key === 'Backspace' && !emailInput && emails.length) {
      setEmails((prev) => prev.slice(0, -1));
    }
  };

  const handleShareByEmail = async () => {
    // Include whatever is still typed in the box
    const pending = emailInput.trim();
    let toSend = emails;
    if (pending && EMAIL_RE.test(pending.toLowerCase()) && !emails.includes(pending.toLowerCase()) && emails.length < MAX_EMAILS) {
      toSend = [...emails, pending.toLowerCase()];
    }
    if (toSend.length === 0) return;
    setSending(true);
    setError(null);
    setShareResult(null);
    try {
      const res = await sendShareByEmail(currentUser, {
        courseId, courseName, emails: toSend, accessType: emailAccess,
      });
      setShareResult({
        count: res.shared_with ?? (res.shared || []).length,
        notFound: res.not_found || [],
      });
      setEmails([]);
      setEmailInput('');
      try { setCollaborators(await getCollaborators(currentUser, courseId)); } catch { /* list refresh is best effort */ }
    } catch (err) {
      setError(shareErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  // ── Existing collaborator handlers ────────────────────────────────────
  const handleAccessUpdate = async (uid, newAccessType) => {
    setCollaborators((prev) =>
      prev.map((c) => (c.uid === uid ? { ...c, accessType: newAccessType } : c))
    );
    try {
      await updateCollaboratorAccess(currentUser, courseId, uid, newAccessType);
    } catch {
      const restored = await getCollaborators(currentUser, courseId);
      setCollaborators(restored);
      setError('Failed to update access.');
    }
  };

  const handleRemoveCollaborator = async (uid) => {
    setCollaborators((prev) => prev.filter((c) => c.uid !== uid));
    try {
      await removeCollaborator(currentUser, courseId, uid);
    } catch {
      const restored = await getCollaborators(currentUser, courseId);
      setCollaborators(restored);
      setError('Failed to remove collaborator.');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        backgroundColor: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '520px', maxWidth: '96vw',
          backgroundColor: '#fff',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
          fontFamily: "'DM Sans', sans-serif",
          overflow: 'hidden',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: '18px 24px 14px',
          borderBottom: '1px solid #F3F4F6',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: '17.6px', fontWeight: '700', color: '#1C1917' }}>Share</div>
            <div style={{ fontSize: '13.2px', color: '#78716C', marginTop: '2px' }}>{courseName}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '22px', color: '#9CA3AF', lineHeight: 1, padding: '2px 6px',
            }}
          >×</button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>

          {isPublicUser ? (
            <div>
              <div
                onClick={() => inputRef.current?.focus()}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
                  border: '1px solid #D1D5DB', borderRadius: '8px',
                  padding: '8px 12px', minHeight: '44px',
                  backgroundColor: '#FAFAF9', cursor: 'text',
                }}
              >
                {emails.map((em) => (
                  <span key={em} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    backgroundColor: '#EEF2FF', color: '#3E62BC', borderRadius: '999px',
                    padding: '3px 6px 3px 10px', fontSize: '13.2px', fontWeight: '500',
                  }}>
                    {em}
                    <button
                      onClick={(e) => { e.stopPropagation(); setEmails((prev) => prev.filter((x) => x !== em)); }}
                      title="Remove"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3E62BC', fontSize: '16px', lineHeight: 1, padding: '0 2px' }}
                    >×</button>
                  </span>
                ))}
                <input
                  ref={inputRef}
                  type="email"
                  value={emailInput}
                  placeholder={emails.length ? 'Add another email…' : 'Add people by email…'}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={handleEmailKeyDown}
                  onBlur={() => { if (emailInput.trim()) commitEmails(emailInput); }}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData('text');
                    if (/[\s,;]/.test(text.trim())) { e.preventDefault(); commitEmails(text); }
                  }}
                  style={{
                    border: 'none', outline: 'none', background: 'transparent',
                    fontSize: '15.4px', color: '#1C1917', flex: 1, minWidth: '160px',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', gap: '10px' }}>
                <span style={{ fontSize: '12.5px', color: '#78716C' }}>
                  {emails.length}/{MAX_EMAILS} · They need an EdCube account already.
                </span>
                <select
                  value={emailAccess}
                  onChange={(e) => setEmailAccess(e.target.value)}
                  aria-label="Access level for these people"
                  style={{
                    border: '1px solid #D1D5DB', borderRadius: '6px',
                    padding: '4px 8px', fontSize: '13.2px', color: '#374151',
                    backgroundColor: '#fff', cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  <option value="view">View</option>
                  <option value="collaborate">Collaborate</option>
                </select>
              </div>
            </div>
          ) : (
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              border: '1px solid #D1D5DB', borderRadius: '8px',
              padding: '8px 12px', minHeight: '44px',
              backgroundColor: '#FAFAF9',
            }}>
              <span style={{ color: '#9CA3AF', fontSize: '16.5px' }}>🔍</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                placeholder="Invite people…"
                onChange={(e) => { setQuery(e.target.value); setDropdownOpen(true); }}
                onFocus={() => { if (query.trim()) setDropdownOpen(true); }}
                style={{
                  border: 'none', outline: 'none', background: 'transparent',
                  fontSize: '15.4px', color: '#1C1917', flex: 1, minWidth: '120px',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              />
            </div>

            {dropdownOpen && suggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                backgroundColor: '#fff', border: '1px solid #E5E7EB',
                borderRadius: '8px', boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
                zIndex: 100, maxHeight: '180px', overflowY: 'auto',
              }}>
                {suggestions.map((teacher) => (
                  <div
                    key={teacher.teacher_uid}
                    onMouseDown={() => handleSelectTeacher(teacher)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <Avatar name={teacher.display_name} />
                    <span style={{ fontSize: '15.4px', color: '#1C1917' }}>{teacher.display_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {/* Pending invites */}
          {selected.length > 0 && (
            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selected.map((person) => (
                <PersonRow
                  key={person.uid}
                  person={person}
                  onAccessChange={(val) => handleInviteAccessChange(person.uid, val)}
                  onRemove={() => handleRemoveFromInvite(person.uid)}
                />
              ))}
            </div>
          )}

          {sent && (
            <div style={{ color: '#16A34A', fontSize: '14.3px', fontWeight: '600', marginTop: '12px' }}>
              ✓ Invitations sent!
            </div>
          )}

          {shareResult && (
            <div style={{ marginTop: '12px', fontSize: '14.3px' }}>
              {shareResult.count > 0 && (
                <div style={{ color: '#16A34A', fontWeight: '600' }}>
                  ✓ Shared with {shareResult.count} {shareResult.count === 1 ? 'person' : 'people'}
                </div>
              )}
              {shareResult.notFound.length > 0 && (
                <div style={{ color: '#B45309', marginTop: '4px' }}>
                  No EdCube account found for: {shareResult.notFound.join(', ')} — ask them to sign up first
                </div>
              )}
              {shareResult.count === 0 && shareResult.notFound.length === 0 && (
                <div style={{ color: '#78716C' }}>Shared with 0 people</div>
              )}
            </div>
          )}

          {error && (
            <p style={{ fontSize: '14.3px', color: '#DC2626', marginTop: '10px' }}>{error}</p>
          )}

          {/* ── People with access (always visible) ── */}
          <div style={{ marginTop: '24px' }}>
            <div style={{
              fontSize: '13.2px', fontWeight: '600', color: '#6B7280',
              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px',
            }}>
              People with access
            </div>

            {loadingCollab ? (
              <div style={{ fontSize: '14.3px', color: '#9CA3AF', padding: '8px 0' }}>Loading…</div>
            ) : collaborators.length === 0 ? (
              <div style={{ fontSize: '14.3px', color: '#9CA3AF', fontStyle: 'italic', padding: '8px 0' }}>
                No one has access yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {collaborators.map((person) => (
                  <PersonRow
                    key={person.uid}
                    person={person}
                    onAccessChange={(val) => handleAccessUpdate(person.uid, val)}
                    onRemove={() => handleRemoveCollaborator(person.uid)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer (only when pending invites) ── */}
        {(isPublicUser ? (emails.length > 0 || emailInput.trim()) : selected.length > 0) && (
          <div style={{
            padding: '14px 24px',
            borderTop: '1px solid #F3F4F6',
            display: 'flex', justifyContent: 'flex-end',
            flexShrink: 0,
          }}>
            <button
              onClick={isPublicUser ? handleShareByEmail : handleShare}
              disabled={sending}
              style={{
                padding: '9px 24px',
                backgroundColor: sending ? '#D1D5DB' : '#1C1917',
                color: sending ? '#9CA3AF' : '#fff',
                border: 'none', borderRadius: '8px',
                cursor: sending ? 'not-allowed' : 'pointer',
                fontSize: '15.4px', fontWeight: '600',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {sending ? 'Sharing…' : 'Share'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShareCourseModal;
