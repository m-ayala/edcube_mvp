// frontend/src/components/synopsis/CampEntryView.jsx
import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, X, Check } from 'lucide-react';
import {
  SynopsisCampFields,
  SynopsisEntryFields,
  VALID_DAYS,
  DAY_LABELS,
  PHOTO_MIN,
  PHOTO_MAX,
} from '../../constants/synopsisSchema';
import { Sparkles } from 'lucide-react';
import {
  getEntriesForCamp,
  saveEntries,
  uploadPhoto,
  getFoodForWeek,
  saveFoodForWeek,
  enhanceText,
} from '../../services/synopsisService';

const FONT  = "'DM Sans', sans-serif";
const SERIF = "'DM Serif Display', serif";

const STATUS_BADGE = {
  polished: { bg: '#d4f4dd', color: '#2d7a47', label: '✓ Saved' },
  saved:    { bg: '#d4f4dd', color: '#2d7a47', label: '✓ Saved' },
  draft:    { bg: '#F0EDE8', color: '#8b7355', label: 'Unsaved' },
};

const DAY_ORDINAL = { mon: 'Day 1', tue: 'Day 2', wed: 'Day 3', thu: 'Day 4', fri: 'Day 5' };

const BLANK_FOOD_DAY = () => ({ morning_snack: '', lunch: '', afternoon_snack: '' });
const BLANK_FOOD     = () => Object.fromEntries(VALID_DAYS.map(d => [d, BLANK_FOOD_DAY()]));
const blankDay       = () => ({ day_title: '', raw_text: '', photo_urls: [], status: 'draft' });

