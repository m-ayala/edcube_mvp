// frontend/src/components/courseBuilder/PlanStage.jsx
// Course Builder, Stage 2 (route /course-builder/plan): plan each day hour by hour; an hour is a
// lesson of four 15-minute blocks.
// Layout and copy follow the approved mockup (Planner.dc.html). All plan data lives in
// GenerationContext (genState.builder.plan) so switching days, visiting the outline
// confirmation and a failed build never lose the teacher's arrangement.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useAuth } from '../../contexts/AuthContext';
import { useGeneration } from '../../contexts/GenerationContext';
import { FONT, T } from '../../constants/editorTheme';
import { addCourseToFolder } from '../../firebase/dbService';
import { useAiGate } from '../../contexts/usageContextCore';
import AiPausedHint from '../AiPausedHint';
import { fetchCourseDocument, fetchDayIdeas } from '../../services/courseBuilderApi';
import { navSectionsFromDoc } from '../../utils/builderCourse';
import { TOPIC_TINTS } from './builderTheme';
import { clockMin, displayTitle, hourCapacity, placeBlocker, blockerText, targetHourFor } from './dayPlan';
import {
  EMPTY, SR_ONLY, plural, joinList, buttonBase, secondaryBtn, metaStyle, dayTabStyle,
  useObjectiveCategories, useDayLook, coveredIds,
} from './dayLook';
import {
  BlockTag, CategoryChip, NeedsReviewBadge, ReviewNote, FitNote, TopicEmoji,
  TimelineRow, FreeRow, HourCard, TeachingTimePanel, MaterialsLine,
} from './dayView';
import Modal from './Modal';

// Teacher-facing notes for a day (the planner's technical `warnings` are never shown).
// Backend notices are computed at planning time, so the ones that describe the arrangement
// (day not full, library blocks needing review) are dropped once they stop being true (and the
// review count is recomputed here); the live equivalents are the time card and the review
// badges. Others stay as delivered.
const noticesOf = (day) => (Array.isArray(day?.notices) ? day.notices.filter((n) => {
  if (!n || typeof n.message !== 'string' || !n.message) return false;
  if (n.code === 'day_not_full') return (day.placed || []).length < day.slots;
  if (n.code === 'library_blocks_need_review') return (day.library || []).some((b) => b.needs_review);
  return true;
}).map((n) => {
  if (n.code !== 'library_blocks_need_review') return n;
  // The count is always the flagged blocks in this day's library right now, never the backend's.
  const k = (day.library || []).filter((b) => b.needs_review).length;
  return { ...n, message: `${k} ${k === 1 ? 'idea' : 'ideas'} in the library ${k === 1 ? 'needs' : 'need'} a review. Look for the "Needs review" badge before you use ${k === 1 ? 'it' : 'them'}.` };
}) : EMPTY);

const courseLine = (ctx) => {
  const a = ctx.age_range_start;
  const b = ctx.age_range_end;
  return [
    ctx.course_name,
    String(a) === String(b) ? `Age ${a}` : `Ages ${a}–${b}`,
    plural(ctx.num_students, 'student'),
    plural(ctx.num_days, 'day'),
    `${ctx.hours_per_day} ${Number(ctx.hours_per_day) === 1 ? 'hour' : 'hours'} per day`,
  ].filter(Boolean).join(' · ');
};

const dialogCancel = { padding: '12px 16px', background: '#f3f4f6', color: '#1f1f1f', border: 'none', borderRadius: 6, fontFamily: FONT, fontSize: 14, fontWeight: 600, minHeight: 44, cursor: 'pointer' };
const dialogDanger = { padding: '12px 16px', background: '#C81E1E', color: '#FFFFFF', border: 'none', borderRadius: 6, fontFamily: FONT, fontSize: 14, fontWeight: 600, minHeight: 44, cursor: 'pointer' };

