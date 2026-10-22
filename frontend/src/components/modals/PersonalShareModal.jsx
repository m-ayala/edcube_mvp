// frontend/src/components/modals/PersonalShareModal.jsx
// Share modal for the PERSONAL workspace (TASK-037): view-only links anyone can open without an
// account, and invited collaborators (up to the owner's cap, pending invites count). The org
// workspace keeps the original modal (ShareCourseModal.jsx). No payments: every upgrade prompt opens
// the waitlist.
import { useCallback, useEffect, useState } from 'react';
import JoinWaitlistModal from './JoinWaitlistModal';
import {
  cancelInvite, createLink, inviteByEmail, listCollaborators, listLinks, removeCollaborator, revokeLink,
} from '../../services/sharingApi';
import { copyText } from '../courses/courseAccess';
import { formatCardDate } from '../../utils/formatDate';

const SANS = "'DM Sans', sans-serif";
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

const sectionTitle = {
  fontSize: '13.2px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase',
  letterSpacing: '0.05em', margin: '0 0 6px',
};
const hint = { fontSize: '13.5px', color: '#78716C', margin: '0 0 10px', lineHeight: 1.45 };
const rowStyle = {
  display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px',
  backgroundColor: '#F9FAFB', border: '1px solid #F3F4F6', flexWrap: 'wrap',
};
const smallBtn = (tone = 'neutral') => ({
  border: `1px solid ${tone === 'danger' ? '#FCA5A5' : '#D1D5DB'}`, borderRadius: '6px', padding: '4px 10px',
  background: '#fff', color: tone === 'danger' ? '#B91C1C' : '#374151', fontSize: '13px', cursor: 'pointer',
  fontFamily: SANS, flexShrink: 0,
});
const primaryBtn = (disabled) => ({
  padding: '8px 18px', backgroundColor: disabled ? '#D1D5DB' : '#1C1917', color: disabled ? '#9CA3AF' : '#fff',
  border: 'none', borderRadius: '8px', cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: '14.5px', fontWeight: 600, fontFamily: SANS, flexShrink: 0,
});
const inputStyle = {
  flex: 1, minWidth: 0, border: '1px solid #D1D5DB', borderRadius: '8px', padding: '8px 10px',
  fontSize: '14px', fontFamily: SANS, backgroundColor: '#FAFAF9', color: '#1C1917', boxSizing: 'border-box',
};
const errorBox = { fontSize: '14px', color: '#B91C1C', margin: '8px 0 0', lineHeight: 1.45 };
const okBox = { fontSize: '14px', color: '#15803D', margin: '8px 0 0', lineHeight: 1.45, fontWeight: 600 };
const waitlistBtn = {
  ...smallBtn(), background: '#E8761A', color: '#fff', border: 'none', fontWeight: 600, padding: '6px 14px',
};

const isCapDetail = (err) => err?.status === 402 && (err.reason === 'collaborator_cap_reached' || err.code === 'collaborator_cap_reached');
const isPlanBlock = (err) => err?.status === 402 && ['plan_inactive', 'plan_upgrade_required'].includes(err.code);

const CopyField = ({ value, label }) => {
  const [state, setState] = useState(null);
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, minWidth: '220px' }}>
      <input readOnly value={value} aria-label={label} onFocus={(e) => e.target.select()} style={inputStyle} />
      <button type="button" style={smallBtn()} onClick={async () => {
        setState((await copyText(value)) ? 'ok' : 'fail');
        setTimeout(() => setState(null), 2000);
      }}>
        {state === 'ok' ? 'Copied' : state === 'fail' ? 'Copy failed' : 'Copy'}
      </button>
    </div>
  );
};

