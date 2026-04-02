// src/components/courses/EdoChatbot.jsx
import { useState, useRef, useEffect } from 'react';
import { X, Send, ChevronDown, Check, Copy, Minus } from 'lucide-react';
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

const QUICK_CHIPS = {
  course: [
    { label: 'Add a section', action: 'add-section', isGenerate: true },
    { label: 'Improve course structure', action: 'chat' },
    { label: 'Review objectives', action: 'chat' },
    { label: 'Check course balance', action: 'chat' },
  ],
  section: [
    { label: 'Add subsection', action: 'add-subsection', isGenerate: true },
    { label: 'Rewrite description', action: 'chat' },
    { label: 'Improve structure', action: 'chat' },
    { label: 'Learning objectives', action: 'chat' },
  ],
  subsection: [
    { label: 'Add a topic box', action: 'add-topic', isGenerate: true },
    { label: 'Rewrite description', action: 'chat' },
    { label: 'Suggest activities', action: 'chat' },
    { label: 'Check PLA coverage', action: 'chat' },
  ],
  topic: [
    { label: 'Expand this topic', action: 'chat' },
    { label: 'Write objectives', action: 'chat' },
    { label: 'Find video resources', action: 'find-videos', isGenerate: true },
    { label: 'Generate activity', action: 'gen-activity', isGenerate: true },
    { label: 'Generate worksheet', action: 'gen-worksheet', isGenerate: true },
  ],
};

