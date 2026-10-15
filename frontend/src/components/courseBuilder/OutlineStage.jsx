// frontend/src/components/courseBuilder/OutlineStage.jsx
// Course Builder, Stage 1: choose one of three outlines, customise it with Edo, then
// move on to day planning. Layout and copy follow the approved mockup.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Send } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useGeneration } from '../../contexts/GenerationContext';
import { FONT, T, EDO_GREEN, EDO_ORANGE } from '../../constants/editorTheme';
import { editOutline, fetchObjectiveCategories } from '../../services/courseBuilderApi';
import { CHIP_COLORS } from './builderTheme';

const SR_ONLY = { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 };

const plural = (n, word) => `${n} ${word}${Number(n) === 1 ? '' : 's'}`;

const headerLine = (ctx) => {
  const a = ctx.age_range_start;
  const b = ctx.age_range_end;
  const ages = String(a) === String(b) ? `Age ${a}` : `Ages ${a}–${b}`;
  return [
    ages,
    plural(ctx.num_students, 'student'),
    plural(ctx.num_days, 'day'),
    `${ctx.hours_per_day} ${Number(ctx.hours_per_day) === 1 ? 'hour' : 'hours'} per day`,
  ].join(' · ');
};

// Which days (1-based numbers) touch a category, as readable text.
const daysText = (nums, total) => {
  if (nums.length === 0) return 'not covered yet';
  if (nums.length === total && total > 1) return 'every day';
  if (nums.length === 1) return `Day ${nums[0]} only`;
  const runs = [];
  let start = nums[0];
  let prev = nums[0];
  for (const n of nums.slice(1).concat([null])) {
    if (n === prev + 1) { prev = n; continue; }
    runs.push([start, prev]);
    start = n;
    prev = n;
  }
  const parts = runs.flatMap(([s, e]) => (e - s >= 2 ? [`${s}–${e}`] : e === s ? [`${s}`] : [`${s}`, `${e}`]));
  const joined = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return `Days ${joined}`;
};

