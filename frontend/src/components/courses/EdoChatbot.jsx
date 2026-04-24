// src/components/courses/EdoChatbot.jsx
import { useState, useRef, useEffect } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { X, Send, Check, Copy, Minus, GripVertical } from 'lucide-react';
import { chatWithEdo } from '../../utils/curriculumApi';

const EDO_GREEN = '#2C5F3A';
const EDO_ORANGE = '#E8761A';

// Render text with bullet points as <ul> lists and paragraphs as separate blocks
const renderFormattedText = (text) => {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let bulletGroup = [];
  let key = 0;

  const flushBullets = () => {
    if (bulletGroup.length === 0) return;
    elements.push(
      <ul key={key++} style={{ margin: '4px 0 4px 0', paddingLeft: '18px', listStyleType: 'disc' }}>
        {bulletGroup.map((b, i) => (
          <li key={i} style={{ marginBottom: '3px' }}>{b}</li>
        ))}
      </ul>
    );
    bulletGroup = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
      bulletGroup.push(trimmed.replace(/^[•\-*]\s*/, ''));
    } else if (trimmed === '') {
      flushBullets();
    } else {
      flushBullets();
      elements.push(<span key={key++} style={{ display: 'block', marginBottom: '4px' }}>{trimmed}</span>);
    }
  }
  flushBullets();
  return elements;
};


// ── Suggestion Card ────────────────────────────────────────────────────────
// apply_field values that go to the tray (drag-and-drop or one-click apply)
const ADD_TRAY_TYPE = {
  new_section: 'SECTION',
  new_subsection: 'SUBSECTION',
  new_topic: 'TOPICBOX',
  topic_full: 'TOPICBOX',
  new_resource_content: 'CONTENT',
  new_resource_worksheet: 'WORKSHEET',
  new_resource_activity: 'ACTIVITY',
};