const PlanStageInner = () => {
  const navigate = useNavigate();
  const { currentUser, org } = useAuth();
  const {
    genState, clearGeneration, backToBuilderOutline, startDayPlanning, planOneDay, movePlanBlock,
    resolveBlockReview, setDayPlanned, addDayIdeas, buildPlannedCourse,
  } = useGeneration();
  const builder = genState.builder;
  const ctx = builder.courseContext || {};
  const outlineDays = builder.chosenOutline.days;
  const plan = builder.plan;
  const build = builder.build;
  const multiDay = builder.requiresChoice;

  // Start planning once. The run lives in GenerationContext, so it keeps going while the
  // teacher moves between days or between the Course Builder pages. It does NOT survive
  // leaving the Course Builder: CourseBuilderShell clears the plan (and stops the stream) when
  // the teacher navigates outside /course-builder, and a browser refresh loses everything.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { startDayPlanning(); }, []);

  const [dayIndex, setDayIndex] = useState(0);
  const dayId = outlineDays[Math.min(dayIndex, outlineDays.length - 1)].id;
  const outlineDay = outlineDays.find((d) => d.id === dayId);
  const day = plan?.days[dayId];
  const ready = day?.status === 'ready';
  const placed = ready ? day.placed : EMPTY;
  const library = ready ? day.library : EMPTY;
  const slots = ready ? day.slots : 0;
  const blockMinutes = ready ? day.blockMinutes : 15;
  const hours = ready ? day.hours : EMPTY;
  const capacity = hourCapacity(blockMinutes);
  const full = ready && placed.length >= slots;

  const [announce, setAnnounce] = useState('');
  const [dragSource, setDragSource] = useState(null);
  const [reviewing, setReviewing] = useState(null); // { blockId, hourId, index }
  const lastPointer = useRef(null); // last pointer position during a drag (null for a keyboard drag)
  const dragKey = useRef(null); // keyboard drag: the last arrow key pressed and whether it moved the block
  const [blocked, setBlocked] = useState(''); // why the last move was refused (shown to the teacher)
  const [confirmBack, setConfirmBack] = useState(false);
  const [confirmBuild, setConfirmBuild] = useState(false);
  const genGate = useAiGate('generates');
  const [ideasBusy, setIdeasBusy] = useState(false);
  const [ideasError, setIdeasError] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const look = useDayLook({ topics: day?.topics, placed, library, blockMinutes, hours: ready ? hours : undefined });
  const { families, topicById, tintFor, emojiFor, metaFor, lit, hoverProps, setHoverFamily } = look;

  // Objective categories and vocabularies from the backend taxonomy; if that request fails,
  // only the ids the plan itself uses.
  const fallbackIds = useMemo(() => {
    const ids = new Set(outlineDays.flatMap((d) => d.objective_ids || []));
    Object.values(plan?.days || {}).forEach((d) => [...(d.placed || []), ...(d.library || [])].forEach((b) => b.objective_id && ids.add(b.objective_id)));
    return [...ids];
  }, [outlineDays, plan]);
  const { categories, catIndex, catFor, taxonomyError } = useObjectiveCategories(currentUser, fallbackIds);

  const covered = useMemo(() => coveredIds(placed), [placed]);
  const libraryObjectives = new Set(library.map((b) => b.objective_id));

  const used = placed.length * blockMinutes;
  const total = slots * blockMinutes;
  const free = total - used;

  // ── Block presentation ────────────────────────────────────────────────
  const renderTag = (b) => <BlockTag type={b.type} />;
  const renderCat = (b, small) => <CategoryChip cat={catFor(b.objective_id)} small={small} />;
  const renderReview = (b) => <ReviewNote block={b} />;
  const renderFit = (b) => <FitNote block={b} />;
  const renderEmoji = (b, size, font) => <TopicEmoji emoji={emojiFor(b)} tint={tintFor(b)} size={size} font={font} />;

  // ── Actions ───────────────────────────────────────────────────────────
  const blockById = (id) => placed.find((b) => b.id === id) || library.find((b) => b.id === id);

  const hourById = (id) => hours.find((h) => h.id === id);
  const refuse = (text) => { setBlocked(text); setAnnounce(text); };

  // Put a block into hour `hourId` at `index` (null = at the end). Honours the hard caps (an
  // hour holds 60 minutes, the day its teaching time) and the needs-review confirmation. The
  // plan state applies the same caps, so nothing here is the only guard.
  const placeInHour = (blockId, hourId, index = null) => {
    const b = blockById(blockId);
    const hour = hourById(hourId);
    if (!b || !hour || !ready) return;
    const why = placeBlocker(day, blockId, hourId);
    if (why) { refuse(blockerText(why, hour)); return; }
    setBlocked('');
    const inDay = placed.some((x) => x.id === blockId);
    if (!inDay && b.needs_review) { setReviewing({ blockId, hourId, index }); return; }
    movePlanBlock(dayId, blockId, hourId, index == null ? undefined : index);
    setAnnounce(`${inDay ? 'Moved' : 'Added'} ${displayTitle(b)} to Hour ${hour.number}.`);
  };
  // "Add to Hour N" on a library block: its home hour if it has room, else the first with room.
  const addFromLibrary = (blockId) => {
    const target = targetHourFor(day, blockById(blockId));
    if (!target) { refuse('Day is full. To add a block, remove one first.'); return; }
    placeInHour(blockId, target.id);
  };
  const confirmReview = (title) => {
    const { blockId, hourId, index } = reviewing;
    setReviewing(null);
    const b = blockById(blockId);
    resolveBlockReview(dayId, blockId, title);
    const why = placeBlocker(day, blockId, hourId);
    if (why) { refuse(blockerText(why, hourById(hourId))); return; }
    movePlanBlock(dayId, blockId, hourId, index == null ? undefined : index);
    setAnnounce(`Added ${title || b?.title} to Hour ${hourById(hourId)?.number}.`);
  };
  const removeFromDay = (blockId) => {
    const b = blockById(blockId);
    setBlocked('');
    movePlanBlock(dayId, blockId, null);
    if (b) setAnnounce(`Moved ${displayTitle(b)} back to the library.`);
  };

  // While a block is being dragged, remember where the pointer is and whether arrows were used.
  useEffect(() => {
    if (dragSource == null) return undefined;
    const move = (e) => { lastPointer.current = { x: e.clientX, y: e.clientY }; };
    const key = (e) => { if (e.key.startsWith('Arrow')) dragKey.current = { key: e.key, moved: false }; };
    window.addEventListener('pointermove', move);
    window.addEventListener('mousemove', move);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('keydown', key, true);
    };
  }, [dragSource]);

  const HOUR_PREFIX = 'hour:';
  // A hour that cannot take the dragged block is a disabled drop target, so a drag aimed at it
  // ends with no destination. Find the hour the pointer was last over (mouse) and say why it was
  // refused; with the keyboard, the hour lying in the direction of the last arrow press.
  const refusedDragNote = (blockId, from) => {
    const refusing = hours.filter((h) => `${HOUR_PREFIX}${h.id}` !== from && placeBlocker(day, blockId, h.id));
    if (!refusing.length) return;
    let hour = null;
    const pt = lastPointer.current;
    if (pt) {
      const el = document.elementFromPoint(pt.x, pt.y)?.closest?.('[data-testid^="hour-"]');
      hour = el && refusing.find((h) => el.getAttribute('data-testid') === `hour-${h.number}`);
    } else if (dragKey.current && !dragKey.current.moved) {
      // The last arrow press went nowhere. If an hour that refuses the block lies in that
      // direction from the block, that is the hour the teacher aimed at.
      const me = document.querySelector(`[data-rfd-draggable-id="${blockId}"]`)?.getBoundingClientRect();
      const dir = dragKey.current.key;
      if (me) {
        const cands = refusing.map((h) => {
          const r = document.querySelector(`[data-testid="hour-${h.number}"]`)?.getBoundingClientRect();
          if (!r) return null;
          const gap = dir === 'ArrowDown' ? r.top - me.bottom : dir === 'ArrowUp' ? me.top - r.bottom : dir === 'ArrowRight' ? r.left - me.right : dir === 'ArrowLeft' ? me.left - r.right : -1;
          return gap >= -2 ? { h, gap } : null;
        }).filter(Boolean).sort((a, b) => a.gap - b.gap);
        hour = cands[0]?.h || null;
      }
    }
    if (!hour) return;
    refuse(blockerText(placeBlocker(day, blockId, hour.id), hour));
  };
  const onDragStart = (s) => {
    lastPointer.current = null;
    dragKey.current = null;
    setDragSource(s.source.droppableId);
  };
  const onDragUpdate = () => { if (dragKey.current) dragKey.current.moved = true; };
  const onDragEnd = (result) => {
    setDragSource(null);
    setHoverFamily(null);
    const { source, destination, draggableId } = result;
    if (!destination) {
      if (result.reason === 'DROP' && ready) refusedDragNote(draggableId, source.droppableId);
      return;
    }
    const toHour = destination.droppableId.startsWith(HOUR_PREFIX) ? destination.droppableId.slice(HOUR_PREFIX.length) : null;
    if (toHour == null) {
      if (source.droppableId === 'library') {
        if (source.index !== destination.index) movePlanBlock(dayId, draggableId, null, destination.index);
      } else removeFromDay(draggableId);
      return;
    }
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      if (result.reason === 'DROP' && ready) refusedDragNote(draggableId, source.droppableId);
      return;
    }
    placeInHour(draggableId, toHour, destination.index);
  };

  const earlierTitles = () => {
    const idx = outlineDays.findIndex((d) => d.id === dayId);
    // Only topics with a block placed in the earlier day were taught there.
    return outlineDays.slice(0, idx).flatMap((d) => {
      const st = plan.days[d.id];
      const used = new Set((st?.placed || []).map((x) => x.topic_id));
      return (st?.topics || []).filter((t) => used.has(t.id)).map((t) => t.title);
    });
  };
  const moreIdeas = async () => {
    if (ideasBusy || !ready || genGate.blocked) return;
    setIdeasBusy(true);
    setIdeasError('');
    const forDay = dayId;
    const all = [...placed, ...library];
    try {
      const res = await fetchDayIdeas({
        courseContext: builder.courseContext,
        outline: builder.chosenOutline,
        dayId: forDay,
        earlierTopics: earlierTitles(),
        currentTopics: day.topics.slice(0, 12).map((t) => ({
          id: t.id, title: t.title, icon: t.icon, priority: t.priority,
          blocks: all.filter((b) => b.topic_id === t.id),
        })),
        count: 6,
      });
      if (!mounted.current) return;
      addDayIdeas(forDay, res);
      setAnnounce(res.blocks.length ? `Added ${plural(res.blocks.length, 'idea')} to the library.` : 'No new ideas came back.');
      if (!res.blocks.length) setIdeasError('No new ideas came back. Try again for a different set.');
    } catch (err) {
      if (mounted.current) setIdeasError(`${err.message || 'Could not come up with more ideas.'} Your day has not been changed.`);
    } finally {
      if (mounted.current) setIdeasBusy(false);
    }
  };

  const goToDay = (i) => { setDayIndex(i); setHoverFamily(null); setIdeasError(''); setBlocked(''); };
  const isLast = dayIndex === outlineDays.length - 1;
  const markPlanned = () => {
    setDayPlanned(dayId, true);
    if (!isLast) goToDay(dayIndex + 1);
    else setAnnounce(`Day ${dayIndex + 1} marked planned.`);
  };

  // ── Back to outline ───────────────────────────────────────────────────
  const discardAndGoBack = () => {
    setConfirmBack(false);
    if (multiDay) {
      backToBuilderOutline();
      navigate('/course-builder/outline');
    } else {
      clearGeneration();
      navigate('/course-designer');
    }
  };

  // ── Build ─────────────────────────────────────────────────────────────
  const dayList = outlineDays.map((d, i) => ({ id: d.id, n: i + 1, title: d.title, state: plan?.days[d.id] }));
  const notMarked = dayList.filter((d) => d.state?.status === 'ready' && !d.state.planned && d.state.placed.length > 0);
  const emptyDays = dayList.filter((d) => d.state?.status !== 'ready' || d.state.placed.length === 0);
  const emptyHours = dayList.flatMap((d) => (d.state?.status === 'ready' && d.state.placed.length > 0 && !d.state.hoursSynthetic
    ? d.state.hours.filter((h) => h.block_ids.length === 0).map((h) => ({ n: d.n, hour: h.number })) : []));
  const planning = !!plan?.running || dayList.some((d) => d.state && (d.state.status === 'planning' || d.state.status === 'pending'));
  const building = build?.phase === 'building';
  const startBuild = () => { setConfirmBuild(false); buildPlannedCourse(); };
  const clickBuild = () => {
    if (notMarked.length || emptyDays.length || emptyHours.length) setConfirmBuild(true);
    else startBuild();
  };

  const dayNumberOf = (id) => outlineDays.findIndex((d) => d.id === id) + 1;
  const problems = build?.phase === 'failed' ? build.problems || [] : EMPTY;
  const problemDays = new Set(problems.map((p) => p.day_id));
  // An hour the server refused (422 hour_over_capacity), in plain words, against the right hour.
  // The server may name the hour by id (hour_id / hour) or by number (hour_number).
  const problemHour = (p) => {
    const d = plan?.days[p.day_id];
    const key = p.hour_id ?? p.hour;
    return (d?.hours || []).find((h) => h.id === key || (p.hour_number != null && h.number === Number(p.hour_number)));
  };
  const problemText = (p) => {
    if (p.code === 'hour_missing') return p.message || 'This day is missing one of its hours. Go back to the plan for this day and try building again.';
    if (p.code !== 'hour_over_capacity') return p.message;
    const h = problemHour(p);
    if (!h) return p.message || 'An hour holds more than 60 minutes of blocks. Move a block to an hour that has room.';
    return `Hour ${h.number} (${h.title}) holds more than 60 minutes of blocks. Move a block to an hour that has room.`;
  };
  const hourProblems = {};
  problems.forEach((p) => {
    const h = p.day_id === dayId && p.code === 'hour_over_capacity' ? problemHour(p) : null;
    if (h) hourProblems[h.id] = problemText(p);
  });

  // On success, open the saved course in the workspace. The course is read back from the
  // backend (what build-course saved) and turned into the workspace's state by the same code
  // that "My courses" uses to reopen it, so a freshly built course and a reopened one are the
  // same thing and nothing the build saved is lost on the way.
  const landed = useRef(false);
  const [openState, setOpenState] = useState({ phase: 'idle', error: '' });
  const landInWorkspace = async () => {
    if (landed.current) return;
    landed.current = true;
    setOpenState({ phase: 'opening', error: '' });
    try {
      const doc = await fetchCourseDocument(build.curriculumId, currentUser.uid);
      const sections = navSectionsFromDoc(doc);
      if (!sections) throw new Error('The saved course could not be read.');
      if (genState.targetFolderId && build.curriculumId) {
        addCourseToFolder(currentUser.uid, org, genState.targetFolderId, build.curriculumId).catch(() => {});
      }
      navigate('/course-workspace', {
        state: {
          formData: { ...genState.formData, subject: builder.subject, topic: builder.topic, numDays: doc.numDays, hoursPerDay: doc.hoursPerDay },
          sections,
          curriculumId: build.curriculumId,
          isPublic: !!doc.isPublic,
          isEditing: true,
          targetFolderId: genState.targetFolderId,
          isOwner: true,
        },
      });
    } catch (err) {
      landed.current = false;
      setOpenState({ phase: 'error', error: err.message || 'The course could not be opened.' });
    }
  };
  const buildPhase = build?.phase;
  const buildNoteCount = build?.notes?.length || 0;
  useEffect(() => {
    if (buildPhase === 'done' && buildNoteCount === 0) landInWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildPhase, buildNoteCount]);

  // ── Tabs ──────────────────────────────────────────────────────────────
  const tabStyle = (d, i) => dayTabStyle({
    active: i === dayIndex,
    planned: d.state?.planned,
    bad: problemDays.has(d.id) || d.state?.status === 'failed',
  });
  const tabLabel = (d) => {
    const s = d.state;
    if (problemDays.has(d.id)) return `Day ${d.n} · needs attention`;
    if (!s || s.status === 'pending') return `Day ${d.n} · waiting`;
    if (s.status === 'planning') return `Day ${d.n} · planning...`;
    if (s.status === 'failed') return `Day ${d.n} · could not plan`;
    return `Day ${d.n}${s.planned ? ' · planned' : ''}`;
  };

  return (
    <div style={{ fontFamily: FONT, color: T.heading, background: '#FFFFFF', minHeight: '100%', boxSizing: 'border-box', padding: '28px 16px 40px' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.crumbActive }}>Course Builder · Step 2 of 2</div>
            <h1 style={{ margin: 0, fontWeight: 600, fontSize: 28, lineHeight: 1.2, color: T.heading, overflowWrap: 'anywhere' }}>Day {dayIndex + 1} · {outlineDay.title}</h1>
            <div style={{ fontSize: 15, fontWeight: 500, color: T.desc }}>{courseLine(ctx)}</div>
          </div>
          <button type="button" onClick={() => setConfirmBack(true)} disabled={building} style={{ ...secondaryBtn, fontSize: 14, padding: '12px 16px' }}>
            {multiDay ? 'Back to outline' : 'Back to course details'}
          </button>
        </div>

        <div role="group" aria-label="Days" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {dayList.map((d, i) => (
            <button key={d.id} type="button" onClick={() => goToDay(i)} aria-pressed={i === dayIndex} style={tabStyle(d, i)}>{tabLabel(d)}</button>
          ))}
        </div>

        {!ready && (
          <div role={day?.status === 'failed' ? 'alert' : 'status'} style={{ border: `1px solid ${day?.status === 'failed' ? '#feb2b2' : T.cardBorder}`, background: day?.status === 'failed' ? '#fff5f5' : '#FAFAF8', borderRadius: 12, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
            {day?.status === 'failed' ? (
              <>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#c53030' }}>Day {dayIndex + 1} could not be planned</div>
                <div style={{ fontSize: 14, color: '#4a4a4a', lineHeight: 1.5 }}>{day.error || 'Something went wrong while planning this day.'} The other days are not affected.</div>
                <button type="button" onClick={() => planOneDay(dayId)} disabled={genGate.blocked} title={genGate.blocked ? genGate.message : undefined} style={{ ...buttonBase, fontSize: 14, padding: '12px 18px', border: 'none', background: T.primary, color: '#FFFFFF' }}>Try planning Day {dayIndex + 1} again</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 17, fontWeight: 700, color: T.cardTitle }}>
                  {day?.status === 'planning' ? `Planning Day ${dayIndex + 1}...` : `Day ${dayIndex + 1} is waiting its turn`}
                </div>
                <div style={{ fontSize: 14, color: T.desc, lineHeight: 1.5 }}>
                  Days are planned in order so each one builds on the day before. This takes a few seconds per day. You can look at the days that are ready while you wait.
                </div>
              </>
            )}
          </div>
        )}

        {ready && (
          <>
            {noticesOf(day).length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, fontWeight: 500, color: T.desc, lineHeight: 1.5 }}>
                {noticesOf(day).map((n, i) => <li key={`${n.code || 'n'}-${i}`}>{n.message}</li>)}
              </ul>
            )}

            <TeachingTimePanel
              used={used} total={total} full={full} free={free}
              categories={categories} catIndex={catIndex} covered={covered}
              taxonomyError={taxonomyError} libraryObjectives={libraryObjectives}
            />

            <DragDropContext onBeforeDragStart={onDragStart} onDragUpdate={onDragUpdate} onDragEnd={onDragEnd}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
                {/* Library */}
                <section aria-labelledby="pl-lib" style={{ flex: '1 1 300px', minWidth: 0, background: '#FAFAF8', border: '1px solid #E7E5E4', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <h2 id="pl-lib" style={{ margin: 0, fontSize: 17, fontWeight: 700, color: T.cardTitle }}>Library for Day {dayIndex + 1}</h2>
                    <div style={{ fontSize: 13, fontWeight: 500, color: T.desc }}>
                      {full ? 'This day is full. Remove a block from the day before adding another.' : 'Drag a block into any hour, or drag one back here.'}
                    </div>
                  </div>
                  <Droppable droppableId="library">
                    {(prov, snap) => (
                      <div ref={prov.innerRef} {...prov.droppableProps} style={{ minHeight: 60, borderRadius: 12, outline: snap.isDraggingOver ? `2px dashed ${T.crumbActive}` : 'none', outlineOffset: 2 }}>
                        {library.map((b, i) => {
                          const target = targetHourFor(day, b);
                          return (
                          <Draggable key={b.id} draggableId={b.id} index={i}>
                            {(p, s) => (
                              <div
                                ref={p.innerRef}
                                {...p.draggableProps}
                                {...hoverProps(b)}
                                style={{ ...p.draggableProps.style, marginBottom: 12, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, boxSizing: 'border-box', border: `1.5px solid ${lit(b) ? T.crumbActive : b.needs_review ? '#F5C98A' : T.cardBorder}`, background: lit(b) ? '#f2f5ff' : '#FFFFFF', boxShadow: s.isDragging ? '0 10px 26px rgba(0,0,0,0.14)' : 'none' }}
                              >
                                <div {...p.dragHandleProps} style={{ display: 'flex', flexDirection: 'column', gap: 8, cursor: 'grab', borderRadius: 8 }}>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                    {renderEmoji(b, 26, 15)}
                                    {renderTag(b)}
                                    <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 6, background: '#efefef', color: '#5f5f5f' }}>{blockMinutes} min</span>
                                    {b.needs_review && <NeedsReviewBadge />}
                                  </div>
                                  <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3, color: T.cardTitle, overflowWrap: 'anywhere' }}>{displayTitle(b)}</div>
                                  <div style={metaStyle}>{metaFor(b)}</div>
                                  {renderReview(b)}
                                  {renderFit(b)}
                                  {renderCat(b)}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => addFromLibrary(b.id)}
                                  disabled={!target}
                                  aria-label={!target ? `Day is full, cannot add ${displayTitle(b)}` : `Add ${displayTitle(b)} to Hour ${target.number}`}
                                  style={{ ...buttonBase, alignSelf: 'flex-start', padding: '10px 14px', fontSize: 13, cursor: !target ? 'not-allowed' : 'pointer', border: `1px solid ${!target ? T.cardBorder : T.rowBorder}`, background: !target ? '#f1f1f1' : '#FFFFFF', color: !target ? '#5f5f5f' : T.crumbActive }}
                                >
                                  {!target ? 'Day is full' : `Add to Hour ${target.number}`}
                                </button>
                              </div>
                            )}
                          </Draggable>
                          );
                        })}
                        {prov.placeholder}
                        {library.length === 0 && (
                          <div style={{ fontSize: 14, fontWeight: 500, color: T.desc, border: `1.5px dashed ${T.dashed}`, borderRadius: 12, padding: 16 }}>Every suggested block is in the day.</div>
                        )}
                      </div>
                    )}
                  </Droppable>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                    <button type="button" onClick={moreIdeas} disabled={ideasBusy || genGate.blocked} title={genGate.blocked ? genGate.message : undefined} style={{ ...buttonBase, fontSize: 13, padding: '10px 14px', border: `1px solid ${T.rowBorder}`, background: '#FFFFFF', color: T.crumbActive, cursor: ideasBusy ? 'wait' : 'pointer', opacity: ideasBusy ? 0.7 : 1 }}>
                      {ideasBusy ? 'Thinking of more ideas...' : 'More ideas'}
                    </button>
                    <AiPausedHint kind="generates" />
                    {ideasError && <div role="alert" style={{ fontSize: 13, fontWeight: 500, color: '#c53030', lineHeight: 1.5 }}>{ideasError}</div>}
                  </div>
                </section>

                {/* Timeline */}
                <section aria-labelledby="pl-tl" style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 12 }}>
                    <h2 id="pl-tl" style={{ margin: 0, fontSize: 17, fontWeight: 700, color: T.cardTitle }}>Day {dayIndex + 1}, hour by hour</h2>
                    <div style={{ fontSize: 13, fontWeight: 500, color: T.desc, lineHeight: 1.5 }}>
                      Each hour is one lesson of {capacity === 4 ? 'four' : capacity} {blockMinutes}-minute blocks. Move blocks between hours; an hour never holds more than 60 minutes. Point at a block to see what it goes with. With the keyboard, focus a block, press space, use the arrow keys to move it within an hour or to and from the library, then press space again. To send a placed block to a different hour, use its "Move to" menu.
                    </div>
                    {blocked && <div role="status" data-testid="move-note" style={{ fontSize: 13, fontWeight: 600, color: '#ad004b', lineHeight: 1.5 }}>{blocked}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {hours.map((h, k) => {
                      const hourBlocks = h.block_ids.map((id) => placed.find((x) => x.id === id)).filter(Boolean);
                      const isFull = hourBlocks.length >= capacity;
                      const dropOff = (dragSource != null && dragSource !== `hour:${h.id}`) && (isFull || (dragSource === 'library' && full));
                      const problem = hourProblems[h.id];
                      return (
                        <HourCard key={h.id} hour={h} tint={TOPIC_TINTS[k % TOPIC_TINTS.length]} blocks={hourBlocks.length} blockMinutes={blockMinutes} capacity={capacity} problem={problem}>
                          <Droppable droppableId={`hour:${h.id}`} isDropDisabled={dropOff}>
                            {(prov, snap) => (
                              <div ref={prov.innerRef} {...prov.droppableProps} style={{ borderRadius: 12, outline: snap.isDraggingOver ? `2px dashed ${T.crumbActive}` : 'none', outlineOffset: 4 }}>
                                {hourBlocks.map((b, i) => {
                                  const next = hourBlocks[i + 1];
                                  const join = next && families[next.id] === families[b.id];
                                  const tint = tintFor(b);
                                  const lesson = b.topic_id && b.topic_id !== h.id ? topicById[b.topic_id]?.title || '' : '';
                                  return (
                                    <Draggable key={b.id} draggableId={b.id} index={i}>
                                      {(p, s) => (
                                        <TimelineRow
                                          rowRef={p.innerRef}
                                          rowProps={{ ...p.draggableProps, ...hoverProps(b) }}
                                          style={p.draggableProps.style}
                                          clockText={clockMin(h.start_minute + i * blockMinutes)}
                                          emoji={emojiFor(b)}
                                          tint={tint}
                                          join={join}
                                          dragging={s.isDragging}
                                          lit={lit(b)}
                                          needsReview={b.needs_review}
                                        >
                                          <div {...p.dragHandleProps} style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5, cursor: 'grab', borderRadius: 8 }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 8px', alignItems: 'center' }}>
                                              {renderTag(b)}
                                              <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3, color: T.cardTitle, overflowWrap: 'anywhere' }}>{displayTitle(b)}</span>
                                              {b.needs_review && <NeedsReviewBadge />}
                                            </div>
                                            <div style={metaStyle}>{metaFor(b, [], lesson)}</div>
                                            {renderReview(b)}
                                            {renderFit(b)}
                                            {renderCat(b, true)}
                                          </div>
                                          {hours.length > 1 && (
                                            <select
                                              aria-label={`Move ${displayTitle(b)} to another hour`}
                                              value=""
                                              onChange={(e) => { if (e.target.value) placeInHour(b.id, e.target.value); }}
                                              style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, minHeight: 44, padding: '0 8px', borderRadius: 8, border: `1px solid ${T.rowBorder}`, background: '#FFFFFF', color: T.crumbActive, cursor: 'pointer' }}
                                            >
                                              <option value="">Move to...</option>
                                              {hours.filter((o) => o.id !== h.id).map((o) => {
                                                const oFull = o.block_ids.length >= capacity;
                                                return <option key={o.id} value={o.id} disabled={oFull}>{`Hour ${o.number}${oFull ? ' (full)' : ''}`}</option>;
                                              })}
                                            </select>
                                          )}
                                          <button type="button" onClick={() => removeFromDay(b.id)} aria-label={`Move ${displayTitle(b)} back to the library`} style={{ ...buttonBase, background: T.iconDelBg, border: 'none', color: '#8a5a00', padding: '10px 12px', fontSize: 13 }}>Remove</button>
                                        </TimelineRow>
                                      )}
                                    </Draggable>
                                  );
                                })}
                                {prov.placeholder}
                                {Array.from({ length: Math.max(0, capacity - hourBlocks.length) }, (_, f) => (
                                  <FreeRow key={`free-${f}`} clockText={clockMin(h.start_minute + (hourBlocks.length + f) * blockMinutes)} label="Free · drop a block into this hour" />
                                ))}
                              </div>
                            )}
                          </Droppable>
                        </HourCard>
                      );
                    })}
                  </div>
                  <MaterialsLine dayNumber={dayIndex + 1} placed={placed} />
                </section>
              </div>
            </DragDropContext>
          </>
        )}

        {build?.phase === 'failed' && (
          <div role="alert" style={{ border: '1px solid #feb2b2', background: '#fff5f5', borderRadius: 12, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8, color: '#4a4a4a', fontSize: 14, lineHeight: 1.5 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#c53030' }}>The course was not built</div>
            <div>{problems.length ? 'Some days need a change first. Your plan is exactly as you left it.' : `${build.error} Your plan is still here, so you can try again.`}</div>
            {problems.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {problems.map((p, i) => {
                  const n = dayNumberOf(p.day_id);
                  return (
                    <li key={i}>
                      {n > 0 ? (
                        <>
                          <button type="button" onClick={() => goToDay(n - 1)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 700, color: T.crumbActive, textDecoration: 'underline', cursor: 'pointer' }}>Day {n}</button>
                          {': '}
                        </>
                      ) : null}
                      {problemText(p)}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <div style={{ borderTop: '1px solid #efefef', paddingTop: 18, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 14, fontWeight: 600 }}>
            <span style={{ background: T.addPillBg, color: '#5f5f5f', padding: '12px 16px', borderRadius: 8 }}>1 · Outline</span>
            <span aria-current="step" style={{ background: T.numBg, color: T.numFg, padding: '12px 16px', borderRadius: 8 }}>2 · Plan each day</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {planning && <span style={{ fontSize: 13, fontWeight: 500, color: T.desc }}>Some days are still being planned.</span>}
            <button type="button" onClick={markPlanned} disabled={!ready} style={{ ...secondaryBtn, opacity: ready ? 1 : 0.6, cursor: ready ? 'pointer' : 'not-allowed' }}>
              {isLast ? `Mark Day ${dayIndex + 1} planned` : `Mark planned and go to Day ${dayIndex + 2}`}
            </button>
            <button type="button" onClick={clickBuild} disabled={planning || building} style={{ ...buttonBase, background: T.primary, border: 'none', color: '#FFFFFF', padding: '12px 20px', fontSize: 14, opacity: planning || building ? 0.6 : 1, cursor: planning || building ? 'not-allowed' : 'pointer' }}>
              Build course
            </button>
          </div>
        </div>
      </div>

      <div aria-live="polite" style={SR_ONLY}>{announce}</div>

      {confirmBack && (
        <Modal titleId="pl-back-title" title={multiDay ? 'Go back to the outline?' : 'Go back to the course details?'} onCancel={() => setConfirmBack(false)}>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: '#444444' }}>
            Nothing you planned in this step will be saved. The blocks you arranged for every day will be discarded, and the days will be planned again {multiDay ? 'from the outline' : 'after you enter the course details again'}.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={() => setConfirmBack(false)} style={dialogCancel}>Keep planning</button>
            <button type="button" onClick={discardAndGoBack} style={dialogDanger}>Discard and go back</button>
          </div>
        </Modal>
      )}

      {reviewing && (
        <ReviewDialog
          block={blockById(reviewing.blockId)}
          onCancel={() => setReviewing(null)}
          onConfirm={confirmReview}
        />
      )}

      {confirmBuild && (
        <Modal titleId="pl-build-title" title="Build the course now?" onCancel={() => setConfirmBuild(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 15, lineHeight: 1.5, color: '#444444' }}>
            {notMarked.length > 0 && <p style={{ margin: 0 }}>{joinList(notMarked.map((d) => `Day ${d.n}`))} {notMarked.length === 1 ? 'is' : 'are'} not marked planned yet.</p>}
            {emptyDays.length > 0 && <p style={{ margin: 0 }}>{joinList(emptyDays.map((d) => `Day ${d.n}`))} {emptyDays.length === 1 ? 'has' : 'have'} no blocks, so {emptyDays.length === 1 ? 'it' : 'they'} will be built with nothing in {emptyDays.length === 1 ? 'it' : 'them'}.</p>}
            {emptyHours.length > 0 && <p style={{ margin: 0 }}>{joinList(emptyHours.map((e) => `Day ${e.n}, Hour ${e.hour}`))} {emptyHours.length === 1 ? 'has' : 'have'} no blocks.</p>}
            <p style={{ margin: 0 }}>You can keep planning, or build with the days as they are.</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={() => setConfirmBuild(false)} style={dialogCancel}>Keep planning</button>
            <button type="button" onClick={startBuild} style={{ ...dialogCancel, background: T.primary, color: '#FFFFFF' }}>Build course</button>
          </div>
        </Modal>
      )}

      {building && (
        <Modal titleId="pl-building-title" title="Building your course">
          <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, lineHeight: 1.5, color: '#444444' }}>
            <div>{build.message || 'Working...'}</div>
            <div role="progressbar" aria-label="Build progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(build.percent || 0)} style={{ height: 12, background: T.numBg, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: 12, borderRadius: 999, width: `${Math.max(4, Math.round(build.percent || 0))}%`, background: T.crumbActive, transition: 'width 0.4s' }} />
            </div>
            <div style={{ color: T.desc }}>Writing the content for every block. This can take a few minutes. Please keep this page open.</div>
            {build.notes?.length > 0 && <BuildNotes notes={build.notes} dayNumberOf={dayNumberOf} />}
          </div>
        </Modal>
      )}

      {openState.phase === 'opening' && buildNoteCount === 0 && (
        <Modal titleId="pl-opening-title" title="Opening your course">
          <div role="status" style={{ fontSize: 14, lineHeight: 1.5, color: '#444444' }}>Your course is built and saved. Opening it now...</div>
        </Modal>
      )}

      {openState.phase === 'error' && (
        <Modal titleId="pl-open-error-title" title="Your course is saved">
          <div role="alert" style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, lineHeight: 1.5, color: '#444444' }}>
            <div>Your course was built and saved, but it could not be opened just now. {openState.error}</div>
            <div>You can try again, or find it later under My courses.</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={() => { clearGeneration(); navigate('/my-courses'); }} style={dialogCancel}>Go to My courses</button>
            <button type="button" onClick={landInWorkspace} style={{ ...dialogCancel, background: T.primary, color: '#FFFFFF' }}>Try again</button>
          </div>
        </Modal>
      )}

      {buildPhase === 'done' && buildNoteCount > 0 && openState.phase !== 'opening' && openState.phase !== 'error' && (
        <Modal titleId="pl-done-title" title="Your course is built">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, lineHeight: 1.5, color: '#444444' }}>
            <div>A few small things were adjusted on the way:</div>
            <BuildNotes notes={build.notes} dayNumberOf={dayNumberOf} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={landInWorkspace} style={{ ...dialogCancel, background: T.primary, color: '#FFFFFF' }}>Open the course</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

const BuildNotes = ({ notes, dayNumberOf }) => (
  <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
    {notes.map((n, i) => {
      const d = dayNumberOf(n.day_id);
      return <li key={i}>{d > 0 ? `Day ${d}: ` : ''}{n.message}</li>;
    })}
  </ul>
);

// Asked before a flagged block goes into the day: the title may not match its format.
const ReviewDialog = ({ block, onCancel, onConfirm }) => {
  const [title, setTitle] = useState(block?.title || '');
  const inputRef = useRef(null);
  if (!block) return null;
  return (
    <Modal titleId="pl-review-title" title="Check this block before adding it" onCancel={onCancel} initialFocusRef={inputRef}>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: '#444444' }}>
        {block.review_note || 'The title may not match the format of this block.'}
      </p>
      <div style={{ fontSize: 13, fontWeight: 500, color: T.desc }}>Format: {block.format_label}</div>
      <label htmlFor="pl-review-input" style={{ fontSize: 13, fontWeight: 600, color: T.cardTitle }}>Title</label>
      <input
        id="pl-review-input"
        ref={inputRef}
        type="text"
        value={title}
        maxLength={150}
        onChange={(e) => setTitle(e.target.value)}
        style={{ fontFamily: FONT, fontSize: 15, padding: 12, border: '1px solid #D1D5DB', borderRadius: 8, minHeight: 44, boxSizing: 'border-box', width: '100%' }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
        <button type="button" onClick={onCancel} style={dialogCancel}>Cancel</button>
        <button type="button" onClick={() => onConfirm(title.trim() || block.title)} style={{ ...dialogCancel, background: T.primary, color: '#FFFFFF' }}>
          {title.trim() && title.trim() !== block.title ? 'Rename and add to day' : 'Keep the title and add to day'}
        </button>
      </div>
    </Modal>
  );
};

const PlanStage = () => {
  const { genState } = useGeneration();
  const builder = genState.builder;
  // Direct navigation here without having pressed "2 · Plan each day".
  if (genState.status !== 'builder-planning') {
    return <Navigate to={builder?.requiresChoice ? '/course-builder/outline' : '/course-designer'} replace />;
  }
  return <PlanStageInner />;
};

export default PlanStage;
