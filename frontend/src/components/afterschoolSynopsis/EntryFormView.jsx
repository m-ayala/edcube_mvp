// frontend/src/components/afterschoolSynopsis/EntryFormView.jsx
//
// Every synopsis type (After School Class and all ECAs alike) has exactly one
// block (title/description/photos) per entry — no teacher-added "weeks". The
// single block has its own photo grid (BlockFields.jsx) + Enhance/Save/
// status-pill row, mirroring the camp feature's CampEntryView.jsx pattern.

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { slugify } from '../../constants/afterschoolSynopsisSchema';
import { getEntry, saveEntry, enhanceText } from '../../services/afterschoolSynopsisService';
import BlockFields from './BlockFields';

const FONT = "'DM Sans', sans-serif";
const SERIF = "'DM Serif Display', serif";

const blankBlock = (week) => ({ week, title: '', raw_text: '', photo_urls: [] });

export default function EntryFormView({ grade, synopsisType, monthId, monthLabel, onBack }) {
  const gradeSlug = slugify(grade);
  const typeSlug = slugify(synopsisType);

  const [blocks, setBlocks] = useState([blankBlock(null)]);
  const [status, setStatus] = useState({}); // { [index]: 'draft' | 'saved' } — UI-only, not persisted
  const [driveLink, setDriveLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingIdx, setSavingIdx] = useState(null);
  const [enhancingIdx, setEnhancingIdx] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getEntry(gradeSlug, typeSlug, monthId)
      .then(({ entry }) => {
        if (cancelled) return;
        if (entry?.blocks?.length) {
          // Only ever 0 or 1 block per entry now; if stale multi-block test
          // data exists from before this change, take just the first block.
          const b = entry.blocks[0];
          setBlocks([{
            week: b.week ?? null,
            title: b.title || '',
            raw_text: b.raw_text || '',
            photo_urls: b.photo_urls || [],
          }]);
          setStatus({ 0: 'saved' });
          setDriveLink(entry?.drive_link || '');
        } else {
          setBlocks([blankBlock(null)]);
          setStatus({});
          setDriveLink('');
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [gradeSlug, typeSlug, monthId]);

  const updateBlock = (idx, field, val) => {
    setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, [field]: val } : b)));
    setStatus((prev) => ({ ...prev, [idx]: 'draft' }));
  };

  const persist = useCallback((nextBlocks) => saveEntry({ grade, synopsisType, monthId, blocks: nextBlocks, driveLink }), [grade, synopsisType, monthId, driveLink]);

  const handleSaveBlock = async (idx) => {
    setSavingIdx(idx);
    try {
      await persist(blocks);
      setStatus((prev) => ({ ...prev, [idx]: 'saved' }));
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSavingIdx(null);
    }
  };

  const handleEnhanceBlock = async (idx) => {
    const text = blocks[idx].raw_text;
    if (!text.trim()) {
      alert('Write a description first before enhancing.');
      return;
    }
    setEnhancingIdx(idx);
    try {
      const { enhanced_text } = await enhanceText(text);
      if (enhanced_text) updateBlock(idx, 'raw_text', enhanced_text);
    } catch (err) {
      alert(`Enhance failed: ${err.message}`);
    } finally {
      setEnhancingIdx(null);
    }
  };

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: '#8b7355', fontFamily: FONT }}>Loading…</div>;
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '36px 28px', fontFamily: FONT }}>
      <button onClick={onBack} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 13, color: '#6B6459', padding: 0, marginBottom: 24,
      }}>
        <ArrowLeft size={15} /> Back
      </button>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 600, color: '#1C1917', margin: 0, marginBottom: 4 }}>
          {synopsisType}
        </h1>
        <div style={{ fontSize: 13, color: '#6B6459' }}>{grade} · {monthLabel}</div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#1C1917', marginBottom: 6 }}>
          Google Drive link (optional)
        </label>
        <input
          type="text"
          value={driveLink}
          onChange={(e) => setDriveLink(e.target.value)}
          placeholder="Paste a shareable Google Drive folder link for this month's photos"
          style={{
            width: '100%', padding: '11px 14px', borderRadius: 10,
            border: '1.5px solid #E5E0D8', fontSize: 14,
            fontFamily: FONT, color: '#1e1e2e',
            background: '#fff', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {blocks.map((block, idx) => {
        const st = status[idx] || 'draft';
        const hasContent = block.raw_text.trim() || block.title.trim();
        return (
          <div key={idx} style={{ marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid #F0EDE8' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: '#1C1917' }}>
                This month
              </div>
              {hasContent && (
                <span style={{
                  fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 100,
                  background: st === 'saved' ? '#d4f4dd' : '#F0EDE8',
                  color: st === 'saved' ? '#2d7a47' : '#8b7355',
                }}>
                  {st === 'saved' ? '✓ Saved' : 'Unsaved'}
                </span>
              )}
            </div>

            <BlockFields
              value={block}
              onChange={(field, val) => updateBlock(idx, field, val)}
              gradeSlug={gradeSlug}
              typeSlug={typeSlug}
              monthId={monthId}
              blockIndex={idx}
              titlePlaceholder="Title (optional)"
              descPlaceholder="What did your class do this month?"
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
              <button
                onClick={() => handleSaveBlock(idx)}
                disabled={savingIdx === idx}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 20px', borderRadius: 100,
                  background: savingIdx === idx ? '#c8bfb5' : '#1C1917', color: '#FAF8F4',
                  border: 'none', cursor: savingIdx === idx ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 500, fontFamily: FONT,
                }}
              >
                {savingIdx === idx ? 'Saving…' : 'Save'}
              </button>

              <button
                onClick={() => handleEnhanceBlock(idx)}
                disabled={enhancingIdx === idx || !block.raw_text.trim()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 18px', borderRadius: 100,
                  background: (enhancingIdx === idx || !block.raw_text.trim()) ? 'rgba(0,0,0,0.05)' : 'rgba(246,178,107,0.18)',
                  color: (enhancingIdx === idx || !block.raw_text.trim()) ? '#aaa' : '#7a4a00',
                  border: '1.5px solid ' + ((enhancingIdx === idx || !block.raw_text.trim()) ? 'rgba(0,0,0,0.08)' : 'rgba(246,178,107,0.5)'),
                  cursor: (enhancingIdx === idx || !block.raw_text.trim()) ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 500, fontFamily: FONT,
                }}
              >
                <Sparkles size={13} />
                {enhancingIdx === idx ? 'Enhancing…' : 'Enhance with AI'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