const OutlineStageInner = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { genState, selectBuilderOutline, applyBuilderEdit, undoBuilderEdit, proceedToPlanning, backToBuilderOutline } = useGeneration();
  const builder = genState.builder;
  const ctx = builder.courseContext || {};

  // Returning from the Stage 2 hand-off with the browser back button: we are on the
  // outline again, so the state should say so (proceeding again is an explicit click).
  useEffect(() => {
    if (genState.status === 'builder-planning') backToBuilderOutline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  // Objective categories from the backend (never a local list).
  const [categories, setCategories] = useState(null);
  const [categoriesError, setCategoriesError] = useState(false);
  useEffect(() => {
    if (!currentUser) return undefined;
    let live = true;
    fetchObjectiveCategories(currentUser)
      .then((c) => { if (live) setCategories(c); })
      .catch(() => { if (live) setCategoriesError(true); });
    return () => { live = false; };
  }, [currentUser]);

  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [undoNote, setUndoNote] = useState('');
  const [srReply, setSrReply] = useState(''); // Edo's latest reply, read out by screen readers
  const inputRef = useRef(null);

  const chosen = builder.chosenOutline;
  const days = useMemo(() => chosen?.days || [], [chosen]);
  const base = builder.outlines.find((o) => o.id === builder.chosenOutlineId);
  const editTurns = builder.edits[builder.chosenOutlineId]?.turns;
  const turns = useMemo(() => editTurns || [], [editTurns]);
  const lastChangedTurn = (() => {
    for (let i = turns.length - 1; i >= 0; i--) if (turns[i].changedDayIds.length > 0) return i;
    return -1;
  })();
  const changedIds = useMemo(() => new Set(turns.flatMap((t) => t.changedDayIds)), [turns]);

  const coverage = useMemo(() => {
    const touched = (id) => days.map((d, i) => ((d.objective_ids || []).includes(id) ? i + 1 : null)).filter(Boolean);
    let list = categories;
    if (!list) {
      // Taxonomy unavailable: show the ids the outline itself uses, unlabelled.
      const ids = [...new Set(days.flatMap((d) => d.objective_ids || []))];
      list = ids.map((id) => ({ id, label: id, description: '' }));
    }
    return list.map((c, i) => ({ ...c, color: CHIP_COLORS[i % CHIP_COLORS.length], text: daysText(touched(c.id), days.length) }));
  }, [categories, days]);

  const pick = (id) => {
    if (busy || id === builder.chosenOutlineId) return;
    setError('');
    setUndoNote('');
    setSrReply('');
    setMessage('');
    selectBuilderOutline(id);
  };

  const send = async (e) => {
    e.preventDefault();
    const text = message.trim();
    if (!text || busy) return;
    setBusy(true);
    setError('');
    setUndoNote('');
    setSrReply('');
    const outlineId = builder.chosenOutlineId;
    const history = turns.flatMap((t) => [
      { role: 'user', content: t.userMessage.slice(0, 4000) },
      { role: 'assistant', content: t.reply.slice(0, 4000) },
    ]).slice(-20);
    try {
      const res = await editOutline({
        outline: builder.chosenOutline,
        message: text,
        course: {
          course_name: ctx.course_name,
          age_range_start: ctx.age_range_start,
          age_range_end: ctx.age_range_end,
          num_students: ctx.num_students,
          hours_per_day: ctx.hours_per_day,
          requirements: ctx.objectives || '',
        },
        conversationHistory: history,
      });
      if (!mounted.current) return;
      applyBuilderEdit(outlineId, {
        userMessage: text,
        reply: res.reply,
        outline: res.outline,
        changedDayIds: res.changed_day_ids,
      });
      setMessage('');
      setSrReply(`Edo replied: ${res.reply}`);
    } catch (err) {
      if (!mounted.current) return;
      // Nothing was changed; the outline and the typed message are kept.
      setError(`${err.message || 'Edo could not revise the outline.'} Your outline has not been changed. You can try again.`);
    } finally {
      if (mounted.current) {
        setBusy(false);
        // The Send button disables once the text clears, so put focus back in the box.
        inputRef.current?.focus();
      }
    }
  };

  const undo = () => {
    undoBuilderEdit();
    setSrReply('');
    setUndoNote('Change undone. The outline is back to how it was before.');
    // The Undo button unmounts; keep the teacher's place by focusing the message box.
    inputRef.current?.focus();
  };

  const next = () => {
    proceedToPlanning();
    navigate('/course-builder/plan');
  };

  return (
    <div style={{ fontFamily: FONT, color: T.heading, background: '#FFFFFF', minHeight: '100%', boxSizing: 'border-box', padding: '28px 16px 40px' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.crumbActive }}>Course Builder · Step 1 of 2</div>
          <h1 style={{ margin: 0, fontWeight: 600, fontSize: 28, lineHeight: 1.2, color: T.heading }}>{ctx.course_name || genState.formData?.courseName}</h1>
          <div style={{ fontSize: 15, fontWeight: 500, color: T.desc }}>{headerLine(ctx)}</div>
        </div>

        <section aria-labelledby="cb-choose" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 id="cb-choose" style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.cardTitle }}>Choose an outline to start from</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {builder.outlines.map((o, i) => {
              const selected = o.id === builder.chosenOutlineId;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => pick(o.id)}
                  aria-pressed={selected}
                  disabled={busy && !selected}
                  style={{
                    textAlign: 'left', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 44,
                    border: `2px solid ${selected ? T.crumbActive : T.cardBorder}`, background: selected ? '#f2f5ff' : '#FFFFFF',
                    fontFamily: FONT, cursor: busy && !selected ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ width: 30, height: 30, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, background: T.numBg, color: T.numFg, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontSize: 17, fontWeight: 700, color: T.cardTitle }}>{o.name}</span>
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.5, color: T.desc }}>{o.description}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.crumbActive }}>{selected ? 'Selected' : 'Select this outline'}</span>
                </button>
              );
            })}
          </div>
        </section>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {days.map((day, idx) => (
              <article key={day.id} style={{ background: '#FFFFFF', border: `1px solid ${T.rowBorder}`, borderRadius: 12, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.numFg, background: T.numBg, padding: '6px 10px', borderRadius: 8 }}>Day {idx + 1}</span>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.cardTitle, flex: '1 1 240px', minWidth: 0, overflowWrap: 'anywhere' }}>{day.title}</h3>
                  {changedIds.has(day.id) && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#8a5a00', background: T.iconDelBg, padding: '4px 9px', borderRadius: 6 }}>Changed by Edo</span>
                  )}
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 15, fontWeight: 500, lineHeight: 1.6, color: '#4a4a4a' }}>
                  {(day.bullets || []).map((b, bi) => <li key={bi} style={{ overflowWrap: 'anywhere' }}>{b}</li>)}
                </ul>
                <div style={{ fontSize: 13, fontWeight: 500, color: T.desc, borderTop: '1px solid #efefef', paddingTop: 10 }}>
                  <strong style={{ color: T.cardTitle }}>{idx === days.length - 1 ? 'Closes the thread:' : 'Leads to'}</strong> {day.leads_to}
                </div>
              </article>
            ))}

            <section aria-labelledby="cb-objectives" style={{ border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h2 id="cb-objectives" style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.cardTitle }}>Learning objectives across the course</h2>
              {!categories && !categoriesError && <div style={{ fontSize: 13, color: T.desc }}>Loading objective categories...</div>}
              {categoriesError && <div style={{ fontSize: 13, color: T.desc }}>The objective category names could not be loaded, so the raw category ids are shown.</div>}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, fontWeight: 600 }}>
                {coverage.map((c) => {
                  const none = c.text === 'not covered yet';
                  return (
                    <li
                      key={c.id}
                      title={c.description || undefined}
                      style={{ padding: '6px 10px', borderRadius: 6, background: none ? '#FFFFFF' : c.color.bg, color: none ? T.desc : c.color.fg, border: `1px ${none ? 'dashed' : 'solid'} ${none ? '#D1D5DB' : c.color.bd}`, overflowWrap: 'anywhere' }}
                    >
                      {c.label} · {c.text}
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <aside aria-labelledby="cb-edo" style={{ flex: '1 1 320px', minWidth: 0, background: '#FAFAF8', border: '1px solid #E7E5E4', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: EDO_ORANGE, color: '#FFFFFF', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div id="cb-edo" style={{ fontSize: 17, fontWeight: 700 }}>Edo</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Customize the outline you picked</div>
            </div>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14, lineHeight: 1.5 }}>
              <div style={{ background: '#FFFFFF', border: '1px solid #E7E5E4', color: '#1C1917', borderRadius: '14px 14px 14px 2px', padding: '8px 12px', alignSelf: 'flex-start', maxWidth: '92%' }}>
                You picked "{base?.name}". Tell me what to change and I will rework the days it touches.
              </div>

              {turns.map((t, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ background: EDO_GREEN, color: '#FFFFFF', borderRadius: '14px 14px 2px 14px', padding: '8px 12px', alignSelf: 'flex-end', maxWidth: '92%', overflowWrap: 'anywhere' }}>{t.userMessage}</div>
                  <div style={{ background: '#FFFBF2', border: '1.5px solid #F5C98A', color: '#1C1917', borderRadius: '14px 14px 14px 2px', padding: '10px 12px', alignSelf: 'flex-start', maxWidth: '92%', display: 'flex', flexDirection: 'column', gap: 8, overflowWrap: 'anywhere' }}>
                    <div>{t.reply}</div>
                    {i === lastChangedTurn && (
                      <button
                        type="button"
                        onClick={undo}
                        disabled={busy}
                        style={{ alignSelf: 'flex-start', background: '#FFFFFF', border: '1px solid #E7E5E4', color: '#1C1917', borderRadius: 6, padding: '10px 16px', fontFamily: FONT, fontSize: 14, fontWeight: 600, minHeight: 44, cursor: busy ? 'not-allowed' : 'pointer' }}
                      >
                        Undo this change
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {busy && <div style={{ color: T.desc, fontWeight: 500 }}>Edo is reworking the outline...</div>}
                {undoNote && !busy && <div style={{ color: T.desc, fontWeight: 500 }}>{undoNote}</div>}
              </div>
              <div aria-live="polite" style={SR_ONLY}>{srReply}</div>
              {error && (
                <div role="alert" style={{ background: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030', borderRadius: 8, padding: '10px 12px', fontWeight: 500 }}>
                  {error}
                </div>
              )}

              <form onSubmit={send} style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid #E7E5E4', paddingTop: 12 }}>
                <label htmlFor="edo-input" style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Message Edo</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    id="edo-input"
                    ref={inputRef}
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    readOnly={busy}
                    maxLength={2000}
                    placeholder="Ask Edo to change a day"
                    style={{ flex: 1, minWidth: 0, fontFamily: FONT, fontSize: 14, padding: 12, border: '1px solid #D1D5DB', borderRadius: 8, minHeight: 44, boxSizing: 'border-box', background: '#FFFFFF' }}
                  />
                  <button
                    type="submit"
                    disabled={busy || !message.trim()}
                    aria-label="Send to Edo"
                    style={{ width: 44, minHeight: 44, border: 'none', borderRadius: 8, background: EDO_GREEN, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: busy || !message.trim() ? 0.5 : 1, cursor: busy || !message.trim() ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                  >
                    <Send size={18} aria-hidden="true" />
                  </button>
                </div>
              </form>
            </div>
          </aside>
        </div>

        <div style={{ borderTop: '1px solid #efefef', paddingTop: 18, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: T.desc }}>Happy with the thread of the course? Move on to plan each day.</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 14, fontWeight: 600 }}>
            <span aria-current="step" style={{ background: T.numBg, color: T.numFg, padding: '12px 16px', borderRadius: 8 }}>1 · Outline</span>
            <button
              type="button"
              onClick={next}
              disabled={busy}
              style={{ background: T.primary, color: '#FFFFFF', border: 'none', padding: '12px 18px', borderRadius: 8, fontFamily: FONT, fontSize: 14, fontWeight: 600, minHeight: 44, opacity: busy ? 0.6 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}
            >
              2 · Plan each day
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// One-day courses have no Stage 1: go to the Stage 2 hand-off instead.
const OutlineStage = () => {
  const { genState } = useGeneration();
  if (!genState.builder?.requiresChoice) return <Navigate to="/course-builder/plan" replace />;
  return <OutlineStageInner />;
};

export default OutlineStage;