const PersonalShareModal = ({ isOpen, onClose, courseId, courseName }) => {
  const saved = !!courseId && courseId !== 'new-course';
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [links, setLinks] = useState([]);
  const [collab, setCollab] = useState(null);
  const [showWaitlist, setShowWaitlist] = useState(false);

  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState(null); // { message, upgrade }
  const [confirmRevoke, setConfirmRevoke] = useState(null);

  const [email, setEmail] = useState('');
  const [access, setAccess] = useState('collaborate');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteResult, setInviteResult] = useState(null); // { kind: 'ok'|'error'|'cap'|'upgrade', message, url? }
  const [confirmRemove, setConfirmRemove] = useState(null);

  const reloadLinks = useCallback(async () => {
    const r = await listLinks(courseId);
    setLinks(r.links || []);
  }, [courseId]);
  const reloadCollab = useCallback(async () => {
    setCollab(await listCollaborators(courseId));
  }, [courseId]);

  // Load on open.
  useEffect(() => {
    if (!isOpen || !saved) return undefined;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setLinkError(null);
    setInviteResult(null);
    setConfirmRevoke(null);
    setConfirmRemove(null);
    Promise.allSettled([listLinks(courseId), listCollaborators(courseId)]).then(([l, c]) => {
      if (cancelled) return;
      const failed = [l, c].find((x) => x.status === 'rejected');
      if (failed) {
        const err = failed.reason;
        setLoadError(err?.code === 'owner_only' || err?.status === 403
          ? 'Only the course owner can manage sharing.'
          : (err?.message || 'Could not load sharing settings.'));
      } else {
        setLinks(l.value.links || []);
        setCollab(c.value);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [isOpen, saved, courseId]);

  if (!isOpen) return null;

  const activeLinks = links.filter((l) => l.active !== false && !l.revoked_at);
  const cap = collab ? collab.cap : undefined;
  const used = collab?.used ?? 0;
  const coedit = !!collab?.coediting_allowed;

  // ── links ─────────────────────────────────────────────────────────────
  const handleCreateLink = async () => {
    setLinkBusy(true);
    setLinkError(null);
    try {
      await createLink(courseId);
      await reloadLinks();
    } catch (err) {
      setLinkError({
        message: err.message || 'Could not create the link.',
        upgrade: isPlanBlock(err),
      });
    } finally {
      setLinkBusy(false);
    }
  };

  const handleRevoke = async (token) => {
    setLinkBusy(true);
    setLinkError(null);
    try {
      await revokeLink(courseId, token);
      setConfirmRevoke(null);
      await reloadLinks();
    } catch (err) {
      setLinkError({ message: err.message || 'Could not revoke the link.' });
    } finally {
      setLinkBusy(false);
    }
  };

  // ── collaborators ─────────────────────────────────────────────────────
  const handleInvite = async (e) => {
    e?.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!EMAIL_RE.test(addr)) {
      setInviteResult({ kind: 'error', message: 'Enter a valid email address.' });
      return;
    }
    setInviteBusy(true);
    setInviteResult(null);
    try {
      const r = await inviteByEmail(courseId, addr, access);
      setEmail('');
      if (r.status === 'added') {
        setInviteResult({ kind: 'ok', message: `${r.email} was added to this course and notified.` });
      } else if (r.status === 'already_shared') {
        setInviteResult({ kind: 'ok', message: `${r.email} already has this access.` });
      } else if (r.email_sent === false) {
        setInviteResult({
          kind: 'ok', url: r.invite_url,
          message: `We couldn't send the email to ${r.email}. Copy this invite link and send it to them yourself:`,
        });
      } else {
        setInviteResult({ kind: 'ok', message: `Invitation sent to ${r.email}.` });
      }
      try { await reloadCollab(); } catch { /* the list refresh is best effort */ }
    } catch (err) {
      if (isCapDetail(err)) {
        const n = err.detail?.cap ?? collab?.cap ?? 3;
        setInviteResult({
          kind: 'cap',
          message: `You can have up to ${n} collaborators per course. Remove one or cancel a pending invite to add someone new.`,
        });
        try { await reloadCollab(); } catch { /* ignore */ }
      } else if (isPlanBlock(err)) {
        setInviteResult({ kind: 'upgrade', message: err.message });
      } else if (err.status === 429) {
        setInviteResult({ kind: 'error', message: 'Too many invitations in a short time. Try again later.' });
      } else {
        setInviteResult({ kind: 'error', message: err.message || 'Could not send the invitation.' });
      }
    } finally {
      setInviteBusy(false);
    }
  };

  const handleCancelInvite = async (id) => {
    setInviteBusy(true);
    setInviteResult(null);
    try {
      await cancelInvite(courseId, id);
      await reloadCollab();
    } catch (err) {
      setInviteResult({ kind: 'error', message: err.message || 'Could not cancel the invitation.' });
    } finally {
      setInviteBusy(false);
    }
  };

  const handleRemove = async (uid) => {
    setInviteBusy(true);
    setInviteResult(null);
    try {
      await removeCollaborator(courseId, uid);
      setConfirmRemove(null);
      await reloadCollab();
    } catch (err) {
      setInviteResult({ kind: 'error', message: err.message || 'Could not remove the collaborator.' });
    } finally {
      setInviteBusy(false);
    }
  };

  const accessLabel = (t) => (t === 'collaborate' ? 'Can edit' : 'Can view');

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000, backgroundColor: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-label="Share course"
        data-testid="share-modal"
        style={{
          width: '540px', maxWidth: '96vw', backgroundColor: '#fff', borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.22)', fontFamily: SANS, overflow: 'hidden',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{
          padding: '18px 24px 14px', borderBottom: '1px solid #F3F4F6',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: '17.6px', fontWeight: 700, color: '#1C1917' }}>Share</div>
            <div style={{ fontSize: '13.2px', color: '#78716C', marginTop: '2px' }}>{courseName}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#9CA3AF', lineHeight: 1, padding: '2px 6px',
          }}>×</button>
        </div>

        <div style={{ padding: '18px 24px 22px', overflowY: 'auto', flex: 1 }}>
          {!saved ? (
            <p style={hint}>Save the course first, then you can share it.</p>
          ) : loading ? (
            <p style={hint}>Loading…</p>
          ) : loadError ? (
            <p role="alert" style={errorBox}>{loadError}</p>
          ) : (
            <>
              {/* ── View-only links ── */}
              <section data-testid="links-section">
                <h3 style={sectionTitle}>View-only links</h3>
                <p style={hint}>Anyone with a link can view this course without an account. They can&apos;t edit it. You can revoke a link at any time.</p>

                <button type="button" onClick={handleCreateLink} disabled={linkBusy} style={primaryBtn(linkBusy)}>
                  {linkBusy ? 'Working…' : 'Create link'}
                </button>

                {linkError && (
                  <div>
                    <p role="alert" data-testid="link-error" style={errorBox}>{linkError.message}</p>
                    {linkError.upgrade && (
                      <button type="button" style={{ ...waitlistBtn, marginTop: '8px' }} onClick={() => setShowWaitlist(true)}>
                        Join the waitlist
                      </button>
                    )}
                  </div>
                )}

                {activeLinks.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                    {activeLinks.map((l) => (
                      <div key={l.token} data-testid="link-row" style={rowStyle}>
                        <CopyField value={l.url || `${window.location.origin}/share/${l.token}`} label="View-only link" />
                        <span style={{ fontSize: '12.5px', color: '#78716C' }}>
                          {l.view_count || 0} {(l.view_count || 0) === 1 ? 'view' : 'views'}
                          {l.created_at ? ` · created ${formatCardDate(l.created_at)}` : ''}
                        </span>
                        {confirmRevoke === l.token ? (
                          <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '13px', color: '#B91C1C' }}>Anyone using this link will lose access.</span>
                            <button type="button" style={smallBtn('danger')} disabled={linkBusy} onClick={() => handleRevoke(l.token)}>Revoke</button>
                            <button type="button" style={smallBtn()} onClick={() => setConfirmRevoke(null)}>Keep</button>
                          </span>
                        ) : (
                          <button type="button" style={smallBtn('danger')} onClick={() => setConfirmRevoke(l.token)}>Revoke</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ── Collaborators ── */}
              <section data-testid="collab-section" style={{ marginTop: '26px' }}>
                <h3 style={sectionTitle}>Collaborators</h3>

                {!coedit ? (
                  <div style={{ ...rowStyle, justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '14px', color: '#44403C' }}>Co-editing is available on paid plans</span>
                    <button type="button" style={waitlistBtn} onClick={() => setShowWaitlist(true)}>Join the waitlist</button>
                  </div>
                ) : (
                  <>
                    <p style={hint}>
                      Invite people by email. They join for free on any plan and land directly in this course.{' '}
                      <strong data-testid="collab-count">
                        {cap == null ? `${used} collaborators · Unlimited` : `${used} of ${cap} collaborators used`}
                      </strong>
                    </p>
                    <form onSubmit={handleInvite} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <input
                        type="email" value={email} placeholder="Email address" aria-label="Invite by email"
                        onChange={(e) => setEmail(e.target.value)} style={{ ...inputStyle, minWidth: '180px' }}
                      />
                      <select value={access} onChange={(e) => setAccess(e.target.value)} aria-label="Access"
                        style={{ border: '1px solid #D1D5DB', borderRadius: '8px', padding: '8px', fontSize: '14px', fontFamily: SANS, backgroundColor: '#fff' }}>
                        <option value="collaborate">Can edit</option>
                        <option value="view">Can view</option>
                      </select>
                      <button type="submit" disabled={inviteBusy || !email.trim()} style={primaryBtn(inviteBusy || !email.trim())}>
                        {inviteBusy ? 'Working…' : 'Invite'}
                      </button>
                    </form>
                  </>
                )}

                {inviteResult && (
                  <div>
                    <p role={inviteResult.kind === 'ok' ? 'status' : 'alert'} data-testid="invite-result" data-kind={inviteResult.kind}
                      style={inviteResult.kind === 'ok' ? okBox : errorBox}>
                      {inviteResult.message}
                    </p>
                    {inviteResult.url && (
                      <div style={{ marginTop: '8px' }}><CopyField value={inviteResult.url} label="Invite link" /></div>
                    )}
                    {inviteResult.kind === 'upgrade' && (
                      <button type="button" style={{ ...waitlistBtn, marginTop: '8px' }} onClick={() => setShowWaitlist(true)}>
                        Join the waitlist
                      </button>
                    )}
                  </div>
                )}

                {(collab?.collaborators?.length > 0 || collab?.pending_invites?.length > 0) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px' }}>
                    {(collab.collaborators || []).map((c) => (
                      <div key={c.uid} data-testid="collab-row" style={rowStyle}>
                        <span style={{ flex: 1, fontSize: '14.5px', color: '#1C1917', fontWeight: 500, minWidth: '120px' }}>{c.display_name || c.uid}</span>
                        <span style={{ fontSize: '13px', color: '#57534E' }}>{accessLabel(c.accessType)}</span>
                        {confirmRemove === c.uid ? (
                          <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '13px', color: '#B91C1C' }}>They will lose access right away.</span>
                            <button type="button" style={smallBtn('danger')} disabled={inviteBusy} onClick={() => handleRemove(c.uid)}>Remove</button>
                            <button type="button" style={smallBtn()} onClick={() => setConfirmRemove(null)}>Keep</button>
                          </span>
                        ) : (
                          <button type="button" style={smallBtn('danger')} onClick={() => setConfirmRemove(c.uid)}>Remove</button>
                        )}
                      </div>
                    ))}
                    {(collab.pending_invites || []).map((p) => (
                      <div key={p.id} data-testid="pending-row" style={rowStyle}>
                        <span style={{ flex: 1, fontSize: '14.5px', color: '#1C1917', minWidth: '120px' }}>{p.email}</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#92400E', background: '#FEF3C7', borderRadius: '999px', padding: '2px 8px' }}>Pending</span>
                        <span style={{ fontSize: '13px', color: '#57534E' }}>{accessLabel(p.access_type === 'collaborate' ? 'collaborate' : 'view')}</span>
                        <button type="button" style={smallBtn()} disabled={inviteBusy} onClick={() => handleCancelInvite(p.id)}>Cancel invite</button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
      {showWaitlist && <JoinWaitlistModal onClose={() => setShowWaitlist(false)} />}
    </div>
  );
};

export default PersonalShareModal;
