// frontend/src/components/synopsis/FoodMenuPage.jsx
import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import {
  SynopsisWeekFields,
  VALID_DAYS,
  DAY_LABELS,
  FoodFields,
} from '../../constants/synopsisSchema';
import {
  getFoodForWeek,
  saveFoodForWeek,
  parseFoodImage,
} from '../../services/synopsisService';

const FONT  = "'DM Sans', sans-serif";
const SERIF = "'DM Serif Display', serif";

const DAY_ORDINAL = { mon: 'Day 1', tue: 'Day 2', wed: 'Day 3', thu: 'Day 4', fri: 'Day 5' };
const BLANK_FOOD  = () => Object.fromEntries(
  VALID_DAYS.map(d => [d, { morning_snack: '', lunch: '', afternoon_snack: '' }])
);

export default function FoodMenuPage({ week, isAdmin, currentUser, onBack }) {
  const weekId    = week?.[SynopsisWeekFields.WEEK_ID];
  const weekLabel = week?.[SynopsisWeekFields.LABEL] || 'This Week';

  const [foodData, setFoodData] = useState(BLANK_FOOD);
  const [saving,   setSaving]   = useState(false);
  const [saveMsg,  setSaveMsg]  = useState('');
  const [parsing,  setParsing]  = useState(false);
  const fileRef                 = useRef(null);

  useEffect(() => {
    if (!weekId) return;
    getFoodForWeek(weekId).then(({ food }) => {
      if (!food) return;
      setFoodData(prev => {
        const next = { ...prev };
        for (const day of VALID_DAYS) {
          if (food[day]) next[day] = { morning_snack: '', lunch: '', afternoon_snack: '', ...food[day] };
        }
        return next;
      });
    }).catch(() => {});
  }, [weekId]);

  const setField = (day, field, val) =>
    setFoodData(prev => ({ ...prev, [day]: { ...prev[day], [field]: val } }));

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      await saveFoodForWeek(weekId, foodData);
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleParseImage = async (file) => {
    setParsing(true);
    try {
      const result = await parseFoodImage(currentUser, file);
      setFoodData(prev => {
        const next = { ...prev };
        for (const day of VALID_DAYS) {
          if (result[day]) next[day] = { ...next[day], ...result[day] };
        }
        return next;
      });
    } catch (err) {
      alert(`Could not read image: ${err.message}`);
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const fieldInput = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: '1.5px solid rgba(255,255,255,0.9)', fontSize: 14,
    fontFamily: FONT, color: '#1e1e2e',
    background: 'rgba(255,255,255,0.7)', outline: 'none', boxSizing: 'border-box',
  };

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

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 600, color: '#1C1917', margin: 0, marginBottom: 4 }}>
          🍽️ Food Menu
        </h1>
        <div style={{ fontSize: 14, color: '#8b7355' }}>{weekLabel}</div>
      </div>

      {/* Admin: autofill from image */}
      {isAdmin && (
        <div style={{
          background: 'rgba(247,228,160,0.3)', border: '1px solid rgba(247,228,160,0.7)',
          borderRadius: 12, padding: '16px 20px', marginBottom: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1917', marginBottom: 3 }}>
              Autofill from image
            </div>
            <div style={{ fontSize: 13, color: '#6B6459' }}>
              Upload a photo of the menu and we'll fill in the fields automatically.
            </div>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={parsing}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '10px 20px', borderRadius: 100, border: 'none',
              background: parsing ? '#c8bfb5' : '#1C1917', color: '#FAF8F4',
              cursor: parsing ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 500, fontFamily: FONT, whiteSpace: 'nowrap',
            }}
          >
            {parsing ? 'Scanning…' : '📷  Upload menu image'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => e.target.files[0] && handleParseImage(e.target.files[0])}
          />
        </div>
      )}

      {/* Read-only notice for teachers */}
      {!isAdmin && (
        <div style={{
          background: 'rgba(172,216,240,0.2)', border: '1px solid rgba(172,216,240,0.5)',
          borderRadius: 10, padding: '11px 16px', fontSize: 13, color: '#1e3a4a', marginBottom: 28,
        }}>
          The food menu is managed by the ICC team. Contact your admin to request changes.
        </div>
      )}

      {/* Per-day food */}
      {VALID_DAYS.map(day => (
        <div key={day} style={{ marginBottom: 32, paddingBottom: 32, borderBottom: '1px solid #F0EDE8' }}>
          <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: '#1C1917', marginBottom: 16 }}>
            {DAY_ORDINAL[day]} — {DAY_LABELS[day]}
          </div>

          {[
            [FoodFields.MORNING_SNACK,   '🍎 Morning Snack'],
            [FoodFields.LUNCH,           '🥗 Lunch'],
            [FoodFields.AFTERNOON_SNACK, '🍪 Afternoon Snack'],
          ].map(([field, label]) => (
            <div key={field} style={{ marginBottom: 14 }}>
              <label style={{
                display: 'block', fontSize: 11, fontWeight: 700, color: '#8b7355',
                textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6,
              }}>
                {label}
              </label>
              {isAdmin ? (
                <input
                  type="text"
                  value={foodData[day]?.[field] || ''}
                  onChange={e => setField(day, field, e.target.value)}
                  placeholder={field === 'lunch' ? 'e.g. Rice, dal, and roasted vegetables' : 'e.g. Fresh fruit and crackers'}
                  style={fieldInput}
                  onFocus={e => { e.target.style.borderColor = '#f6b26b'; e.target.style.boxShadow = '0 0 0 3px rgba(246,178,107,0.2)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.9)'; e.target.style.boxShadow = 'none'; }}
                />
              ) : (
                <div style={{
                  ...fieldInput,
                  background: 'rgba(255,255,255,0.5)',
                  color: foodData[day]?.[field] ? '#1e1e2e' : '#bbb',
                  cursor: 'default',
                }}>
                  {foodData[day]?.[field] || 'Not set yet'}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* Save bar — admin only */}
      {isAdmin && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 8 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 28px', borderRadius: 100,
              background: saving ? '#c8bfb5' : '#1C1917', color: '#FAF8F4',
              border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 500, fontFamily: FONT,
            }}
          >
            {saving ? 'Saving…' : 'Save food menu'}
          </button>
          {saveMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#2d7a47' }}>
              <Check size={13} /> {saveMsg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
