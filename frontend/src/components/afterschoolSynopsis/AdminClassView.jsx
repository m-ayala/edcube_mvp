// frontend/src/components/afterschoolSynopsis/AdminClassView.jsx
//
// Grade <select> only — the month comes from AdminMonthDropdown.jsx's current
// selection (shared state, lifted to AfterschoolSynopsisPage). Fetches full
// entries (title/desc/photo_urls) for all 7 activities via GET /classes, and
// renders one row per activity, collapsed by default (chevron to expand),
// plus a pencil-icon edit button per block that switches it into an inline
// edit form reusing BlockFields.jsx (the same component EntryFormView.jsx
// uses) with Save/Cancel. Saving goes through the same POST /entries the
// teacher flow uses — fetch current entry, patch one block, resubmit the
// full blocks array; there is no separate "admin write" endpoint.

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Pencil, Download, X, Check } from 'lucide-react';
import {
  GRADE_OPTIONS,
  SINGLE_BLOCK_TYPE,
  slugify,
  synopsisTypesForGrade,
} from '../../constants/afterschoolSynopsisSchema';
import {
  getClassStatus,
  saveEntry,
  downloadNewsletterDoc,
} from '../../services/afterschoolSynopsisService';
import BlockFields from './BlockFields';
import AdminIntroView from './AdminIntroView';

const FONT = "'DM Sans', sans-serif";
const SERIF = "'DM Serif Display', serif";

// GET /classes/{grade_slug} is documented to key `entries` by activity type,
// but the plan's illustrative shape uses snake_case names (e.g.
// "after_school_class") while every other endpoint in this contract keys by
// the shared slugify() (hyphenated). Try both so this survives whichever the
// backend actually ships.
const lookupEntry = (entriesByType, type) => {
  const slug = slugify(type);
  return entriesByType?.[slug] ?? entriesByType?.[slug.replace(/-/g, '_')] ?? null;
};

// Mirrors the backend newsletter export (_add_afterschool_md_text): a line
// that is only a bold label (optionally emoji-led) is a section title, shown
// bold and larger than the body; other **bold** spans render inline.
const TITLE_LINE_RE = /^[^\p{L}\p{N}_*]*\*\*[^*]+\*\*\s*:?\s*$/u;

const renderInlineBold = (line) =>
  line.split('**').map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));

const FormattedText = ({ text }) => (
  <>
    {text.split('\n').map((line, i) =>
      TITLE_LINE_RE.test(line) ? (
        <div key={i} style={{ fontSize: 15, fontWeight: 700, color: '#1C1917', marginTop: 4 }}>
          {line.replace(/\*\*/g, '').trim()}
        </div>
      ) : (
        <div key={i}>{line ? renderInlineBold(line) : ' '}</div>
      )
    )}
  </>
);

// Sentinel value for the batch <select>'s "Intro paragraph" option — the
// month-level intro editor, not a grade.
const INTRO_OPTION = '__intro__';

// Same shape EntryFormView.jsx starts a teacher with — lets the admin fill in
// an entry the teacher hasn't submitted yet.
const blankBlock = () => ({ week: null, title: '', raw_text: '', photo_urls: [] });