// ── Suggestion Card ────────────────────────────────────────────────────────
const SuggestionCard = ({ card, index, onApply, onApplyBlocked, applied, selectedContext }) => {
  const [copied, setCopied] = useState(false);
  const canApply = (() => {
    if (!card.apply_field) return false;
    if (card.apply_field === 'new_section') return true;
    if (!selectedContext || selectedContext.type === 'course') return false;
    // new_subsection: need a section — section, subsection, or topic contexts all carry a sectionId
    if (card.apply_field === 'new_subsection') return ['section', 'subsection', 'topic'].includes(selectedContext.type);
    // new_topic: need a subsection — subsection or topic contexts both carry a subsectionId
    if (card.apply_field === 'new_topic') return ['subsection', 'topic'].includes(selectedContext.type);
    // topic_full: combined description + objectives — only applies to a topic box
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
    if (canApply) {
      onApply(card, index);
    } else {
      onApplyBlocked && onApplyBlocked(card);
    }
  };

  return (
    <div style={{
      backgroundColor: 'white',
      border: `1px solid ${applied ? '#86EFAC' : '#E7E5E4'}`,
      borderRadius: '10px',
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      transition: 'border-color 0.2s',
    }}>
      {/* Card label */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid #F3F4F6',
        backgroundColor: applied ? '#F0FDF4' : '#FAFAF8',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '6px',
      }}>
        <span style={{
          fontSize: '12.1px', fontWeight: '700', textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: applied ? '#16A34A' : '#78716C',
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {applied ? '✓ Applied' : `Option ${index + 1}`}
        </span>
        <span style={{
          fontSize: '13.2px', fontWeight: '600', color: applied ? '#16A34A' : '#1C1917',
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
        display: 'flex', gap: '6px', justifyContent: 'flex-end',
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

        <button
          onClick={handleApplyClick}
          title={
            applied ? 'Already applied' :
            !card.apply_field ? 'Click to learn how to use this suggestion' :
            !selectedContext || selectedContext.type === 'course' ? 'Select a section, subsection, or topic first' :
            card.apply_field === 'topic_full' && selectedContext.type !== 'topic' ? 'Select a Topic Box first' :
            card.apply_field === 'new_topic' && !['subsection', 'topic'].includes(selectedContext.type) ? 'Select a subsection or topic first' :
            card.apply_field === 'new_subsection' && !['section', 'subsection', 'topic'].includes(selectedContext.type) ? 'Select a section first' :
            'Apply to course'
          }
          style={{
            padding: '4px 12px',
            backgroundColor: canApply && !applied ? EDO_GREEN : '#E5E7EB',
            border: 'none',
            borderRadius: '5px',
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
            !card.apply_field ? 'Apply' :
            card.apply_field === 'topic_full' ? 'Apply to Topic Box' :
            card.apply_field === 'description' ? 'Apply Description' :
            card.apply_field === 'objectives' ? 'Apply Objectives' :
            card.apply_field === 'title' ? 'Apply Title' :
            card.apply_field === 'new_section' ? 'Add Section' :
            card.apply_field === 'new_subsection' ? 'Add Subsection' :
            card.apply_field === 'new_topic' ? 'Add Topic Box' :
            'Apply'
          )}
        </button>
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────
const EdoChatbot = ({ sections, courseName, formData, actions, currentUser, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedContext, setSelectedContext] = useState(null);
  const [isTreeOpen, setIsTreeOpen] = useState(false);
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
      text: `Hi! I'm Edo 👋 I'm here to help you design "${name}". Pick any part of your course from the structure menu, or ask me anything — I'll give you a few options to choose from.`,
    }]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 120);
  }, []);

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
      grade: formData?.class || '',
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
          const hint = '👆 To enable the "Add Topic Box" buttons above, select a Subsection from the Structure menu.';
          conclusion = conclusion ? `${conclusion}\n\n${hint}` : hint;
        } else if (hasNewSubsection && !['section', 'subsection', 'topic'].includes(selectedContext?.type)) {
          const hint = '👆 To enable the "Add Subsection" buttons above, select a Section from the Structure menu.';
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
    // ADD operations use current selectedContext so user can pick any target after seeing suggestions.
    // EDIT operations use the snapshot from when suggestions were generated (ctxOverride), falling back to current.
    const isAddOp = ['new_section', 'new_subsection', 'new_topic'].includes(card.apply_field);
    const ctx = isAddOp ? selectedContext : (ctxOverride || selectedContext);
    if (!card.apply_field) return;

    if (card.apply_field === 'new_section') {
      actions.addSectionWithContent(card.label, card.body);
      markApplied(messageId, cardIndex);
      addTextMessage('ai-text', `Added new section "${card.label}". ✓`);
      return;
    }

    if (!ctx) return;

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
      addTextMessage('ai-text', `Added new topic box "${card.label}". ✓`);
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
    }

    markApplied(messageId, cardIndex);
    addTextMessage('ai-text', `Applied "${card.label}" to ${ctx.type}: "${ctx.title}". ✓`);
  };

  const handleApplyBlocked = (card) => {
    let msg;
    if (!card.apply_field) {
      msg = "This suggestion is informational — use the Copy button to grab the text and paste it wherever you need it.";
    } else if (card.apply_field === 'topic_full') {
      msg = "To apply this, first select a Topic Box from the Structure menu above, then click Apply.";
    } else if (card.apply_field === 'new_subsection') {
      msg = "To add a subsection, first select a Section, Subsection, or Topic from the Structure menu above, then click Apply.";
    } else if (card.apply_field === 'new_topic') {
      msg = "To add a topic box, first select a Subsection or Topic from the Structure menu above, then click Apply.";
    } else {
      msg = "To apply this, first select a section, subsection, or topic from the Structure menu above — then click Apply on this card.";
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

  // ── Generate chip handlers ─────────────────────────────────────────────
  const handleChipClick = async (chip) => {
    if (isTyping) return;

    if (chip.action === 'add-section') {
      addTextMessage('user', chip.label);
      setIsTyping(true);
      try {
        const result = await actions.handleGenerateSections({
          level: 'sections',
          context: {
            course: { title: courseName, description: formData?.objectives || '', grade: formData?.class || '' },
            existing_sections: sections.filter(s => s.type !== 'break').map(s => ({ title: s.title, description: s.description || '' })),
          },
          userGuidance: null, count: 1,
        });
        if (result?.success === false) throw new Error(result.error);
        addTextMessage('ai-text', `Done! I've added a new section to your course. Check the bottom of the workspace!`);
      } catch {
        addTextMessage('ai-text', 'I had trouble generating a section. Please try again.');
      } finally {
        setIsTyping(false);
      }

    } else if (chip.action === 'add-subsection' && selectedContext?.type === 'section') {
      addTextMessage('user', chip.label);
      setIsTyping(true);
      const sec = sections.find(s => s.id === selectedContext.id);
      try {
        const result = await actions.handleGenerateSubsections(selectedContext.id, {
          level: 'subsections',
          context: {
            course: { title: courseName, description: formData?.objectives || '', grade: formData?.class || '' },
            current_section: {
              title: sec?.title || 'Unknown', description: sec?.description || '',
              existingSubsections: (sec?.subsections || []).map(s => ({ title: s.title, description: s.description })),
            },
            all_section_names: sections.filter(s => s.type !== 'break').map(s => s.title),
            other_sections: sections.filter(s => s.type !== 'break' && s.id !== selectedContext.id)
              .map(s => ({ title: s.title, description: s.description, subsections: (s.subsections || []).map(ss => ss.title) })),
          },
          userGuidance: null, count: 1,
        });
        if (result?.success === false) throw new Error(result.error);
        addTextMessage('ai-text', `Done! Added a subsection to "${sec?.title}". Ready to fill in!`);
      } catch {
        addTextMessage('ai-text', 'I had trouble generating a subsection. Please try again.');
      } finally {
        setIsTyping(false);
      }

    } else if (chip.action === 'add-topic' && selectedContext?.type === 'subsection') {
      addTextMessage('user', chip.label);
      setIsTyping(true);
      const parentSecId = selectedContext.sectionId;
      const parentSec = sections.find(s => s.id === parentSecId);
      const parentSub = parentSec?.subsections?.find(ss => ss.id === selectedContext.id);
      if (!parentSecId) {
        addTextMessage('ai-text', 'Could not find the parent section. Try selecting the subsection again from the Structure menu.');
        setIsTyping(false);
        return;
      }
      try {
        const result = await actions.handleGenerateTopicBoxes(parentSecId, selectedContext.id, {
          level: 'topics',
          context: {
            course: { title: courseName, grade: formData?.class || '', description: formData?.objectives || '' },
            current_section: { title: parentSec?.title || '', description: parentSec?.description || '' },
            subsection: {
              title: parentSub?.title || selectedContext.title, description: parentSub?.description || '',
              existingTopics: (parentSub?.topicBoxes || []).map(t => ({ title: t.title, description: t.description })),
            },
            other_sections: sections.filter(s => s.type !== 'break' && s.id !== parentSecId)
              .map(s => ({ title: s.title, description: s.description, subsections: (s.subsections || []).map(ss => ss.title) })),
            sibling_subsections: (parentSec?.subsections || []).filter(ss => ss.id !== selectedContext.id)
              .map(ss => ({ title: ss.title, description: ss.description })),
          },
          userGuidance: null, count: 1,
        });
        if (result?.success === false) throw new Error(result.error);
        addTextMessage('ai-text', `Done! Added a topic box to "${parentSub?.title || selectedContext.title}". Click it to add details!`);
      } catch {
        addTextMessage('ai-text', 'I had trouble generating a topic box. Please try again.');
      } finally {
        setIsTyping(false);
      }

    } else if (chip.action === 'find-videos' || chip.action === 'gen-activity' || chip.action === 'gen-worksheet') {
      if (!selectedContext || selectedContext.type !== 'topic') {
        addTextMessage('ai-text', 'Please select a topic box from the Structure menu first!');
        return;
      }
      let foundTopic = null;
      outer: for (const s of sections) {
        for (const ss of (s.subsections || [])) {
          const t = (ss.topicBoxes || []).find(t => t.id === selectedContext.id);
          if (t) { foundTopic = t; break outer; }
        }
      }
      if (!foundTopic) {
        addTextMessage('ai-text', "I couldn't find that topic. Try selecting it again from the Structure menu.");
        return;
      }
      addTextMessage('user', chip.label);
      setIsTyping(true);

      if (chip.action === 'find-videos') {
        const result = await actions.generateVideosFromBackend(foundTopic);
        setIsTyping(false);
        if (result?.success) {
          addTextMessage('ai-text', `Done! Found ${result.count} video${result.count !== 1 ? 's' : ''} for "${foundTopic.title}". Open the topic box and check the Resources tab to see them.`);
        } else {
          addTextMessage('ai-text', `I wasn't able to find videos for "${foundTopic.title}" right now. (Error: ${result?.error || 'unknown'})`);
        }

      } else if (chip.action === 'gen-activity') {
        const result = await actions.generateResource(foundTopic.id, 'activity');
        setIsTyping(false);
        if (result?.success) {
          addTextMessage('ai-text', `Done! Generated an activity${result.title ? ` — "${result.title}"` : ''} for "${foundTopic.title}". Open the topic box and check the Resources tab.`);
        } else {
          addTextMessage('ai-text', `I wasn't able to generate an activity for "${foundTopic.title}" right now. (Error: ${result?.error || 'unknown'})`);
        }

      } else if (chip.action === 'gen-worksheet') {
        const result = await actions.generateResource(foundTopic.id, 'worksheet');
        setIsTyping(false);
        if (result?.success) {
          addTextMessage('ai-text', `Done! Generated a worksheet${result.title ? ` — "${result.title}"` : ''} for "${foundTopic.title}". Open the topic box and check the Resources tab.`);
        } else {
          addTextMessage('ai-text', `I wasn't able to generate a worksheet for "${foundTopic.title}" right now. (Error: ${result?.error || 'unknown'})`);
        }
      }

    } else {
      addTextMessage('user', chip.label);
      await sendToAI(chip.label);
    }
  };

  const handleContextSelect = (ctx) => {
    setSelectedContext(ctx);
    setIsTreeOpen(false);
    const name = ctx?.title || courseName;
    const type = ctx?.type || 'course';
    if (type === 'topic') {
      addTextMessage('ai-text', `Focused on topic box: "${name}". I can help you with:\n• Description — what this topic covers\n• Learning objectives — what students will be able to do\n• Videos — use the ✨ Find video resources chip\n• Activities — use the ✨ Generate activity chip\n• Worksheets — use the ✨ Generate worksheet chip\n\nWhat would you like to work on?`);
    } else {
      addTextMessage('ai-text', `Focused on ${type}: "${name}". What would you like help with?`);
    }
  };

  const chips = QUICK_CHIPS[selectedContext?.type || 'course'];
  const regularSections = sections.filter(s => s.type !== 'break');

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
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, gap: '8px', position: 'relative',
      }}>
        <span style={{
          fontSize: '12.7px', color: '#78716C', fontFamily: "'DM Sans', sans-serif",
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {getContextDot()}{' '}
          <span style={{ color: '#1C1917', fontWeight: '600' }}>{getContextLabel()}</span>
        </span>
        <button
          onClick={() => setIsTreeOpen(p => !p)}
          style={{
            padding: '3px 8px', backgroundColor: 'white',
            border: '1px solid #E7E5E4', borderRadius: '5px', cursor: 'pointer',
            fontSize: '12.1px', fontWeight: '600', color: '#78716C',
            display: 'flex', alignItems: 'center', gap: '3px',
            flexShrink: 0, fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Structure <ChevronDown size={11} />
        </button>

        {/* Tree dropdown */}
        {isTreeOpen && (
          <>
            <div onClick={() => setIsTreeOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1 }} />
            <div style={{
              position: 'absolute', top: '100%', right: 0,
              backgroundColor: 'white', border: '1px solid #E7E5E4', borderRadius: '8px',
              boxShadow: '0 4px 18px rgba(0,0,0,0.13)',
              zIndex: 2, width: '260px', maxHeight: '300px', overflowY: 'auto', marginTop: '4px',
            }}>
              <button
                onClick={() => handleContextSelect(null)}
                style={{
                  width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none',
                  backgroundColor: !selectedContext ? '#F0FDF4' : 'transparent',
                  cursor: 'pointer', fontSize: '13.2px', fontWeight: '600', color: '#1C1917',
                  display: 'flex', alignItems: 'center', gap: '7px',
                  fontFamily: "'DM Sans', sans-serif", borderBottom: '1px solid #F5F5F4',
                }}
              >
                <span>📚</span> {courseName || 'Whole Course'}
              </button>

              {regularSections.map((sec, sIdx) => (
                <div key={sec.id}>
                  <button
                    onClick={() => handleContextSelect({ type: 'section', id: sec.id, title: sec.title })}
                    style={{
                      width: '100%', textAlign: 'left', padding: '7px 12px', border: 'none',
                      backgroundColor: selectedContext?.id === sec.id && selectedContext?.type === 'section' ? '#F0FDF4' : 'transparent',
                      cursor: 'pointer', fontSize: '13.2px', fontWeight: '600', color: '#1C1917',
                      display: 'flex', alignItems: 'center', gap: '7px', fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#52A67A', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sIdx + 1}. {sec.title}
                    </span>
                  </button>

                  {(sec.subsections || []).map((sub, subIdx) => (
                    <div key={sub.id}>
                      <button
                        onClick={() => handleContextSelect({ type: 'subsection', id: sub.id, title: sub.title, sectionId: sec.id })}
                        style={{
                          width: '100%', textAlign: 'left', padding: '6px 12px 6px 28px', border: 'none',
                          backgroundColor: selectedContext?.id === sub.id && selectedContext?.type === 'subsection' ? '#EFF6FF' : 'transparent',
                          cursor: 'pointer', fontSize: '12.7px', fontWeight: '500', color: '#44403C',
                          display: 'flex', alignItems: 'center', gap: '6px', fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        <span style={{ width: '3px', height: '14px', backgroundColor: '#5B8FBD', borderRadius: '2px', flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sIdx + 1}.{subIdx + 1} {sub.title}
                        </span>
                      </button>

                      {(sub.topicBoxes || []).map(topic => (
                        <button
                          key={topic.id}
                          onClick={() => handleContextSelect({ type: 'topic', id: topic.id, title: topic.title, subsectionId: sub.id, sectionId: sec.id })}
                          style={{
                            width: '100%', textAlign: 'left', padding: '5px 12px 5px 44px', border: 'none',
                            backgroundColor: selectedContext?.id === topic.id && selectedContext?.type === 'topic' ? '#FEF9EE' : 'transparent',
                            cursor: 'pointer', fontSize: '12.1px', fontWeight: '400', color: '#57534E',
                            display: 'flex', alignItems: 'center', gap: '6px', fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          <span style={{ width: '6px', height: '6px', backgroundColor: '#C2547A', borderRadius: '1px', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topic.title}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ))}

              {regularSections.length === 0 && (
                <div style={{ padding: '12px', fontSize: '13.2px', color: '#9CA3AF', textAlign: 'center' }}>No sections yet</div>
              )}
            </div>
          </>
        )}
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
                      onApply={(c, i) => applyCard(msg.id, c, i, msg.generatedContext)}
                      onApplyBlocked={handleApplyBlocked}
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

      {/* Quick chips */}
      <div style={{
        padding: '6px 10px', borderTop: '1px solid #F3F4F6',
        display: 'flex', gap: '5px', overflowX: 'auto', flexShrink: 0,
        scrollbarWidth: 'none',
      }}>
        {chips.map(chip => (
          <button
            key={chip.label}
            onClick={() => handleChipClick(chip)}
            disabled={isTyping}
            style={{
              padding: '4px 10px',
              backgroundColor: chip.isGenerate ? '#DCFCE7' : 'white',
              border: `1px solid ${chip.isGenerate ? '#86EFAC' : '#E7E5E4'}`,
              borderRadius: '20px', cursor: isTyping ? 'not-allowed' : 'pointer',
              fontSize: '12.7px', fontWeight: '500',
              color: chip.isGenerate ? '#166534' : '#44403C',
              whiteSpace: 'nowrap', flexShrink: 0,
              fontFamily: "'DM Sans', sans-serif",
              opacity: isTyping ? 0.55 : 1, transition: 'all 0.15s',
            }}
          >
            {chip.isGenerate && <span style={{ marginRight: '3px' }}>✨</span>}
            {chip.label}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div style={{
        padding: '9px 11px', borderTop: '1px solid #E7E5E4',
        display: 'flex', gap: '8px', alignItems: 'center',
        flexShrink: 0, backgroundColor: 'white',
      }}>
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputText); } }}
          placeholder="Ask Edo anything…"
          disabled={isTyping}
          style={{
            flex: 1, padding: '8px 12px',
            border: '1px solid #E7E5E4', borderRadius: '22px',
            outline: 'none', fontSize: '14.3px',
            fontFamily: "'DM Sans', sans-serif",
            backgroundColor: isTyping ? '#F9F9F8' : 'white', color: '#1C1917',
          }}
        />
        <button
          onClick={() => sendMessage(inputText)}
          disabled={!inputText.trim() || isTyping}
          style={{
            width: '34px', height: '34px', borderRadius: '50%',
            backgroundColor: inputText.trim() && !isTyping ? EDO_GREEN : '#E5E7EB',
            border: 'none', cursor: inputText.trim() && !isTyping ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'background-color 0.15s',
          }}
        >
          <Send size={14} color={inputText.trim() && !isTyping ? 'white' : '#9CA3AF'} />
        </button>
      </div>
    </div>
  );
};

export default EdoChatbot;