const SuggestionCard = ({ card, index, onApply, onApplyBlocked, applied, selectedContext, onAddToTray }) => {
  const [copied, setCopied] = useState(false);
  const [addedToTray, setAddedToTray] = useState(false);

  const trayType = ADD_TRAY_TYPE[card.apply_field] || null;
  const isAddCard = !!trayType;

  const canApply = (() => {
    if (!card.apply_field || isAddCard) return false;
    if (!selectedContext || selectedContext.type === 'course') return false;
    if (card.apply_field === 'topic_full') return selectedContext.type === 'topic';
    return true;
  })();

  const handleCopy = () => {
    navigator.clipboard.writeText(card.body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const handleApplyClick = () => {
    if (applied) return;
    if (canApply) onApply(card, index);
    else onApplyBlocked && onApplyBlocked(card);
  };

  const handleAddToTray = () => {
    if (addedToTray || !onAddToTray) return;
    onAddToTray(card, trayType);
    setAddedToTray(true);
  };

  return (
    <div style={{
      backgroundColor: 'white',
      border: `1px solid ${applied || addedToTray ? '#86EFAC' : '#E7E5E4'}`,
      borderRadius: '10px',
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      transition: 'border-color 0.2s',
    }}>
      {/* Card label */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid #F3F4F6',
        backgroundColor: applied || addedToTray ? '#F0FDF4' : '#FAFAF8',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '6px',
      }}>
        <span style={{
          fontSize: '12.1px', fontWeight: '700', textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: applied || addedToTray ? '#16A34A' : '#78716C',
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {applied || addedToTray ? '✓ In Tray' : `Option ${index + 1}`}
        </span>
        <span style={{
          fontSize: '13.2px', fontWeight: '600', color: applied || addedToTray ? '#16A34A' : '#1C1917',
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {card.label}
        </span>
      </div>

      {/* Card body */}
      <div style={{ padding: '11px 12px' }}>
        <p style={{
          margin: 0, fontSize: '13.8px', lineHeight: '1.65',
          color: '#374151', fontFamily: "'DM Sans', sans-serif",
          whiteSpace: 'pre-wrap',
        }}>
          {card.body}
        </p>
      </div>

      {/* Action row */}
      <div style={{
        padding: '7px 12px',
        borderTop: '1px solid #F3F4F6',
        display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center',
      }}>
        <button
          onClick={handleCopy}
          style={{
            padding: '4px 10px',
            backgroundColor: 'white', border: '1px solid #E7E5E4',
            borderRadius: '5px', cursor: 'pointer',
            fontSize: '12.7px', fontWeight: '500', color: '#6B7280',
            display: 'flex', alignItems: 'center', gap: '4px',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>

        {isAddCard ? (
          <button
            onClick={handleAddToTray}
            disabled={addedToTray}
            title={addedToTray ? 'Already in tray — drag it into your course' : 'Add to tray, then drag into course'}
            style={{
              padding: '4px 10px',
              backgroundColor: addedToTray ? '#F0FDF4' : '#DCFCE7',
              border: `1px solid ${addedToTray ? '#86EFAC' : '#4ADE80'}`,
              borderRadius: '5px',
              cursor: addedToTray ? 'default' : 'pointer',
              fontSize: '12.7px', fontWeight: '600',
              color: addedToTray ? '#16A34A' : '#166534',
              display: 'flex', alignItems: 'center', gap: '5px',
              fontFamily: "'DM Sans', sans-serif",
              transition: 'all 0.15s',
            }}
          >
            <GripVertical size={13} />
            {addedToTray ? 'In Tray ↓' : '+ Add to Tray'}
          </button>
        ) : (
          <button
            onClick={handleApplyClick}
            title={
              applied ? 'Already applied' :
              !card.apply_field ? 'Click to learn how to use this suggestion' :
              (!selectedContext || selectedContext.type === 'course') && !canApply ? 'Select a section, subsection, or topic first' :
              'Apply to course'
            }
            style={{
              padding: '4px 12px',
              backgroundColor: canApply && !applied ? EDO_GREEN : '#E5E7EB',
              border: 'none', borderRadius: '5px',
              cursor: canApply && !applied ? 'pointer' : 'default',
              fontSize: '12.7px', fontWeight: '600',
              color: canApply && !applied ? 'white' : '#9CA3AF',
              display: 'flex', alignItems: 'center', gap: '4px',
              fontFamily: "'DM Sans', sans-serif",
              transition: 'background-color 0.15s',
            }}
          >
            <Check size={11} />
            {applied ? 'Applied' : (
              card.apply_field === 'description' ? 'Apply Description' :
              card.apply_field === 'objectives' ? 'Apply Objectives' :
              card.apply_field === 'title' ? 'Apply Title' :
              'Apply'
            )}
          </button>
        )}
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────
const TRAY_DROPPABLE = {
  SECTION: 'edo-tray-sections',
  SUBSECTION: 'edo-tray-subsections',
  TOPICBOX: 'edo-tray-topics',
};

const EdoChatbot = ({ sections, courseName, formData, actions, currentUser, onClose, trayItems = [], setTrayItems, videosByTopic = {}, handsOnResources = {}, activeTopicContext = null }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedContext, setSelectedContext] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Welcome message on mount
  useEffect(() => {
    const name = courseName || 'your course';
    setMessages([{
      id: 'welcome',
      kind: 'ai-text',
      text: `Hi! I'm Edo 👋 I'm here to help you design "${name}". Ask me anything about your course — I'll give you a few options to choose from.`,
    }]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 120);
  }, []);

  // Sync selected context when teacher opens a topic detail panel
  useEffect(() => {
    if (!activeTopicContext) return;
    setSelectedContext(activeTopicContext);
  }, [activeTopicContext]); // eslint-disable-line react-hooks/exhaustive-deps

  const addTextMessage = (kind, text) =>
    setMessages(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, kind, text }]);

  const addCardsMessage = (cards, intro, conclusion, ctx) =>
    setMessages(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, kind: 'ai-cards', cards, intro: intro || '', conclusion: conclusion || '', appliedCards: new Set(), generatedContext: ctx || null }]);

  const getContextLabel = () => {
    if (!selectedContext) return courseName || 'Your Course';
    if (selectedContext.type === 'section') return `Section: ${selectedContext.title}`;
    if (selectedContext.type === 'subsection') return `Subsection: ${selectedContext.title}`;
    if (selectedContext.type === 'topic') return `Topic: ${selectedContext.title}`;
    return courseName || 'Your Course';
  };

  const getContextDot = () => {
    if (!selectedContext) return '📚';
    if (selectedContext.type === 'section') return '🟢';
    if (selectedContext.type === 'subsection') return '🔵';
    if (selectedContext.type === 'topic') return '🟣';
    return '📚';
  };

  const buildAPIContext = () => {
    const course = {
      title: courseName || '',
      age_range_start: formData?.ageRangeStart || '',
      age_range_end: formData?.ageRangeEnd || '',
      num_students: formData?.numStudents || '',
      subject: formData?.subject || '',
      topic: formData?.topic || '',
      duration: formData?.timeDuration || '',
      description: formData?.objectives || '',
    };

    // Full course structure overview (lightweight — titles only)
    const regularSecs = sections.filter(s => s.type !== 'break');
    const course_structure = regularSecs.map(s => ({
      title: s.title,
      subsections: (s.subsections || []).map(ss => ({
        title: ss.title,
        topic_boxes: (ss.topicBoxes || []).map(t => t.title),
      })),
    }));

    let selectedItem = { type: 'course', title: courseName || '' };

    if (selectedContext) {
      if (selectedContext.type === 'section') {
        const sec = sections.find(s => s.id === selectedContext.id);
        selectedItem = {
          type: 'section',
          title: sec?.title || selectedContext.title,
          description: sec?.description || '',
          subsections: (sec?.subsections || []).map(s => s.title),
        };
      } else if (selectedContext.type === 'subsection') {
        let foundSec = null, foundSub = null;
        for (const s of sections) {
          const ss = (s.subsections || []).find(ss => ss.id === selectedContext.id);
          if (ss) { foundSec = s; foundSub = ss; break; }
        }
        selectedItem = {
          type: 'subsection',
          parent_section: foundSec?.title || '',
          title: foundSub?.title || selectedContext.title,
          description: foundSub?.description || '',
          topic_boxes: (foundSub?.topicBoxes || []).map(t => t.title),
        };
      } else if (selectedContext.type === 'topic') {
        let foundTopic = null, foundSec = null, foundSub = null;
        outer: for (const s of sections) {
          for (const ss of (s.subsections || [])) {
            const t = (ss.topicBoxes || []).find(t => t.id === selectedContext.id);
            if (t) { foundTopic = t; foundSec = s; foundSub = ss; break outer; }
          }
        }
        selectedItem = {
          type: 'topic',
          parent_section: foundSec?.title || '',
          parent_subsection: foundSub?.title || '',
          title: foundTopic?.title || selectedContext.title,
          description: foundTopic?.description || '',
          learning_objectives: foundTopic?.learning_objectives || [],
          pla_pillars: foundTopic?.pla_pillars || [],
          existing_resources: [
            ...(videosByTopic[selectedContext.id] || []).map(v => ({ type: 'video', title: v.title })),
            ...(handsOnResources[selectedContext.id] || []).map(r => ({ type: r.type, title: r.title })),
          ],
        };
      }
    }
    return { course, course_structure, selected_item: selectedItem };
  };

  const getHistory = () => {
    const history = [];
    for (const m of messages) {
      if (m.id === 'welcome') continue;
      if (m.kind === 'user') {
        history.push({ role: 'user', content: m.text });
      } else if (m.kind === 'ai-text') {
        history.push({ role: 'assistant', content: m.text });
      }
      // Skip ai-cards in history — too verbose; the conversation text is enough
    }
    return history.slice(-10); // last 10 turns for context
  };

  const sendToAI = async (userText) => {
    setIsTyping(true);
    try {
      const data = await chatWithEdo({
        message: userText,
        context: buildAPIContext(),
        conversationHistory: getHistory(),
        teacherUid: currentUser?.uid,
      });
      if (data.type === 'conversation') {
        addTextMessage('ai-text', data.message || "I'm not sure how to help with that — could you tell me more?");
      } else if (data.type === 'cards' && data.suggestions?.length > 0) {
        // Build context hint if cards need a deeper context than currently selected
        let conclusion = data.conclusion || '';
        const hasNewTopic = data.suggestions.some(c => c.apply_field === 'new_topic');
        const hasNewSubsection = data.suggestions.some(c => c.apply_field === 'new_subsection');
        if (hasNewTopic && !['subsection', 'topic'].includes(selectedContext?.type)) {
          const hint = '👆 To enable the "Add Topic Box" buttons, open a subsection in the course editor first.';
          conclusion = conclusion ? `${conclusion}\n\n${hint}` : hint;
        } else if (hasNewSubsection && !['section', 'subsection', 'topic'].includes(selectedContext?.type)) {
          const hint = '👆 To enable the "Add Subsection" buttons, open a section in the course editor first.';
          conclusion = conclusion ? `${conclusion}\n\n${hint}` : hint;
        }
        addCardsMessage(data.suggestions, data.intro, conclusion, selectedContext);
      } else {
        addTextMessage('ai-text', "I couldn't generate suggestions right now. Please try again.");
      }
    } catch {
      addTextMessage('ai-text', "I'm having trouble connecting. Please try again in a moment.");
    } finally {
      setIsTyping(false);
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim() || isTyping) return;
    addTextMessage('user', text.trim());
    setInputText('');
    await sendToAI(text.trim());
  };

  // ── Apply a suggestion card to the course structure ────────────────────
  const applyCard = (messageId, card, cardIndex, ctxOverride) => {
    // ADD operations: prefer current selectedContext if it has the right level,
    // otherwise fall back to generatedContext (ctxOverride) so the button works
    // without requiring a context re-selection.
    // EDIT operations use the snapshot from when suggestions were generated (ctxOverride), falling back to current.
    const isAddOp = ['new_section', 'new_subsection', 'new_topic'].includes(card.apply_field);
    let ctx;
    if (isAddOp) {
      if (card.apply_field === 'new_topic') {
        ctx = ['subsection', 'topic'].includes(selectedContext?.type) ? selectedContext : ctxOverride;
      } else if (card.apply_field === 'new_subsection') {
        ctx = ['section', 'subsection', 'topic'].includes(selectedContext?.type) ? selectedContext : ctxOverride;
      } else {
        ctx = selectedContext;
      }
    } else {
      ctx = ctxOverride || selectedContext;
    }
    if (!card.apply_field) return;

    if (card.apply_field === 'new_section') {
      actions.addSectionWithContent(card.label, card.body);
      markApplied(messageId, cardIndex);
      addTextMessage('ai-text', `Added new section "${card.label}". ✓`);
      return;
    }

    if (!ctx) {
      addTextMessage('ai-text', 'Please open a section or subsection in the course editor first, then click Apply again.');
      return;
    }

    if (card.apply_field === 'new_subsection' && ['section', 'subsection', 'topic'].includes(ctx.type)) {
      // Derive the section ID regardless of how deep the context is
      const sectionId = ctx.type === 'section' ? ctx.id : ctx.sectionId;
      actions.addSubsectionWithContent(sectionId, card.label, card.body);
      markApplied(messageId, cardIndex);
      addTextMessage('ai-text', `Added new subsection "${card.label}". ✓`);
      return;
    }

    if (card.apply_field === 'new_topic' && ['subsection', 'topic'].includes(ctx.type)) {
      // Derive the subsection ID whether focused on a subsection or a sibling topic
      const sectionId = ctx.sectionId;
      const subsectionId = ctx.type === 'subsection' ? ctx.id : ctx.subsectionId;
      actions.addTopicBoxWithContent(sectionId, subsectionId, card.label, card.body);
      markApplied(messageId, cardIndex);
      addTextMessage('ai-text', `Added topic box "${card.label}". ✓ The subsection has been expanded — you should see it in the workspace.`);
      return;
    }

    if (card.apply_field === 'topic_full') {
      if (ctx.type === 'topic') {
        const sec = sections.find(s => s.id === ctx.sectionId);
        const sub = sec?.subsections?.find(ss => ss.id === ctx.subsectionId);
        const topic = sub?.topicBoxes?.find(t => t.id === ctx.id);
        if (!topic) {
          addTextMessage('ai-text', "Couldn't find that topic box — it may have been deleted. Try selecting it again.");
          return;
        }
        // Parse body: description before "Objectives:" delimiter, objectives after
        const objMatch = card.body.match(/\n\n?Objectives?:?\n/i);
        const description = objMatch
          ? card.body.slice(0, objMatch.index).trim()
          : card.body.trim();
        const objectivesText = objMatch ? card.body.slice(objMatch.index + objMatch[0].length) : '';
        const objectives = objectivesText.split('\n').map(s => s.replace(/^[-•*\d.]\s*/, '').trim()).filter(Boolean);
        actions.updateTopicBoxFull({
          sectionId: ctx.sectionId, subsectionId: ctx.subsectionId, topicId: ctx.id,
          updatedData: { ...topic, description, learning_objectives: objectives },
        });
      }
    } else if (card.apply_field === 'description') {
      if (ctx.type === 'section') {
        actions.updateSectionDescription(ctx.id, card.body);
      } else if (ctx.type === 'subsection') {
        actions.updateSubsectionDescription(ctx.sectionId, ctx.id, card.body);
      } else if (ctx.type === 'topic') {
        const sec = sections.find(s => s.id === ctx.sectionId);
        const sub = sec?.subsections?.find(ss => ss.id === ctx.subsectionId);
        const topic = sub?.topicBoxes?.find(t => t.id === ctx.id);
        if (!topic) {
          addTextMessage('ai-text', "Couldn't find that topic box — it may have been deleted. Try selecting it again.");
          return;
        }
        actions.updateTopicBoxFull({
          sectionId: ctx.sectionId, subsectionId: ctx.subsectionId, topicId: ctx.id,
          updatedData: { ...topic, description: card.body },
        });
      }
    } else if (card.apply_field === 'title') {
      if (ctx.type === 'section') {
        actions.updateSectionTitle(ctx.id, card.body);
      } else if (ctx.type === 'subsection') {
        actions.updateSubsectionTitle(ctx.sectionId, ctx.id, card.body);
      }
    } else if (card.apply_field === 'objectives') {
      if (ctx.type === 'topic') {
        const sec = sections.find(s => s.id === ctx.sectionId);
        const sub = sec?.subsections?.find(ss => ss.id === ctx.subsectionId);
        const topic = sub?.topicBoxes?.find(t => t.id === ctx.id);
        if (!topic) {
          addTextMessage('ai-text', "Couldn't find that topic box — it may have been deleted. Try selecting it again.");
          return;
        }
        const objectives = card.body.split('\n').map(s => s.replace(/^[-•*\d.]\s*/, '').trim()).filter(Boolean);
        actions.updateTopicBoxFull({
          sectionId: ctx.sectionId, subsectionId: ctx.subsectionId, topicId: ctx.id,
          updatedData: { ...topic, learning_objectives: objectives },
        });
      }
    } else if (['new_resource_content', 'new_resource_worksheet', 'new_resource_activity'].includes(card.apply_field)) {
      // Resource blocks go through the tray — this path is not reachable from the UI
      // but kept as a fallback in case applyCard is called programmatically.
      return;
    }

    markApplied(messageId, cardIndex);
    addTextMessage('ai-text', `Applied "${card.label}" to ${ctx.type}: "${ctx.title}". ✓`);
  };

  const handleApplyBlocked = (card) => {
    let msg;
    if (!card.apply_field) {
      msg = "This suggestion is informational — use the Copy button to grab the text and paste it wherever you need it.";
    } else if (card.apply_field === 'topic_full') {
      msg = "To apply this, open a topic box first — then click Apply.";
    } else if (card.apply_field === 'new_subsection') {
      msg = "To add a subsection, open a topic box or subsection first — then click Apply.";
    } else if (card.apply_field === 'new_topic') {
      msg = "To add a topic box, open a subsection or topic first — then click Apply.";
    } else {
      msg = "To apply this, open the relevant section, subsection, or topic — then click Apply on this card.";
    }
    addTextMessage('ai-text', msg);
  };

  const markApplied = (messageId, cardIndex) => {
    setMessages(prev => prev.map(m =>
      m.id === messageId
        ? { ...m, appliedCards: new Set([...(m.appliedCards || []), cardIndex]) }
        : m
    ));
  };

  // ── Tray helpers ───────────────────────────────────────────────────────
  const addToTray = (type, data) => {
    const id = `tray-${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setTrayItems(prev => [...prev, { id, type, data }]);
  };

  // ── Generate outline item handlers (Section / Subsection / Topic Box) ──
  const handleGenerateSection = async () => {
    if (isTyping) return;
    addTextMessage('user', 'Generate a new section');
    setIsTyping(true);
    try {
      const result = await actions.generateSectionsForTray({
        level: 'sections',
        context: {
          course: { title: courseName, description: formData?.objectives || '', grade: formData?.class || '' },
          existing_sections: sections.filter(s => s.type !== 'break').map(s => ({ title: s.title, description: s.description || '' })),
        },
        count: 1,
      });
      if (result?.success === false) throw new Error(result.error);
      result.items.forEach(item => addToTray('SECTION', item));
      addTextMessage('ai-text', `Generated ${result.items.length} section${result.items.length !== 1 ? 's' : ''}! Drag it from the tray below into your course wherever you want.`);
    } catch {
      addTextMessage('ai-text', 'I had trouble generating a section. Please try again.');
    } finally {
      setIsTyping(false);
    }
  };

  const handleGenerateSubsection = async () => {
    if (isTyping) return;
    addTextMessage('user', 'Generate a new subsection');
    setIsTyping(true);
    const sec = selectedContext?.type === 'section' ? sections.find(s => s.id === selectedContext.id) : null;
    try {
      const result = await actions.generateSubsectionsForTray({
        level: 'subsections',
        context: {
          course: { title: courseName, description: formData?.objectives || '', grade: formData?.class || '' },
          ...(sec ? {
            current_section: {
              title: sec.title, description: sec.description || '',
              existingSubsections: (sec.subsections || []).map(s => ({ title: s.title, description: s.description })),
            },
          } : {}),
          all_section_names: sections.filter(s => s.type !== 'break').map(s => s.title),
          all_sections: sections.filter(s => s.type !== 'break').map(s => ({
            title: s.title, description: s.description,
            subsections: (s.subsections || []).map(ss => ss.title),
          })),
        },
        count: 1,
      });
      if (result?.success === false) throw new Error(result.error);
      result.items.forEach(item => addToTray('SUBSECTION', item));
      addTextMessage('ai-text', `Generated ${result.items.length} subsection${result.items.length !== 1 ? 's' : ''}! Drag it from the tray into any section in your course.`);
    } catch {
      addTextMessage('ai-text', 'I had trouble generating a subsection. Please try again.');
    } finally {
      setIsTyping(false);
    }
  };

  const handleGenerateTopicBox = async () => {
    if (isTyping) return;
    addTextMessage('user', 'Generate a new topic box');
    setIsTyping(true);
    const parentSecId = selectedContext?.sectionId || (selectedContext?.type === 'section' ? selectedContext.id : null);
    const subsectionId = selectedContext?.type === 'subsection' ? selectedContext.id
      : selectedContext?.type === 'topic' ? selectedContext.subsectionId : null;
    const parentSec = sections.find(s => s.id === parentSecId);
    const parentSub = parentSec?.subsections?.find(ss => ss.id === subsectionId);
    try {
      const result = await actions.generateTopicBoxesForTray({
        level: 'topics',
        context: {
          course: { title: courseName, grade: formData?.class || '', description: formData?.objectives || '' },
          all_sections: sections.filter(s => s.type !== 'break').map(s => ({
            title: s.title, description: s.description,
            subsections: (s.subsections || []).map(ss => ({
              title: ss.title, description: ss.description,
              existingTopics: (ss.topicBoxes || []).map(t => t.title),
            })),
          })),
          ...(parentSec ? { current_section: { title: parentSec.title, description: parentSec.description || '' } } : {}),
          ...(parentSub ? {
            subsection: {
              title: parentSub.title, description: parentSub.description || '',
              existingTopics: (parentSub.topicBoxes || []).map(t => ({ title: t.title, description: t.description })),
            },
          } : {}),
        },
        count: 1,
      });
      if (result?.success === false) throw new Error(result.error);
      result.items.forEach(item => addToTray('TOPICBOX', item));
      addTextMessage('ai-text', `Generated ${result.items.length} topic box${result.items.length !== 1 ? 'es' : ''}! Drag it from the tray into any subsection.`);
    } catch (err) {
      addTextMessage('ai-text', `I had trouble generating the topic box. ${err?.message || 'Please try again.'}`);
    } finally {
      setIsTyping(false);
    }
  };

  // ── Generate resource block handlers (Content / Worksheet / Activity) ──
  const handleGenerateResource = async (resourceType) => {
    if (isTyping) return;
    if (!selectedContext || selectedContext.type !== 'topic') {
      addTextMessage('ai-text', 'Please open a topic box in the course editor first to use these buttons.');
      return;
    }
    const prompts = {
      content: 'Suggest a content block for this topic',
      worksheet: 'Suggest a worksheet for this topic',
      activity: 'Suggest an activity for this topic',
    };
    await sendMessage(prompts[resourceType]);
  };


  // ── Render ─────────────────────────────────────────────────────────────

  // Minimized: vertical side tab
  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        title="Expand Edo"
        style={{
          width: '32px',
          flexShrink: 0,
          height: '100%',
          backgroundColor: EDO_ORANGE,
          borderLeft: '1px solid rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          userSelect: 'none',
          gap: '10px',
        }}
      >
        <div style={{
          width: '22px', height: '22px', borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: '700', fontSize: '13.2px', color: 'white', flexShrink: 0,
          fontFamily: "'Fraunces', serif",
        }}>E</div>
        <span style={{
          color: 'white',
          fontSize: '12.1px',
          fontWeight: '700',
          fontFamily: "'DM Sans', sans-serif",
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          transform: 'rotate(180deg)',
          letterSpacing: '0.5px',
        }}>Edo AI</span>
      </div>
    );
  }

  return (
    <div style={{
      width: '360px',
      flexShrink: 0,
      height: '100%',
      backgroundColor: '#FAFAF8',
      borderLeft: '1px solid #E7E5E4',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes edoBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        backgroundColor: EDO_ORANGE,
        padding: '11px 14px',
        display: 'flex', alignItems: 'center', gap: '10px',
        flexShrink: 0,
      }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: '700', fontSize: '16.5px', color: 'white', flexShrink: 0,
          fontFamily: "'Fraunces', serif",
        }}>E</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'white', fontWeight: '700', fontSize: '15.4px', fontFamily: "'DM Sans', sans-serif" }}>Edo</div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12.1px', fontFamily: "'DM Sans', sans-serif" }}>EdCube AI</div>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          title="Minimise Edo"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '4px',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'white'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
        >
          <Minus size={17} />
        </button>
        <button
          onClick={onClose}
          title="Close Edo (clears chat)"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '4px',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'white'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
        >
          <X size={17} />
        </button>
      </div>

      {/* Context bar */}
      <div style={{
        padding: '7px 11px',
        backgroundColor: '#F5F3EE',
        borderBottom: '1px solid #E7E5E4',
        display: 'flex', alignItems: 'center',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: '12.7px', color: '#78716C', fontFamily: "'DM Sans', sans-serif",
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {getContextDot()}{' '}
          <span style={{ color: '#1C1917', fontWeight: '600' }}>{getContextLabel()}</span>
        </span>
      </div>

      {/* Message thread */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px',
        display: 'flex', flexDirection: 'column', gap: '10px',
        scrollbarWidth: 'thin', scrollbarColor: '#E8E6E1 transparent',
      }}>
        {messages.map(msg => {
          if (msg.kind === 'user') {
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{
                  maxWidth: '82%', padding: '8px 12px',
                  borderRadius: '14px 14px 2px 14px',
                  backgroundColor: EDO_GREEN, color: 'white',
                  fontSize: '14.3px', lineHeight: '1.5', fontFamily: "'DM Sans', sans-serif",
                  wordBreak: 'break-word',
                }}>
                  {msg.text}
                </div>
              </div>
            );
          }

          if (msg.kind === 'ai-text') {
            return (
              <div key={msg.id} style={{ display: 'flex', gap: '7px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  backgroundColor: EDO_GREEN, flexShrink: 0, marginTop: '2px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: 'white', fontSize: '11px', fontWeight: '700', fontFamily: "'Fraunces', serif" }}>E</span>
                </div>
                <div style={{
                  maxWidth: '82%', padding: '8px 12px',
                  borderRadius: '14px 14px 14px 2px',
                  backgroundColor: 'white', color: '#1C1917',
                  fontSize: '14.3px', lineHeight: '1.55', fontFamily: "'DM Sans', sans-serif",
                  border: '1px solid #E7E5E4', wordBreak: 'break-word',
                }}>
                  {renderFormattedText(msg.text)}
                </div>
              </div>
            );
          }

          if (msg.kind === 'ai-cards') {
            return (
              <div key={msg.id} style={{ display: 'flex', gap: '7px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  backgroundColor: EDO_GREEN, flexShrink: 0, marginTop: '2px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: 'white', fontSize: '11px', fontWeight: '700', fontFamily: "'Fraunces', serif" }}>E</span>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {msg.intro && (
                    <div style={{
                      padding: '8px 12px', borderRadius: '14px 14px 14px 2px',
                      backgroundColor: 'white', border: '1px solid #E7E5E4',
                      fontSize: '14.3px', lineHeight: '1.55', color: '#1C1917',
                      fontFamily: "'DM Sans', sans-serif", wordBreak: 'break-word',
                    }}>
                      {renderFormattedText(msg.intro)}
                    </div>
                  )}
                  {(msg.cards || []).map((card, idx) => (
                    <SuggestionCard
                      key={idx}
                      card={card}
                      index={idx}
                      applied={(msg.appliedCards || new Set()).has(idx)}
                      selectedContext={selectedContext}
                      generatedContext={msg.generatedContext}
                      onApply={(c, i) => applyCard(msg.id, c, i, msg.generatedContext)}
                      onApplyBlocked={handleApplyBlocked}
                      onAddToTray={(c, type) => {
                        let data;
                        if (type === 'SECTION') {
                          data = { id: `section-${Date.now()}`, title: c.label, description: c.body, subsections: [] };
                        } else if (type === 'SUBSECTION') {
                          data = { id: `sub-${Date.now()}`, title: c.label, description: c.body, topicBoxes: [] };
                        } else if (type === 'CONTENT') {
                          data = { id: `content-${Date.now()}`, information: c.body, links: [] };
                        } else if (type === 'WORKSHEET') {
                          data = { id: `ws-${Date.now()}`, title: c.label, notes: c.body, worksheetType: '', contentKeywords: '', links: [] };
                        } else if (type === 'ACTIVITY') {
                          data = { id: `act-${Date.now()}`, title: c.label, instructions: c.body, activityType: '', links: [] };
                        } else {
                          // TOPICBOX
                          const isTopicFull = c.apply_field === 'topic_full';
                          data = {
                            id: `topic-${Date.now()}`,
                            title: c.label,
                            description: isTopicFull ? (c.body.split(/\n\n?Objectives?:?\n/i)[0] || c.body).trim() : c.body,
                            duration_minutes: 20,
                            pla_pillars: [],
                            learning_objectives: isTopicFull && c.body.includes('bjective')
                              ? c.body.split(/\n\n?Objectives?:?\n/i)[1]?.split('\n').map(s => s.replace(/^[-•*\d.]\s*/, '').trim()).filter(Boolean) || []
                              : [],
                            content_keywords: [],
                            video_resources: [],
                            worksheets: [],
                            activities: [],
                          };
                        }
                        addToTray(type, data);
                        markApplied(msg.id, idx);
                      }}
                    />
                  ))}
                  {msg.conclusion && (
                    <div style={{
                      padding: '8px 12px', borderRadius: '14px 14px 14px 2px',
                      backgroundColor: 'white', border: '1px solid #E7E5E4',
                      fontSize: '14.3px', lineHeight: '1.55', color: '#1C1917',
                      fontFamily: "'DM Sans', sans-serif", wordBreak: 'break-word',
                    }}>
                      {renderFormattedText(msg.conclusion)}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          return null;
        })}

        {/* Typing indicator */}
        {isTyping && (
          <div style={{ display: 'flex', gap: '7px', alignItems: 'flex-start' }}>
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%',
              backgroundColor: EDO_GREEN, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: 'white', fontSize: '11px', fontWeight: '700', fontFamily: "'Fraunces', serif" }}>E</span>
            </div>
            <div style={{
              padding: '10px 14px', backgroundColor: 'white',
              border: '1px solid #E7E5E4', borderRadius: '14px 14px 14px 2px',
              display: 'flex', gap: '4px', alignItems: 'center',
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#9CA3AF',
                  animation: 'edoBounce 1.2s ease infinite',
                  animationDelay: `${i * 0.18}s`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Generated Items Tray */}
      {trayItems.length > 0 && (
        <div style={{
          borderTop: '2px solid #E8761A',
          backgroundColor: '#FFFBF5',
          flexShrink: 0,
          maxHeight: '220px',
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: '#E8E6E1 transparent',
        }}>
          <div style={{
            padding: '7px 12px 4px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{
              fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
              letterSpacing: '0.6px', color: '#E8761A',
              fontFamily: "'DM Sans', sans-serif",
            }}>
              Generated — Drag into Course
            </span>
            <button
              onClick={() => setTrayItems([])}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '11px', color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif",
                padding: '2px 4px',
              }}
            >
              Clear all
            </button>
          </div>

          {/* Sections group */}
          {trayItems.some(i => i.type === 'SECTION') && (
            <div style={{ padding: '0 10px 6px' }}>
              <div style={{ fontSize: '9px', fontWeight: '700', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontFamily: "'DM Sans', sans-serif" }}>
                Sections
              </div>
              <Droppable droppableId={TRAY_DROPPABLE.SECTION} type="SECTION" direction="horizontal">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{
                      display: 'flex', gap: '6px', flexWrap: 'wrap',
                      minHeight: '34px', padding: '3px',
                      backgroundColor: snapshot.isDraggingOver ? '#DCFCE7' : 'transparent',
                      borderRadius: '6px', transition: 'background-color 0.15s',
                    }}
                  >
                    {trayItems.filter(i => i.type === 'SECTION').map((item, idx) => (
                      <Draggable key={item.id} draggableId={item.id} index={idx}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{
                              ...provided.draggableProps.style,
                              padding: '4px 10px',
                              backgroundColor: snapshot.isDragging ? '#16A34A' : '#DCFCE7',
                              border: '1px solid #86EFAC',
                              borderRadius: '20px',
                              fontSize: '12px', fontWeight: '600',
                              color: snapshot.isDragging ? 'white' : '#166534',
                              display: 'flex', alignItems: 'center', gap: '5px',
                              cursor: 'grab', userSelect: 'none',
                              fontFamily: "'DM Sans', sans-serif",
                              maxWidth: '140px',
                              boxShadow: snapshot.isDragging ? '0 4px 12px rgba(0,0,0,0.2)' : 'none',
                            }}
                          >
                            <span style={{ fontSize: '9px', opacity: 0.6, flexShrink: 0 }}>S</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.data.title}</span>
                            <button
                              onMouseDown={e => e.stopPropagation()}
                              onClick={e => { e.stopPropagation(); setTrayItems(prev => prev.filter(i => i.id !== item.id)); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534', padding: 0, lineHeight: 1, fontSize: '14px', flexShrink: 0 }}
                            >×</button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          )}

          {/* Subsections group */}
          {trayItems.some(i => i.type === 'SUBSECTION') && (
            <div style={{ padding: '0 10px 6px' }}>
              <div style={{ fontSize: '9px', fontWeight: '700', color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontFamily: "'DM Sans', sans-serif" }}>
                Subsections
              </div>
              <Droppable droppableId={TRAY_DROPPABLE.SUBSECTION} type="SUBSECTION" direction="horizontal">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{
                      display: 'flex', gap: '6px', flexWrap: 'wrap',
                      minHeight: '34px', padding: '3px',
                      backgroundColor: snapshot.isDraggingOver ? '#DBEAFE' : 'transparent',
                      borderRadius: '6px', transition: 'background-color 0.15s',
                    }}
                  >
                    {trayItems.filter(i => i.type === 'SUBSECTION').map((item, idx) => (
                      <Draggable key={item.id} draggableId={item.id} index={idx}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{
                              ...provided.draggableProps.style,
                              padding: '4px 10px',
                              backgroundColor: snapshot.isDragging ? '#2563EB' : '#DBEAFE',
                              border: '1px solid #93C5FD',
                              borderRadius: '20px',
                              fontSize: '12px', fontWeight: '600',
                              color: snapshot.isDragging ? 'white' : '#1D4ED8',
                              display: 'flex', alignItems: 'center', gap: '5px',
                              cursor: 'grab', userSelect: 'none',
                              fontFamily: "'DM Sans', sans-serif",
                              maxWidth: '140px',
                              boxShadow: snapshot.isDragging ? '0 4px 12px rgba(0,0,0,0.2)' : 'none',
                            }}
                          >
                            <span style={{ fontSize: '9px', opacity: 0.6, flexShrink: 0 }}>SS</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.data.title}</span>
                            <button
                              onMouseDown={e => e.stopPropagation()}
                              onClick={e => { e.stopPropagation(); setTrayItems(prev => prev.filter(i => i.id !== item.id)); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1D4ED8', padding: 0, lineHeight: 1, fontSize: '14px', flexShrink: 0 }}
                            >×</button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          )}

          {/* Topics group */}
          {trayItems.some(i => i.type === 'TOPICBOX') && (
            <div style={{ padding: '0 10px 6px' }}>
              <div style={{ fontSize: '9px', fontWeight: '700', color: '#86198F', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontFamily: "'DM Sans', sans-serif" }}>
                Topics
              </div>
              <Droppable droppableId={TRAY_DROPPABLE.TOPICBOX} type="TOPICBOX" direction="horizontal">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{
                      display: 'flex', gap: '6px', flexWrap: 'wrap',
                      minHeight: '34px', padding: '3px',
                      backgroundColor: snapshot.isDraggingOver ? '#FAE8FF' : 'transparent',
                      borderRadius: '6px', transition: 'background-color 0.15s',
                    }}
                  >
                    {trayItems.filter(i => i.type === 'TOPICBOX').map((item, idx) => (
                      <Draggable key={item.id} draggableId={item.id} index={idx}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{
                              ...provided.draggableProps.style,
                              padding: '4px 10px',
                              backgroundColor: snapshot.isDragging ? '#A21CAF' : '#FAE8FF',
                              border: '1px solid #E879F9',
                              borderRadius: '20px',
                              fontSize: '12px', fontWeight: '600',
                              color: snapshot.isDragging ? 'white' : '#86198F',
                              display: 'flex', alignItems: 'center', gap: '5px',
                              cursor: 'grab', userSelect: 'none',
                              fontFamily: "'DM Sans', sans-serif",
                              maxWidth: '140px',
                              boxShadow: snapshot.isDragging ? '0 4px 12px rgba(0,0,0,0.2)' : 'none',
                            }}
                          >
                            <span style={{ fontSize: '9px', opacity: 0.6, flexShrink: 0 }}>T</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.data.title}</span>
                            <button
                              onMouseDown={e => e.stopPropagation()}
                              onClick={e => { e.stopPropagation(); setTrayItems(prev => prev.filter(i => i.id !== item.id)); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#86198F', padding: 0, lineHeight: 1, fontSize: '14px', flexShrink: 0 }}
                            >×</button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          )}

          {/* Resource blocks group (CONTENT / WORKSHEET / ACTIVITY) */}
          {trayItems.some(i => ['CONTENT', 'WORKSHEET', 'ACTIVITY'].includes(i.type)) && (
            <div style={{ padding: '0 10px 8px' }}>
              <div style={{ fontSize: '9px', fontWeight: '700', color: '#6B6760', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', fontFamily: "'DM Sans', sans-serif" }}>
                Resource Blocks — click to add to current topic
              </div>
              {trayItems.filter(i => ['CONTENT', 'WORKSHEET', 'ACTIVITY'].includes(i.type)).map(item => {
                const meta = {
                  CONTENT:   { label: 'Content',   color: '#6B8FE8', bg: '#EAF0FF', border: '#BFD0F8', resourceType: 'content' },
                  WORKSHEET: { label: 'Worksheet',  color: '#C47A1A', bg: '#FFF3E8', border: '#F5C98A', resourceType: 'worksheet' },
                  ACTIVITY:  { label: 'Activity',   color: '#1E7C43', bg: '#EDFFF3', border: '#86EFAC', resourceType: 'activity' },
                }[item.type];
                const displayTitle = item.data.title || (item.data.information ? item.data.information.slice(0, 50) + (item.data.information.length > 50 ? '…' : '') : 'Untitled');
                const canAddToTopic = selectedContext?.type === 'topic';
                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '7px 10px',
                      backgroundColor: 'white',
                      border: `1.5px solid ${meta.border}`,
                      borderLeft: `4px solid ${meta.color}`,
                      borderRadius: '8px',
                      marginBottom: '5px',
                    }}
                  >
                    <span style={{ padding: '2px 7px', backgroundColor: meta.bg, color: meta.color, borderRadius: '10px', fontSize: '10.5px', fontWeight: '700', flexShrink: 0, fontFamily: "'DM Sans', sans-serif" }}>
                      {meta.label}
                    </span>
                    <span style={{ flex: 1, fontSize: '12.7px', color: '#1C1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}>
                      {displayTitle}
                    </span>
                    {canAddToTopic ? (
                      <button
                        onClick={() => {
                          actions.addManualResource(selectedContext.id, meta.resourceType, item.data);
                          setTrayItems(prev => prev.filter(i => i.id !== item.id));
                          addTextMessage('ai-text', `Added ${meta.label.toLowerCase()} block to "${selectedContext.title}". ✓`);
                        }}
                        style={{ padding: '3px 9px', backgroundColor: meta.bg, border: `1px solid ${meta.border}`, borderRadius: '5px', cursor: 'pointer', fontSize: '12.1px', fontWeight: '700', color: meta.color, whiteSpace: 'nowrap', flexShrink: 0, fontFamily: "'DM Sans', sans-serif" }}
                      >
                        + Add to Topic
                      </button>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#9CA3AF', flexShrink: 0, fontFamily: "'DM Sans', sans-serif", fontStyle: 'italic' }}>
                        select a topic ↑
                      </span>
                    )}
                    <button
                      onClick={() => setTrayItems(prev => prev.filter(i => i.id !== item.id))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0, lineHeight: 1, fontSize: '14px', flexShrink: 0 }}
                    >×</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}


      {/* Bottom action buttons — context-aware generate actions */}
      {activeTopicContext ? (
        /* Topic detail view: generate Content / Worksheet / Activity */
        <div style={{
          padding: '7px 10px', borderTop: '1px solid #E7E5E4',
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px',
          flexShrink: 0, backgroundColor: '#FAFAF8',
        }}>
          {[
            { label: '+ Content', color: '#6B8FE8', bg: '#EAF0FF', border: '#BFD0F8', fn: () => handleGenerateResource('content') },
            { label: '+ Worksheet', color: '#C47A1A', bg: '#FFF3E8', border: '#F5C98A', fn: () => handleGenerateResource('worksheet') },
            { label: '+ Activity', color: '#1E7C43', bg: '#EDFFF3', border: '#86EFAC', fn: () => handleGenerateResource('activity') },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={btn.fn}
              disabled={isTyping}
              style={{
                padding: '7px 4px',
                backgroundColor: btn.bg,
                border: `1.5px solid ${btn.border}`,
                borderRadius: '8px',
                cursor: isTyping ? 'not-allowed' : 'pointer',
                fontSize: '12.7px', fontWeight: '700',
                color: btn.color,
                fontFamily: "'DM Sans', sans-serif",
                opacity: isTyping ? 0.55 : 1,
                transition: 'all 0.15s',
                textAlign: 'center',
              }}
            >
              ✨ {btn.label}
            </button>
          ))}
        </div>
      ) : (
        /* Outline view: generate Section / Subsection / Topic Box */
        <div style={{
          padding: '7px 10px', borderTop: '1px solid #E7E5E4',
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px',
          flexShrink: 0, backgroundColor: '#FAFAF8',
        }}>
          {[
            { label: '+ Section', fn: handleGenerateSection },
            { label: '+ Subsection', fn: handleGenerateSubsection },
            { label: '+ Topic Box', fn: handleGenerateTopicBox },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={btn.fn}
              disabled={isTyping}
              style={{
                padding: '7px 4px',
                backgroundColor: '#DCFCE7',
                border: '1.5px solid #86EFAC',
                borderRadius: '8px',
                cursor: isTyping ? 'not-allowed' : 'pointer',
                fontSize: '12.7px', fontWeight: '700',
                color: '#166534',
                fontFamily: "'DM Sans', sans-serif",
                opacity: isTyping ? 0.55 : 1,
                transition: 'all 0.15s',
                textAlign: 'center',
              }}
            >
              ✨ {btn.label}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div style={{
        padding: '9px 11px', borderTop: '1px solid #E7E5E4',
        display: 'flex', gap: '8px', alignItems: 'flex-end',
        flexShrink: 0, backgroundColor: 'white',
      }}>
        <textarea
          ref={inputRef}
          value={inputText}
          rows={1}
          onChange={e => {
            setInputText(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (inputText.trim()) {
                e.target.style.height = 'auto';
                sendMessage(inputText);
              }
            }
          }}
          placeholder="Ask Edo anything… (Shift+Enter for new line)"
          disabled={isTyping}
          style={{
            flex: 1, padding: '8px 12px',
            border: '1px solid #E7E5E4', borderRadius: '16px',
            outline: 'none', fontSize: '14.3px',
            fontFamily: "'DM Sans', sans-serif",
            backgroundColor: isTyping ? '#F9F9F8' : 'white', color: '#1C1917',
            resize: 'none', overflowY: 'auto',
            lineHeight: '1.45', maxHeight: '120px',
          }}
        />
        <button
          onClick={() => {
            if (inputText.trim() && inputRef.current) inputRef.current.style.height = 'auto';
            sendMessage(inputText);
          }}
          disabled={!inputText.trim() || isTyping}
          style={{
            width: '34px', height: '34px', borderRadius: '50%',
            backgroundColor: inputText.trim() && !isTyping ? EDO_GREEN : '#E5E7EB',
            border: 'none', cursor: inputText.trim() && !isTyping ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'background-color 0.15s', marginBottom: '1px',
          }}
        >
          <Send size={14} color={inputText.trim() && !isTyping ? 'white' : '#9CA3AF'} />
        </button>
      </div>
    </div>
  );
};

export default EdoChatbot;
