// frontend/src/components/afterschoolSynopsis/AdminIntroView.jsx
//
// Admin-only editor for the month's intro paragraph — shown when the admin
// picks "Intro paragraph" in AdminClassView's grade dropdown. Same title +
// description + Enhance with AI shape teachers get in EntryFormView.jsx (via
// BlockFields.jsx, photos hidden). Stored on the month doc (intro_title /
// intro_text) through PATCH /months/{id}, so one intro covers every grade's
// After School newsletter for that month (never the ECA newsletter).

import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { updateMonth, enhanceText } from '../../services/afterschoolSynopsisService';
import BlockFields from './BlockFields';

const FONT = "'DM Sans', sans-serif";
const SERIF = "'DM Serif Display', serif";

export default function AdminIntroView({ currentUser, month, monthLabel, onSaved }) {
  const [draft, setDraft] = useState({ title: '', raw_text: '' });
  const [status, setStatus] = useState('saved'); // 'draft' | 'saved' — UI-only
  const [saving, setSaving] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  useEffect(() => {
    setDraft({ title: month?.intro_title || '', raw_text: month?.intro_text || '' });
    setStatus('saved');
  }, [month?.month_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (field, val) => {
    setDraft((prev) => ({ ...prev, [field]: val }));
    setStatus('draft');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const patch = { intro_title: draft.title, intro_text: draft.raw_text };
      await updateMonth(currentUser, month.month_id, patch);
      setStatus('saved');
      onSaved?.(month.month_id, patch);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEnhance = async () => {
    if (!draft.raw_text.trim()) return;
    setEnhancing(true);
    try {
      const { enhanced_text } = await enhanceText(draft.raw_text);
      if (enhanced_text) update('raw_text', enhanced_text);
    } catch (err) {
      alert(`Enhance failed: ${err.message}`);
    } finally {
      setEnhancing(false);
    }
  };

  const hasContent = draft.title.trim() || draft.raw_text.trim();
  const enhanceDisabled = enhancing || !draft.raw_text.trim();

  return (
    <div style={{
      background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.9)',
      borderRadius: 14, padding: 16, fontFamily: FONT,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: '#1C1917' }}>
          Intro paragraph — {monthLabel}
        </div>
        {hasContent && (
          <span style={{
            fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 100,
            background: status === 'saved' ? '#d4f4dd' : '#F0EDE8',
            color: status === 'saved' ? '#2d7a47' : '#8b7355',
          }}>
            {status === 'saved' ? '✓ Saved' : 'Unsaved'}
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: '#8b7355', marginBottom: 12 }}>
        Appears at the top of every grade's After School newsletter for this month (not the ECA newsletter).
      </div>

      <BlockFields
        value={draft}
        onChange={update}
        showPhotos={false}
        titlePlaceholder="Intro title"
        descPlaceholder="Write this month's introduction…"
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 20px', borderRadius: 100,
            background: saving ? '#c8bfb5' : '#1C1917', color: '#FAF8F4',
            border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 500, fontFamily: FONT,
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>

        <button
          onClick={handleEnhance}
          disabled={enhanceDisabled}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', borderRadius: 100,
            background: enhanceDisabled ? 'rgba(0,0,0,0.05)' : 'rgba(246,178,107,0.18)',
            color: enhanceDisabled ? '#aaa' : '#7a4a00',
            border: '1.5px solid ' + (enhanceDisabled ? 'rgba(0,0,0,0.08)' : 'rgba(246,178,107,0.5)'),
            cursor: enhanceDisabled ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 500, fontFamily: FONT,
          }}
        >
          <Sparkles size={13} />
          {enhancing ? 'Enhancing…' : 'Enhance with AI'}
        </button>
      </div>
    </div>
  );
}