export default function CampEntryView({ camp, onBack, isAdmin = false }) {
  const campId = camp[SynopsisCampFields.CAMP_ID];
  const weekId = camp[SynopsisCampFields.WEEK_ID];

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('days');

  // ── Days tab ──────────────────────────────────────────────────────────────
  const [dayData, setDayData]     = useState(() => Object.fromEntries(VALID_DAYS.map(d => [d, blankDay()])));
  const [uploading, setUploading]     = useState({});
  const [saving, setSaving]           = useState(false);
  const [saveMsg, setSaveMsg]         = useState('');
  const [autoSaved, setAutoSaved]     = useState(false);
  const [savingDay, setSavingDay]     = useState({});
  const [enhancingDay, setEnhancingDay] = useState({});
  const dayDataRef    = useRef(dayData);
  const dayAutoTimer  = useRef(null);
  const dirtyDays     = useRef(new Set());

  useEffect(() => { dayDataRef.current = dayData; }, [dayData]);

  // ── Food tab ──────────────────────────────────────────────────────────────
  const [foodData, setFoodData]       = useState(BLANK_FOOD);
  const [foodSaving, setFoodSaving]   = useState(false);
  const [foodSaveMsg, setFoodSaveMsg] = useState('');
  const [foodAutoSaved, setFoodAutoSaved] = useState(false);
  const foodDataRef      = useRef(foodData);
  const foodAutoTimer    = useRef(null);
  const foodUserEdited   = useRef(false);

  useEffect(() => { foodDataRef.current = foodData; }, [foodData]);

  // ── Load entries ──────────────────────────────────────────────────────────
  useEffect(() => {
    getEntriesForCamp(campId).then(({ entries = [] }) => {
      setDayData(prev => {
        const next = { ...prev };
        for (const e of entries) {
          const day = e[SynopsisEntryFields.DAY];
          if (VALID_DAYS.includes(day)) {
            next[day] = {
              day_title:  e[SynopsisEntryFields.DAY_TITLE]  || '',
              raw_text:   e[SynopsisEntryFields.RAW_TEXT]   || '',
              photo_urls: e[SynopsisEntryFields.PHOTO_URLS] || [],
              status:     e[SynopsisEntryFields.STATUS]     || 'draft',
            };
          }
        }
        return next;
      });
    }).catch(() => {});
  }, [campId]);

  // ── Load food ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!weekId) return;
    getFoodForWeek(weekId).then(({ food }) => {
      if (!food) return;
      setFoodData(prev => {
        const next = { ...prev };
        for (const day of VALID_DAYS) {
          if (food[day]) next[day] = { ...BLANK_FOOD_DAY(), ...food[day] };
        }
        return next;
      });
    }).catch(() => {});
  }, [weekId]);

  // ── Days: auto-save using effect ──────────────────────────────────────────
  useEffect(() => {
    const hasDirtyDraft = [...dirtyDays.current].some(d => dayData[d]?.status === 'draft');
    if (!hasDirtyDraft) return;
    clearTimeout(dayAutoTimer.current);
    dayAutoTimer.current = setTimeout(async () => {
      const current = dayDataRef.current;
      const toSend = VALID_DAYS
        .filter(d => dirtyDays.current.has(d) && current[d]?.status === 'draft')
        .map(d => ({ day: d, day_title: current[d].day_title, raw_text: current[d].raw_text, photo_urls: current[d].photo_urls }));
      if (!toSend.length) return;
      try {
        await saveEntries(campId, toSend);
        setDayData(prev => {
          const next = { ...prev };
          for (const d of VALID_DAYS) {
            if (dirtyDays.current.has(d) && prev[d].status === 'draft') {
              next[d] = { ...next[d], status: 'saved' };
            }
          }
          return next;
        });
        setAutoSaved(true);
        setTimeout(() => setAutoSaved(false), 3000);
      } catch { /* silent on auto-save fail */ }
    }, 3000);
    return () => clearTimeout(dayAutoTimer.current);
  }, [dayData, campId]);

  // ── Days: manual save ─────────────────────────────────────────────────────
  const handleSave = async () => {
    for (const day of VALID_DAYS) {
      const count = dayData[day].photo_urls.length;
      if (count > 0 && count < PHOTO_MIN) {
        alert(`${DAY_LABELS[day]}: add at least ${PHOTO_MIN} photos or remove the existing ones.`);
        return;
      }
    }
    const toSend = VALID_DAYS
      .filter(d => dirtyDays.current.has(d) && dayData[d].status === 'draft')
      .map(d => ({ day: d, day_title: dayData[d].day_title, raw_text: dayData[d].raw_text, photo_urls: dayData[d].photo_urls }));
    if (!toSend.length) {
      const hasAnyContent = VALID_DAYS.some(d => dayData[d].raw_text.trim() || dayData[d].photo_urls.length > 0);
      if (!hasAnyContent) alert('Write notes for at least one day before saving.');
      return;
    }

    clearTimeout(dayAutoTimer.current);
    setSaving(true);
    setSaveMsg('');
    setAutoSaved(false);
    try {
      await saveEntries(campId, toSend);
      setDayData(prev => {
        const next = { ...prev };
        for (const d of VALID_DAYS) {
          if (dirtyDays.current.has(d) && prev[d].status === 'draft') {
            next[d] = { ...next[d], status: 'saved' };
          }
        }
        return next;
      });
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Days: per-day save ────────────────────────────────────────────────────
  const handleSaveDay = async (day) => {
    const count = dayData[day].photo_urls.length;
    if (count > 0 && count < PHOTO_MIN) {
      alert(`${DAY_LABELS[day]}: add at least ${PHOTO_MIN} photos or remove the existing ones.`);
      return;
    }
    clearTimeout(dayAutoTimer.current);
    setSavingDay(prev => ({ ...prev, [day]: true }));
    try {
      await saveEntries(campId, [{
        day,
        day_title:  dayData[day].day_title,
        raw_text:   dayData[day].raw_text,
        photo_urls: dayData[day].photo_urls,
      }]);
      dirtyDays.current.delete(day);
      setDayData(prev => ({ ...prev, [day]: { ...prev[day], status: 'saved' } }));
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSavingDay(prev => ({ ...prev, [day]: false }));
    }
  };

  // ── Days: per-day AI enhance ──────────────────────────────────────────────
  const handleEnhanceDay = async (day) => {
    const text = dayData[day].raw_text;
    if (!text.trim()) {
      alert('Write a description first before enhancing.');
      return;
    }
    setEnhancingDay(prev => ({ ...prev, [day]: true }));
    try {
      const { enhanced_text } = await enhanceText(text);
      if (enhanced_text) {
        dirtyDays.current.add(day);
        setDayData(prev => ({
          ...prev,
          [day]: { ...prev[day], raw_text: enhanced_text, status: 'draft' },
        }));
      }
    } catch (err) {
      alert(`Enhance failed: ${err.message}`);
    } finally {
      setEnhancingDay(prev => ({ ...prev, [day]: false }));
    }
  };

  const setDayField = (day, field, val) => {
    dirtyDays.current.add(day);
    setDayData(prev => ({ ...prev, [day]: { ...prev[day], [field]: val, status: 'draft' } }));
  };

  // ── Photos ────────────────────────────────────────────────────────────────
  const handlePhotoAdd = async (day, files) => {
    const current = dayData[day].photo_urls.length;
    const toUpload = Array.from(files).slice(0, PHOTO_MAX - current);
    if (!toUpload.length) return;
    setUploading(prev => ({ ...prev, [day]: true }));
    const urls = [];
    for (const file of toUpload) {
      try {
        const { url } = await uploadPhoto(file, campId, day);
        urls.push(url);
      } catch (err) { alert(`Upload failed: ${err.message}`); }
    }
    if (urls.length) {
      dirtyDays.current.add(day);
      setDayData(prev => ({
        ...prev,
        [day]: { ...prev[day], photo_urls: [...prev[day].photo_urls, ...urls], status: 'draft' },
      }));
    }
    setUploading(prev => ({ ...prev, [day]: false }));
  };

  const removePhoto = (day, idx) => {
    dirtyDays.current.add(day);
    setDayData(prev => {
      const urls = [...prev[day].photo_urls];
      urls.splice(idx, 1);
      return { ...prev, [day]: { ...prev[day], photo_urls: urls, status: 'draft' } };
    });
  };

  // ── Food: auto-save using effect ──────────────────────────────────────────
  useEffect(() => {
    if (!weekId || !foodUserEdited.current) return;
    clearTimeout(foodAutoTimer.current);
    foodAutoTimer.current = setTimeout(async () => {
      try {
        await saveFoodForWeek(weekId, foodDataRef.current);
        setFoodAutoSaved(true);
        setTimeout(() => setFoodAutoSaved(false), 3000);
      } catch { /* silent */ }
    }, 3000);
    return () => clearTimeout(foodAutoTimer.current);
  }, [foodData, weekId]);

  // ── Food: manual save ─────────────────────────────────────────────────────
  const handleFoodSave = async () => {
    if (!weekId) return;
    clearTimeout(foodAutoTimer.current);
    setFoodSaving(true);
    setFoodSaveMsg('');
    setFoodAutoSaved(false);
    try {
      await saveFoodForWeek(weekId, foodData);
      setFoodSaveMsg('Food menu saved!');
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setFoodSaving(false);
    }
  };

  const setFoodField = (day, field, val) => {
    foodUserEdited.current = true;
    setFoodData(prev => ({ ...prev, [day]: { ...prev[day], [field]: val } }));
  };

  // ── Shared styles ─────────────────────────────────────────────────────────
  const campName = camp[SynopsisCampFields.CAMP_NAME];
  const campTime = [camp[SynopsisCampFields.TIME_START], camp[SynopsisCampFields.TIME_END]].filter(Boolean).join('–');
  const teacher  = camp[SynopsisCampFields.TEACHER_NAME];
  const fileRefs = useRef({});

  const tabBtn = (active) => ({
    padding: '9px 22px', borderRadius: 100, border: 'none', cursor: 'pointer',
    fontSize: 14, fontWeight: 500, fontFamily: FONT,
    background: active ? '#1C1917' : 'transparent',
    color: active ? '#FAF8F4' : '#8b7355',
    transition: 'background 0.15s, color 0.15s',
  });

  const fieldInput = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: '1.5px solid rgba(255,255,255,0.9)', fontSize: 14,
    fontFamily: FONT, color: '#1e1e2e',
    background: 'rgba(255,255,255,0.7)', outline: 'none', boxSizing: 'border-box',
  };

  const saveBarBtn = (busy) => ({
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '12px 28px', borderRadius: 100,
    background: busy ? '#c8bfb5' : '#1C1917', color: '#FAF8F4',
    border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
    fontSize: 14, fontWeight: 500, fontFamily: FONT,
  });

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '36px 28px', fontFamily: FONT }}>

      {/* Back */}
      <button onClick={onBack} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 13, color: '#6B6459', padding: 0, marginBottom: 24,
      }}>
        <ArrowLeft size={15} /> Back to all camps
      </button>

      {/* Camp identity */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 600, color: '#1C1917', margin: 0, marginBottom: 4 }}>
          {campName}
        </h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {campTime && (
            <span style={{ fontSize: 12, background: '#F5EFE6', color: '#8b7355', padding: '3px 10px', borderRadius: 100, fontWeight: 500 }}>
              {campTime}
            </span>
          )}
          {teacher && <span style={{ fontSize: 13, color: '#6B6459' }}>{teacher}</span>}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'inline-flex', gap: 4, padding: 4,
        background: 'rgba(0,0,0,0.05)', borderRadius: 100, marginBottom: 32,
      }}>
        <button style={tabBtn(activeTab === 'days')} onClick={() => setActiveTab('days')}>
          Camp Days
        </button>
        <button style={tabBtn(activeTab === 'food')} onClick={() => setActiveTab('food')}>
          Food
        </button>
      </div>

      {/* ═══════ DAYS TAB ═══════ */}
      {activeTab === 'days' && (
        <>
          {VALID_DAYS.map(day => {
            const data       = dayData[day];
            const badge      = STATUS_BADGE[data.status] || STATUS_BADGE.draft;
            const photoCount = data.photo_urls.length;

            return (
              <div key={day} style={{ marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid #F0EDE8' }}>

                {/* Day header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: '#1C1917' }}>
                    {DAY_ORDINAL[day]} — {DAY_LABELS[day]}
                  </div>
                  {(data.raw_text.trim() || data.day_title.trim()) && (
                    <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 100, background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                  )}
                </div>

                {/* Day title */}
                <input
                  type="text"
                  value={data.day_title}
                  onChange={e => setDayField(day, 'day_title', e.target.value)}
                  placeholder={`Title for ${DAY_LABELS[day]} (optional)`}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10, marginBottom: 10,
                    border: '1.5px solid rgba(255,255,255,0.9)', fontSize: 14,
                    fontFamily: FONT, color: '#1e1e2e', fontWeight: 500,
                    background: 'rgba(255,255,255,0.7)', outline: 'none', boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#ACD8F0'; e.target.style.boxShadow = '0 0 0 3px rgba(172,216,240,0.3)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.9)'; e.target.style.boxShadow = 'none'; }}
                />

                {/* Description */}
                <textarea
                  value={data.raw_text}
                  onChange={e => setDayField(day, 'raw_text', e.target.value)}
                  placeholder={`What did your camp do on ${DAY_LABELS[day]}?`}
                  rows={4}
                  style={{
                    width: '100%', padding: '14px 16px', borderRadius: 12,
                    border: '1.5px solid rgba(255,255,255,0.9)', fontSize: 15, lineHeight: 1.65,
                    fontFamily: FONT, color: '#1e1e2e',
                    resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.7)',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#ACD8F0'; e.target.style.boxShadow = '0 0 0 3px rgba(172,216,240,0.3)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.9)'; e.target.style.boxShadow = 'none'; }}
                />

                {/* Photos */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                    {data.photo_urls.map((url, i) => (
                      <div key={i} style={{ position: 'relative', width: 72, height: 72, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          onClick={() => removePhoto(day, i)}
                          style={{
                            position: 'absolute', top: 3, right: 3, background: 'rgba(0,0,0,0.55)',
                            border: 'none', borderRadius: '50%', width: 18, height: 18,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
                          }}
                        >
                          <X size={10} color="#fff" />
                        </button>
                      </div>
                    ))}

                    {photoCount < PHOTO_MAX && (
                      <button
                        onClick={() => fileRefs.current[day]?.click()}
                        disabled={uploading[day]}
                        style={{
                          width: 72, height: 72, borderRadius: 10,
                          border: '1.5px dashed #C8BFB5', background: '#FAF9F6',
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          justifyContent: 'center', cursor: uploading[day] ? 'wait' : 'pointer', flexShrink: 0,
                        }}
                      >
                        {uploading[day]
                          ? <span style={{ fontSize: 10, color: '#8b7355' }}>Uploading…</span>
                          : <Plus size={18} color="#8b7355" />}
                      </button>
                    )}

                    <input
                      ref={el => fileRefs.current[day] = el}
                      type="file" accept="image/*" multiple
                      style={{ display: 'none' }}
                      onChange={e => handlePhotoAdd(day, e.target.files)}
                    />
                  </div>

                  <div style={{ fontSize: 11, color: photoCount > 0 && photoCount < PHOTO_MIN ? '#c0392b' : '#8b7355' }}>
                    {photoCount} of {PHOTO_MAX} photos
                    {photoCount > 0 && photoCount < PHOTO_MIN && ` — minimum ${PHOTO_MIN} required`}
                  </div>
                </div>

                {/* Per-day action buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
                  <button
                    onClick={() => handleSaveDay(day)}
                    disabled={savingDay[day]}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '9px 20px', borderRadius: 100,
                      background: savingDay[day] ? '#c8bfb5' : '#1C1917', color: '#FAF8F4',
                      border: 'none', cursor: savingDay[day] ? 'not-allowed' : 'pointer',
                      fontSize: 13, fontWeight: 500, fontFamily: FONT,
                    }}
                  >
                    {savingDay[day] ? 'Saving…' : 'Save'}
                  </button>

                  <button
                    onClick={() => handleEnhanceDay(day)}
                    disabled={enhancingDay[day] || !data.raw_text.trim()}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '9px 18px', borderRadius: 100,
                      background: (enhancingDay[day] || !data.raw_text.trim()) ? 'rgba(0,0,0,0.05)' : 'rgba(246,178,107,0.18)',
                      color: (enhancingDay[day] || !data.raw_text.trim()) ? '#aaa' : '#7a4a00',
                      border: '1.5px solid ' + ((enhancingDay[day] || !data.raw_text.trim()) ? 'rgba(0,0,0,0.08)' : 'rgba(246,178,107,0.5)'),
                      cursor: (enhancingDay[day] || !data.raw_text.trim()) ? 'not-allowed' : 'pointer',
                      fontSize: 13, fontWeight: 500, fontFamily: FONT,
                    }}
                  >
                    <Sparkles size={13} />
                    {enhancingDay[day] ? 'Enhancing…' : 'Enhance with AI'}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Days save bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', paddingTop: 8 }}>
            <button onClick={handleSave} disabled={saving} style={saveBarBtn(saving)}>
              {saving ? 'Saving…' : 'Save'}
            </button>

            {(autoSaved || saveMsg) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#2d7a47' }}>
                <Check size={13} /> {saveMsg || 'Auto-saved'}
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════ FOOD TAB ═══════ */}
      {activeTab === 'food' && (
        <>
          <div style={{
            background: 'rgba(246,178,107,0.15)', border: '1px solid rgba(246,178,107,0.4)',
            borderRadius: 10, padding: '11px 16px', fontSize: 13, color: '#7a4a00', marginBottom: 28,
          }}>
            This food menu is shared across all camps for this week — fill it in once and it will appear in every synopsis document.
          </div>

          {VALID_DAYS.map(day => (
            <div key={day} style={{ marginBottom: 32, paddingBottom: 32, borderBottom: '1px solid #F0EDE8' }}>
              <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: '#1C1917', marginBottom: 16 }}>
                {DAY_ORDINAL[day]} — {DAY_LABELS[day]}
              </div>

              {[
                ['morning_snack',   'Morning Snack'],
                ['lunch',           'Lunch'],
                ['afternoon_snack', 'Afternoon Snack'],
              ].map(([field, label]) => (
                <div key={field} style={{ marginBottom: 14 }}>
                  <label style={{
                    display: 'block', fontSize: 11, fontWeight: 700, color: '#8b7355',
                    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6,
                  }}>
                    {label}
                  </label>
                  <input
                    type="text"
                    value={foodData[day]?.[field] || ''}
                    onChange={e => setFoodField(day, field, e.target.value)}
                    placeholder={field === 'lunch' ? 'e.g. Rice, dal, and roasted vegetables' : 'e.g. Fresh fruit and crackers'}
                    style={fieldInput}
                    onFocus={e => { e.target.style.borderColor = '#f6b26b'; e.target.style.boxShadow = '0 0 0 3px rgba(246,178,107,0.2)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.9)'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
              ))}
            </div>
          ))}

          {/* Food save bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', paddingTop: 8 }}>
            <button onClick={handleFoodSave} disabled={foodSaving} style={saveBarBtn(foodSaving)}>
              {foodSaving ? 'Saving…' : 'Save food menu'}
            </button>

            {foodAutoSaved && !foodSaveMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#2d7a47' }}>
                <Check size={13} /> Auto-saved
              </div>
            )}
            {foodSaveMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#2d7a47' }}>
                <Check size={14} /> {foodSaveMsg}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