export default function AdminClassView({ currentUser, monthId, monthLabel, month, onMonthPatched }) {
  const [grade, setGrade] = useState(GRADE_OPTIONS[0]);
  const [entriesByType, setEntriesByType] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState({});
  const [editing, setEditing] = useState(null); // { type, blockIndex } | null
  const [editDraft, setEditDraft] = useState(null);
  // Entry-level (not block-level) drive-link editing — kept separate from
  // editing/editDraft above since it's a different granularity (whole entry).
  const [editingDriveLinkType, setEditingDriveLinkType] = useState(null);
  const [driveLinkDraft, setDriveLinkDraft] = useState('');
  const [savingDriveLink, setSavingDriveLink] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const isIntro = grade === INTRO_OPTION;
  const gradeSlug = slugify(grade);
  const synopsisTypes = synopsisTypesForGrade(grade);

  const load = useCallback(async () => {
    if (!monthId || isIntro) return;
    setLoading(true);
    setError('');
    try {
      const res = await getClassStatus(currentUser, gradeSlug, monthId);
      setEntriesByType(res.entries || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser, gradeSlug, monthId, isIntro]);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (type) => setExpanded((prev) => ({ ...prev, [type]: !prev[type] }));

  const startEdit = (type, blockIndex, block) => {
    setEditing({ type, blockIndex });
    setEditDraft({ title: block.title || '', raw_text: block.raw_text || '', photo_urls: block.photo_urls || [] });
  };

  const cancelEdit = () => { setEditing(null); setEditDraft(null); };

  const saveEdit = async () => {
    if (!editing) return;
    const entry = lookupEntry(entriesByType, editing.type);
    const existingBlocks = entry?.blocks?.length ? entry.blocks : [blankBlock()];
    const nextBlocks = existingBlocks.map((b, i) => (i === editing.blockIndex ? { ...b, ...editDraft } : b));
    setSaving(true);
    try {
      await saveEntry({
        grade: entry?.grade || grade,
        synopsisType: editing.type,
        monthId,
        blocks: nextBlocks,
        driveLink: entry?.drive_link || '',
      });
      cancelEdit();
      await load();
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const startEditDriveLink = (type, currentValue) => {
    setEditingDriveLinkType(type);
    setDriveLinkDraft(currentValue || '');
  };

  const cancelEditDriveLink = () => { setEditingDriveLinkType(null); setDriveLinkDraft(''); };

  const saveDriveLink = async (type) => {
    const entry = lookupEntry(entriesByType, type);
    setSavingDriveLink(true);
    try {
      await saveEntry({
        grade: entry?.grade || grade,
        synopsisType: type,
        monthId,
        blocks: entry?.blocks || [],
        driveLink: driveLinkDraft,
      });
      cancelEditDriveLink();
      await load();
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSavingDriveLink(false);
    }
  };

  const driveLinkLabel = (type) => (type === SINGLE_BLOCK_TYPE ? 'Class Photos' : type);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await downloadNewsletterDoc(currentUser, gradeSlug, monthId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${gradeSlug}_newsletter_${monthId}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const fillStatus = (entry) => {
    if (!entry || !entry.blocks?.length) return { label: 'Nothing logged yet', color: '#8b7355', bg: '#F0EDE8' };
    const anyFilled = entry.blocks.some((b) => (b.raw_text || '').trim());
    return anyFilled
      ? { label: '✓ Filled', color: '#2d7a47', bg: '#d4f4dd' }
      : { label: 'Not filled', color: '#8b7355', bg: '#F0EDE8' };
  };

  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{ fontSize: 12, color: '#8b7355', marginBottom: 12 }}>
        Showing data for <strong>{monthLabel || monthId}</strong>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <select
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          style={{
            padding: '9px 14px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.9)',
            fontSize: 14, fontFamily: FONT, color: '#1e1e2e', background: 'rgba(255,255,255,0.85)',
            outline: 'none', cursor: 'pointer', minWidth: 220,
          }}
        >
          <option value={INTRO_OPTION}>✎ Intro paragraph for {monthLabel || monthId}</option>
          {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>

        <div style={{ flex: 1 }} />

        {!isIntro && (
        <button
          onClick={handleDownload}
          disabled={downloading}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 100, border: 'none', cursor: downloading ? 'not-allowed' : 'pointer',
            background: '#E8E0D5', color: '#5c4a32', fontSize: 13, fontWeight: 500, fontFamily: FONT,
            opacity: downloading ? 0.6 : 1,
          }}
        >
          <Download size={14} /> {downloading ? 'Downloading…' : 'Download newsletter'}
        </button>
        )}
      </div>

      {isIntro ? (
        <AdminIntroView
          currentUser={currentUser}
          month={month}
          monthLabel={monthLabel || monthId}
          onSaved={onMonthPatched}
        />
      ) : loading ? (
        <div style={{ fontSize: 13, color: '#8b7355', padding: '20px 0' }}>Loading…</div>
      ) : error ? (
        <div style={{ fontSize: 13, color: '#c0392b' }}>{error}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {synopsisTypes.map((type) => {
            const entry = lookupEntry(entriesByType, type);
            const status = fillStatus(entry);
            const isOpen = !!expanded[type];
            return (
              <div key={type} style={{
                background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.9)',
                borderRadius: 14, overflow: 'hidden',
              }}>
                <div
                  onClick={() => toggleExpand(type)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer' }}
                >
                  {isOpen ? <ChevronDown size={16} color="#8b7355" /> : <ChevronRight size={16} color="#8b7355" />}
                  <span style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: '#1C1917', flex: 1 }}>
                    {type}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 100, background: status.bg, color: status.color }}>
                    {status.label}
                  </span>
                </div>

                {isOpen && (
                  <div style={{ padding: '0 16px 16px' }}>
                    <div style={{ paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid #F0EDE8' }}>
                      {editingDriveLinkType === type ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            value={driveLinkDraft}
                            onChange={(e) => setDriveLinkDraft(e.target.value)}
                            placeholder="Paste a shareable Google Drive folder link"
                            style={{
                              flex: 1, minWidth: 220, padding: '8px 12px', borderRadius: 10,
                              border: '1.5px solid #E5E0D8', fontSize: 13,
                              fontFamily: FONT, color: '#1e1e2e', background: '#fff', outline: 'none',
                            }}
                          />
                          <button
                            onClick={() => saveDriveLink(type)}
                            disabled={savingDriveLink}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              padding: '8px 16px', borderRadius: 100, border: 'none',
                              background: savingDriveLink ? '#c8bfb5' : '#1C1917', color: '#FAF8F4',
                              cursor: savingDriveLink ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500, fontFamily: FONT,
                            }}
                          >
                            <Check size={12} /> {savingDriveLink ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEditDriveLink}
                            disabled={savingDriveLink}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              padding: '8px 16px', borderRadius: 100, border: '1px solid #E5E0D8',
                              background: 'transparent', color: '#6B6459',
                              cursor: savingDriveLink ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500, fontFamily: FONT,
                            }}
                          >
                            <X size={12} /> Cancel
                          </button>
                        </div>
                      ) : entry?.drive_link ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <a
                            href={entry.drive_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 13, color: '#3a6ea5', textDecoration: 'none' }}
                          >
                            🔗 Google Drive for {driveLinkLabel(type)}
                          </a>
                          <button
                            onClick={() => startEditDriveLink(type, entry.drive_link)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b7355', display: 'flex' }}
                            title="Edit Google Drive link"
                          >
                            <Pencil size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditDriveLink(type, '')}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#8b7355', fontSize: 13, fontFamily: FONT, padding: 0,
                          }}
                        >
                          + Add Google Drive link
                        </button>
                      )}
                    </div>

                    {(() => {
                      // Every entry has exactly one block now. If stale
                      // multi-block test data from before this change is
                      // still present, only render/edit the first one. If the
                      // teacher hasn't submitted anything, fall back to a
                      // blank block so the admin can still fill it in.
                      const hasBlock = !!entry?.blocks?.length;
                      const block = hasBlock ? entry.blocks[0] : blankBlock();
                      const idx = 0;
                      const isEditingThis = editing?.type === type && editing.blockIndex === idx;
                      return (
                        <div style={{ paddingTop: 0 }}>
                          {/* Read-only title preview only when NOT editing —
                              while editing, nothing sits above the Title
                              field (a pasted-in paragraph title used to show
                              here as uneditable text). Clamped so a long
                              title can't take over the row. */}
                          {!isEditingThis && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                              <div style={{
                                fontSize: 13, fontWeight: 600, color: '#1C1917',
                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                              }}>
                                {block.title || 'This month'}
                              </div>
                              <button
                                onClick={() => startEdit(type, idx, block)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b7355', display: 'flex', flexShrink: 0 }}
                                title="Edit"
                              >
                                <Pencil size={14} />
                              </button>
                            </div>
                          )}

                          {isEditingThis ? (
                            <>
                              <BlockFields
                                value={editDraft}
                                onChange={(field, val) => setEditDraft((prev) => ({ ...prev, [field]: val }))}
                                gradeSlug={gradeSlug}
                                typeSlug={slugify(type)}
                                monthId={monthId}
                                blockIndex={idx}
                              />
                              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                <button
                                  onClick={saveEdit}
                                  disabled={saving}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    padding: '8px 16px', borderRadius: 100, border: 'none',
                                    background: saving ? '#c8bfb5' : '#1C1917', color: '#FAF8F4',
                                    cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500, fontFamily: FONT,
                                  }}
                                >
                                  <Check size={12} /> {saving ? 'Saving…' : 'Save'}
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  disabled={saving}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    padding: '8px 16px', borderRadius: 100, border: '1px solid #E5E0D8',
                                    background: 'transparent', color: '#6B6459',
                                    cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500, fontFamily: FONT,
                                  }}
                                >
                                  <X size={12} /> Cancel
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              {!hasBlock && (
                                <div style={{ fontSize: 13, color: '#8b7355', padding: '4px 0' }}>
                                  Nothing submitted yet — use the pencil to add a title and description.
                                </div>
                              )}
                              {block.raw_text && (
                                <div style={{ fontSize: 13, color: '#3a352e', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 8 }}>
                                  <FormattedText text={block.raw_text} />
                                </div>
                              )}
                              {block.photo_urls?.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                  {block.photo_urls.map((url, i) => (
                                    <img key={i} src={url} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
