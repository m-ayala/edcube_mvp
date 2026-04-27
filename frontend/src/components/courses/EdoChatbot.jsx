// src/components/courses/EdoChatbot.jsx
import { useState, useRef, useEffect } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { X, Send, Check, Copy, Minus, GripVertical } from 'lucide-react';
import { chatWithEdo } from '../../utils/curriculumApi';
import { BLOCK_CATEGORIES } from '../../constants/blockCategories';

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
  new_resource_content: 'BLOCK',
  new_resource_worksheet: 'BLOCK',
  new_resource_activity: 'BLOCK',
  block_content: 'BLOCK_EDIT',
  description: 'FIELD_EDIT',
  title: 'FIELD_EDIT',
  objectives: 'FIELD_EDIT',
};

const SuggestionCard = ({ card, index, applied, onAddToTray }) => {
  const [copied, setCopied] = useState(false);
  const [addedToTray, setAddedToTray] = useState(false);

  const trayType = ADD_TRAY_TYPE[card.apply_field] || null;

  const handleCopy = () => {
    navigator.clipboard.writeText(card.body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const handleAddToTray = () => {
    if (addedToTray || !onAddToTray || !trayType) return;
    onAddToTray(card, trayType);
    setAddedToTray(true);
  };

  const isInTray = applied || addedToTray;

  return (
    <div style={{
      backgroundColor: 'white',
      border: `1px solid ${isInTray ? '#86EFAC' : '#E7E5E4'}`,
      borderRadius: '10px',
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      transition: 'border-color 0.2s',
    }}>
      {/* Card label */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid #F3F4F6',
        backgroundColor: isInTray ? '#F0FDF4' : '#FAFAF8',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '6px',
      }}>
        <span style={{
          fontSize: '12.1px', fontWeight: '700', textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: isInTray ? '#16A34A' : '#78716C',
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {isInTray ? '✓ In Tray' : `Option ${index + 1}`}
        </span>
        <span style={{
          fontSize: '13.2px', fontWeight: '600', color: isInTray ? '#16A34A' : '#1C1917',
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

        {trayType && (
          <button
            onClick={handleAddToTray}
            disabled={isInTray}
            title={isInTray ? 'Already in tray' : 'Add to tray'}
            style={{
              padding: '4px 10px',
              backgroundColor: isInTray ? '#F0FDF4' : '#DCFCE7',
              border: `1px solid ${isInTray ? '#86EFAC' : '#4ADE80'}`,
              borderRadius: '5px',
              cursor: isInTray ? 'default' : 'pointer',
              fontSize: '12.7px', fontWeight: '600',
              color: isInTray ? '#16A34A' : '#166534',
              display: 'flex', alignItems: 'center', gap: '5px',
              fontFamily: "'DM Sans', sans-serif",
              transition: 'all 0.15s',
            }}
          >
            <GripVertical size={13} />
            {isInTray ? 'In Tray ↓' : '+ Add to Tray'}
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
};

const EdoChatbot = ({ sections, courseName, formData, actions, currentUser, onClose, trayItems = [], setTrayItems, handsOnResources = {}, currentPage = null }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedBlockType, setSelectedBlockType] = useState(null); // null | 'content' | 'worksheet' | 'activity'
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

  // Reset subcategory drill-down when page changes
  useEffect(() => {
    setSelectedBlockType(null);
  }, [currentPage?.page]);

  // Reset chat history when navigating to a different topic or subsection
  // (not when drilling down into a block and back — same topicId)
  useEffect(() => {
    if (!currentPage) return;
    const subject = currentPage.topicId || currentPage.subsectionId || currentPage.sectionId;
    if (!subject) return;
    const name = courseName || 'your course';
    setMessages([{
      id: 'welcome',
      kind: 'ai-text',
      text: `Hi! I'm Edo 👋 I'm here to help you design "${name}". Ask me anything about your course — I'll give you a few options to choose from.`,
    }]);
    setSelectedBlockType(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage?.topicId, currentPage?.subsectionId]);

  const addTextMessage = (kind, text) =>
    setMessages(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, kind, text }]);

  const addCardsMessage = (cards, intro, conclusion) =>
    setMessages(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, kind: 'ai-cards', cards, intro: intro || '', conclusion: conclusion || '', appliedCards: new Set() }]);

  const getContextLabel = () => {
    if (!currentPage) return courseName || 'Your Course';
    if (currentPage.page === 'subsection') return `Subsection: ${currentPage.subsectionTitle || ''}`;
    if (currentPage.page === 'topic') return `Topic: ${currentPage.topicTitle || ''}`;
    if (currentPage.page === 'block') return `Block: ${currentPage.blockTitle || ''}`;
    return courseName || 'Course Outline';
  };

  const getContextDot = () => {
    if (!currentPage || currentPage.page === 'outline') return '📚';
    if (currentPage.page === 'subsection') return '🔵';
    if (currentPage.page === 'topic') return '🟣';
    if (currentPage.page === 'block') return '🟠';
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

    const regularSecs = sections.filter(s => s.type !== 'break');
    const course_structure = regularSecs.map(s => ({
      title: s.title,
      subsections: (s.subsections || []).map(ss => ({
        title: ss.title,
        topic_boxes: (ss.topicBoxes || []).map(t => t.title),
      })),
    }));

    const current_page = currentPage?.page || 'outline';
    let selected_item = { type: 'course', title: courseName || '' };

    if (currentPage) {
      if (currentPage.page === 'subsection' && currentPage.subsectionId) {
        const sec = sections.find(s => s.id === currentPage.sectionId);
        const sub = sec?.subsections?.find(ss => ss.id === currentPage.subsectionId);
        selected_item = {
          type: 'subsection',
          parent_section: sec?.title || '',
          title: sub?.title || '',
          description: sub?.description || '',
          topic_boxes: (sub?.topicBoxes || []).map(t => t.title),
        };
      } else if (currentPage.page === 'topic' && currentPage.topicId) {
        const sec = sections.find(s => s.id === currentPage.sectionId);
        const sub = sec?.subsections?.find(ss => ss.id === currentPage.subsectionId);
        const topic = sub?.topicBoxes?.find(t => t.id === currentPage.topicId);
        selected_item = {
          type: 'topic',
          parent_section: sec?.title || '',
          parent_subsection: sub?.title || '',
          title: topic?.title || '',
          description: topic?.description || '',
          learning_objectives: topic?.learning_objectives || [],
          pla_pillars: topic?.pla_pillars || [],
          existing_blocks: (handsOnResources[currentPage.topicId] || []).map(b => ({ type: b.type, title: b.title })),
        };
      } else if (currentPage.page === 'block' && currentPage.blockId) {
        const block = (handsOnResources[currentPage.topicId] || []).find(b => b.id === currentPage.blockId);
        selected_item = {
          type: 'block',
          parent_topic: currentPage.topicTitle || '',
          title: block?.title || '',
          block_type: block?.type || '',
          category: block?.category || '',
          subcategory: block?.subcategory || '',
          block_content: block?.content || '',
        };
      }
    }

    return { course, course_structure, selected_item, current_page };
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
    }
    return history.slice(-10);
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
        addCardsMessage(data.suggestions, data.intro, data.conclusion || '');
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

  // ── Apply from tray ────────────────────────────────────────────────────
  const applyFromTray = (item) => {
    const { apply_field, body } = item.data;
    if (apply_field === 'block_content' && currentPage?.page === 'block') {
      actions.updateBlock?.(currentPage.topicId, currentPage.blockId, { content: body });
      addTextMessage('ai-text', 'Block content updated. ✓');
    } else if (apply_field === 'title' && currentPage?.subsectionId) {
      actions.updateSubsectionTitle(currentPage.sectionId, currentPage.subsectionId, body);
      addTextMessage('ai-text', 'Title applied. ✓');
    } else if (apply_field === 'description' && currentPage?.subsectionId && currentPage.page === 'subsection') {
      actions.updateSubsectionDescription(currentPage.sectionId, currentPage.subsectionId, body);
      addTextMessage('ai-text', 'Description applied. ✓');
    } else if (currentPage?.topicId) {
      const sec = sections.find(s => s.id === currentPage.sectionId);
      const sub = sec?.subsections?.find(ss => ss.id === currentPage.subsectionId);
      const topic = sub?.topicBoxes?.find(t => t.id === currentPage.topicId);
      if (!topic) return;
      if (apply_field === 'topic_full') {
        const objMatch = body.match(/\n\n?Objectives?:?\n/i);
        const description = objMatch ? body.slice(0, objMatch.index).trim() : body.trim();
        const objectivesText = objMatch ? body.slice(objMatch.index + objMatch[0].length) : '';
        const objectives = objectivesText.split('\n').map(s => s.replace(/^[-•*\d.]\s*/, '').trim()).filter(Boolean);
        actions.updateTopicBoxFull({ sectionId: currentPage.sectionId, subsectionId: currentPage.subsectionId, topicId: currentPage.topicId, updatedData: { ...topic, description, learning_objectives: objectives } });
        addTextMessage('ai-text', 'Topic updated. ✓');
      } else if (apply_field === 'description') {
        actions.updateTopicBoxFull({ sectionId: currentPage.sectionId, subsectionId: currentPage.subsectionId, topicId: currentPage.topicId, updatedData: { ...topic, description: body } });
        addTextMessage('ai-text', 'Description applied. ✓');
      } else if (apply_field === 'objectives') {
        const objectives = body.split('\n').map(s => s.replace(/^[-•*\d.]\s*/, '').trim()).filter(Boolean);
        actions.updateTopicBoxFull({ sectionId: currentPage.sectionId, subsectionId: currentPage.subsectionId, topicId: currentPage.topicId, updatedData: { ...topic, learning_objectives: objectives } });
        addTextMessage('ai-text', 'Objectives applied. ✓');
      }
    }
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

  // ── Generate handlers ──────────────────────────────────────────────────
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
      addTextMessage('ai-text', `Generated ${result.items.length} section${result.items.length !== 1 ? 's' : ''}! Drag it from the tray below into your course.`);
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
    try {
      const result = await actions.generateSubsectionsForTray({
        level: 'subsections',
        context: {
          course: { title: courseName, description: formData?.objectives || '', grade: formData?.class || '' },
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
      addTextMessage('ai-text', `Generated ${result.items.length} subsection${result.items.length !== 1 ? 's' : ''}! Drag it from the tray into any section.`);
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
    const parentSec = sections.find(s => s.id === currentPage?.sectionId);
    const parentSub = parentSec?.subsections?.find(ss => ss.id === currentPage?.subsectionId);
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
      addTextMessage('ai-text', `Generated ${result.items.length} topic box${result.items.length !== 1 ? 'es' : ''}! Use the "Add" button in the tray to add it.`);
    } catch (err) {
      addTextMessage('ai-text', `I had trouble generating the topic box. ${err?.message || 'Please try again.'}`);
    } finally {
      setIsTyping(false);
    }
  };

  const handleGenerateBlock = async (blockType, subcategory = null) => {
    if (isTyping) return;
    setSelectedBlockType(null);
    const typeLabels = { content: 'content block', worksheet: 'worksheet', activity: 'activity' };
    const typeLabel = typeLabels[blockType] || 'block';
    const message = subcategory
      ? `Generate a ${typeLabel} STRICTLY about "${subcategory}" for this topic. Focus ONLY on "${subcategory}" content — do NOT include sections from other subcategories (e.g. if generating Definitions, do not add Key Parts or How to teach it). Be thorough and detailed within this subcategory.`
      : `Generate a ${typeLabel} for this topic`;
    await sendMessage(message);
  };

  const handleEnhance = async () => {
    if (isTyping) return;
    const blockTitle = currentPage?.blockTitle || 'this block';
    await sendMessage(`Enhance and improve the content for "${blockTitle}"`);
  };


  // ── Render ─────────────────────────────────────────────────────────────

  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        title="Expand Edo"
        style={{
          width: '32px', flexShrink: 0, height: '100%',
          backgroundColor: EDO_ORANGE, borderLeft: '1px solid rgba(0,0,0,0.12)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', userSelect: 'none', gap: '10px',
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
          color: 'white', fontSize: '12.1px', fontWeight: '700',
          fontFamily: "'DM Sans', sans-serif", writingMode: 'vertical-rl',
          textOrientation: 'mixed', transform: 'rotate(180deg)', letterSpacing: '0.5px',
        }}>Edo AI</span>
      </div>
    );
  }

  // Tray items visible on current page
  const page = currentPage?.page || 'outline';
  const visibleTrayItems =
    page === 'outline' ? trayItems.filter(i => ['SECTION', 'SUBSECTION'].includes(i.type)) :
    page === 'subsection' ? trayItems.filter(i => ['TOPICBOX', 'FIELD_EDIT'].includes(i.type)) :
    page === 'topic' ? trayItems.filter(i => ['BLOCK', 'FIELD_EDIT'].includes(i.type)) :
    page === 'block' ? trayItems.filter(i => i.type === 'BLOCK_EDIT') :
    [];

  return (
    <div style={{
      width: '360px', flexShrink: 0, height: '100%',
      backgroundColor: '#FAFAF8', borderLeft: '1px solid #E7E5E4',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <style>{`
        @keyframes edoBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        backgroundColor: EDO_ORANGE, padding: '11px 14px',
        display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0,
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
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '4px' }}
          onMouseEnter={e => e.currentTarget.style.color = 'white'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
        >
          <Minus size={17} />
        </button>
        <button
          onClick={onClose}
          title="Close Edo (clears chat)"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '4px' }}
          onMouseEnter={e => e.currentTarget.style.color = 'white'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
        >
          <X size={17} />
        </button>
      </div>

      {/* Context bar */}
      <div style={{
        padding: '7px 11px', backgroundColor: '#F5F3EE',
        borderBottom: '1px solid #E7E5E4', display: 'flex', alignItems: 'center', flexShrink: 0,
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
                      onAddToTray={(c, type) => {
                        let data;
                        if (type === 'SECTION') {
                          data = { id: `section-${Date.now()}`, title: c.label, description: c.body, subsections: [] };
                        } else if (type === 'SUBSECTION') {
                          data = { id: `sub-${Date.now()}`, title: c.label, description: c.body, topicBoxes: [] };
                        } else if (type === 'BLOCK') {
                          const blockType =
                            c.apply_field === 'new_resource_content' ? 'content' :
                            c.apply_field === 'new_resource_worksheet' ? 'worksheet' : 'activity';
                          data = { id: `block-${Date.now()}`, type: blockType, title: c.label, content: c.body };
                        } else if (type === 'BLOCK_EDIT' || type === 'FIELD_EDIT') {
                          data = { label: c.label, body: c.body, apply_field: c.apply_field };
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

      {/* Generated Items Tray — page-scoped */}
      {visibleTrayItems.length > 0 && (
        <div style={{
          borderTop: '2px solid #E8761A', backgroundColor: '#FFFBF5',
          flexShrink: 0, maxHeight: '220px', overflowY: 'auto',
          scrollbarWidth: 'thin', scrollbarColor: '#E8E6E1 transparent',
        }}>
          <div style={{ padding: '7px 12px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{
              fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
              letterSpacing: '0.6px', color: '#E8761A', fontFamily: "'DM Sans', sans-serif",
            }}>
              {page === 'outline' ? 'Generated — Drag into Course' :
               page === 'subsection' ? 'Generated Topics & Edits' :
               page === 'topic' ? 'Generated Blocks & Edits' :
               page === 'block' ? 'Block Enhancements' :
               'Generated Items'}
            </span>
            <button
              onClick={() => setTrayItems(prev => prev.filter(i => !visibleTrayItems.some(v => v.id === i.id)))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif", padding: '2px 4px' }}
            >
              Clear
            </button>
          </div>

          {/* Outline page: Sections (draggable) */}
          {page === 'outline' && visibleTrayItems.some(i => i.type === 'SECTION') && (
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
                              border: '1px solid #86EFAC', borderRadius: '20px',
                              fontSize: '12px', fontWeight: '600',
                              color: snapshot.isDragging ? 'white' : '#166534',
                              display: 'flex', alignItems: 'center', gap: '5px',
                              cursor: 'grab', userSelect: 'none',
                              fontFamily: "'DM Sans', sans-serif", maxWidth: '140px',
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

          {/* Outline page: Subsections (draggable) */}
          {page === 'outline' && visibleTrayItems.some(i => i.type === 'SUBSECTION') && (
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
                              border: '1px solid #93C5FD', borderRadius: '20px',
                              fontSize: '12px', fontWeight: '600',
                              color: snapshot.isDragging ? 'white' : '#1D4ED8',
                              display: 'flex', alignItems: 'center', gap: '5px',
                              cursor: 'grab', userSelect: 'none',
                              fontFamily: "'DM Sans', sans-serif", maxWidth: '140px',
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

          {/* Subsection page: Topic Boxes (button-based add) */}
          {page === 'subsection' && visibleTrayItems.some(i => i.type === 'TOPICBOX') && (
            <div style={{ padding: '0 10px 8px' }}>
              {visibleTrayItems.filter(i => i.type === 'TOPICBOX').map(item => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '7px 10px', backgroundColor: 'white',
                  border: '1.5px solid #E879F9', borderLeft: '4px solid #A21CAF',
                  borderRadius: '8px', marginBottom: '5px',
                }}>
                  <span style={{ padding: '2px 7px', backgroundColor: '#FAE8FF', color: '#86198F', borderRadius: '10px', fontSize: '10.5px', fontWeight: '700', flexShrink: 0, fontFamily: "'DM Sans', sans-serif" }}>
                    Topic
                  </span>
                  <span style={{ flex: 1, fontSize: '12.7px', color: '#1C1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}>
                    {item.data.title || 'Untitled'}
                  </span>
                  <button
                    onClick={() => {
                      actions.addTopicBoxWithContent?.(currentPage?.sectionId, currentPage?.subsectionId, item.data.title, item.data.description);
                      setTrayItems(prev => prev.filter(i => i.id !== item.id));
                      addTextMessage('ai-text', `Added topic "${item.data.title}" to subsection. ✓`);
                    }}
                    style={{ padding: '3px 9px', backgroundColor: '#FAE8FF', border: '1px solid #E879F9', borderRadius: '5px', cursor: 'pointer', fontSize: '12.1px', fontWeight: '700', color: '#86198F', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: "'DM Sans', sans-serif" }}
                  >
                    + Add
                  </button>
                  <button
                    onClick={() => setTrayItems(prev => prev.filter(i => i.id !== item.id))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0, lineHeight: 1, fontSize: '14px', flexShrink: 0 }}
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {/* FIELD_EDIT items (subsection + topic pages) */}
          {['subsection', 'topic'].includes(page) && visibleTrayItems.some(i => i.type === 'FIELD_EDIT') && (
            <div style={{ padding: '0 10px 8px' }}>
              {visibleTrayItems.filter(i => i.type === 'FIELD_EDIT').map(item => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '7px 10px', backgroundColor: 'white',
                  border: '1.5px solid #C4B5FD', borderLeft: '4px solid #7C3AED',
                  borderRadius: '8px', marginBottom: '5px',
                }}>
                  <span style={{ padding: '2px 7px', backgroundColor: '#F3EFFF', color: '#7C3AED', borderRadius: '10px', fontSize: '10.5px', fontWeight: '700', flexShrink: 0, fontFamily: "'DM Sans', sans-serif", textTransform: 'capitalize' }}>
                    {item.data.apply_field?.replace('_', ' ') || 'Edit'}
                  </span>
                  <span style={{ flex: 1, fontSize: '12.7px', color: '#1C1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}>
                    {item.data.label || item.data.body?.slice(0, 40) || 'Untitled'}
                  </span>
                  <button
                    onClick={() => {
                      applyFromTray(item);
                      setTrayItems(prev => prev.filter(i => i.id !== item.id));
                    }}
                    style={{ padding: '3px 9px', backgroundColor: '#F3EFFF', border: '1px solid #C4B5FD', borderRadius: '5px', cursor: 'pointer', fontSize: '12.1px', fontWeight: '700', color: '#7C3AED', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: "'DM Sans', sans-serif" }}
                  >
                    Apply ✓
                  </button>
                  <button
                    onClick={() => setTrayItems(prev => prev.filter(i => i.id !== item.id))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0, lineHeight: 1, fontSize: '14px', flexShrink: 0 }}
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {/* BLOCK_EDIT items (block page) */}
          {page === 'block' && visibleTrayItems.some(i => i.type === 'BLOCK_EDIT') && (
            <div style={{ padding: '0 10px 8px' }}>
              {visibleTrayItems.filter(i => i.type === 'BLOCK_EDIT').map(item => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '7px 10px', backgroundColor: 'white',
                  border: '1.5px solid #FDE68A', borderLeft: '4px solid #D97706',
                  borderRadius: '8px', marginBottom: '5px',
                }}>
                  <span style={{ padding: '2px 7px', backgroundColor: '#FFFBEB', color: '#D97706', borderRadius: '10px', fontSize: '10.5px', fontWeight: '700', flexShrink: 0, fontFamily: "'DM Sans', sans-serif" }}>
                    Enhancement
                  </span>
                  <span style={{ flex: 1, fontSize: '12.7px', color: '#1C1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}>
                    {item.data.label || 'Improved content'}
                  </span>
                  <button
                    onClick={() => {
                      applyFromTray(item);
                      setTrayItems(prev => prev.filter(i => i.id !== item.id));
                    }}
                    style={{ padding: '3px 9px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '5px', cursor: 'pointer', fontSize: '12.1px', fontWeight: '700', color: '#D97706', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: "'DM Sans', sans-serif" }}
                  >
                    Apply ✓
                  </button>
                  <button
                    onClick={() => setTrayItems(prev => prev.filter(i => i.id !== item.id))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0, lineHeight: 1, fontSize: '14px', flexShrink: 0 }}
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {/* Topic page: Block items (button-based add) */}
          {page === 'topic' && visibleTrayItems.some(i => i.type === 'BLOCK') && (
            <div style={{ padding: '0 10px 8px' }}>
              {visibleTrayItems.filter(i => i.type === 'BLOCK').map(item => {
                const meta = {
                  content:   { label: 'Content',   color: '#6B8FE8', bg: '#EAF0FF', border: '#BFD0F8' },
                  worksheet: { label: 'Worksheet',  color: '#C47A1A', bg: '#FFF3E8', border: '#F5C98A' },
                  activity:  { label: 'Activity',   color: '#1E7C43', bg: '#EDFFF3', border: '#86EFAC' },
                }[item.data.type] || { label: 'Block', color: '#555', bg: '#F5F5F5', border: '#DDD' };
                return (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '7px 10px', backgroundColor: 'white',
                    border: `1.5px solid ${meta.border}`, borderLeft: `4px solid ${meta.color}`,
                    borderRadius: '8px', marginBottom: '5px',
                  }}>
                    <span style={{ padding: '2px 7px', backgroundColor: meta.bg, color: meta.color, borderRadius: '10px', fontSize: '10.5px', fontWeight: '700', flexShrink: 0, fontFamily: "'DM Sans', sans-serif" }}>
                      {meta.label}
                    </span>
                    <span style={{ flex: 1, fontSize: '12.7px', color: '#1C1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}>
                      {item.data.title || 'Untitled'}
                    </span>
                    <button
                      onClick={() => {
                        actions.addBlock?.(currentPage?.topicId, item.data);
                        setTrayItems(prev => prev.filter(i => i.id !== item.id));
                        addTextMessage('ai-text', `Added ${meta.label.toLowerCase()} block to topic. ✓`);
                      }}
                      style={{ padding: '3px 9px', backgroundColor: meta.bg, border: `1px solid ${meta.border}`, borderRadius: '5px', cursor: 'pointer', fontSize: '12.1px', fontWeight: '700', color: meta.color, whiteSpace: 'nowrap', flexShrink: 0, fontFamily: "'DM Sans', sans-serif" }}
                    >
                      + Add
                    </button>
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

      {/* Bottom quick chips — page-aware */}
      {page === 'outline' && (
        <div style={{
          padding: '7px 10px', borderTop: '1px solid #E7E5E4',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px',
          flexShrink: 0, backgroundColor: '#FAFAF8',
        }}>
          {[
            { label: '+ Section', fn: handleGenerateSection },
            { label: '+ Subsection', fn: handleGenerateSubsection },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={btn.fn}
              disabled={isTyping}
              style={{
                padding: '7px 4px', backgroundColor: '#DCFCE7',
                border: '1.5px solid #86EFAC', borderRadius: '8px',
                cursor: isTyping ? 'not-allowed' : 'pointer',
                fontSize: '12.7px', fontWeight: '700', color: '#166534',
                fontFamily: "'DM Sans', sans-serif",
                opacity: isTyping ? 0.55 : 1, transition: 'all 0.15s', textAlign: 'center',
              }}
            >
              ✨ {btn.label}
            </button>
          ))}
        </div>
      )}

      {page === 'subsection' && (
        <div style={{
          padding: '7px 10px', borderTop: '1px solid #E7E5E4',
          flexShrink: 0, backgroundColor: '#FAFAF8',
        }}>
          <button
            onClick={handleGenerateTopicBox}
            disabled={isTyping}
            style={{
              width: '100%', padding: '7px 4px', backgroundColor: '#FAE8FF',
              border: '1.5px solid #E879F9', borderRadius: '8px',
              cursor: isTyping ? 'not-allowed' : 'pointer',
              fontSize: '12.7px', fontWeight: '700', color: '#86198F',
              fontFamily: "'DM Sans', sans-serif",
              opacity: isTyping ? 0.55 : 1, transition: 'all 0.15s', textAlign: 'center',
            }}
          >
            ✨ + Topic Box
          </button>
        </div>
      )}

      {page === 'topic' && !selectedBlockType && (
        <div style={{
          padding: '7px 10px', borderTop: '1px solid #E7E5E4',
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px',
          flexShrink: 0, backgroundColor: '#FAFAF8',
        }}>
          {[
            { label: '+ Content', type: 'content', color: '#6B8FE8', bg: '#EAF0FF', border: '#BFD0F8' },
            { label: '+ Worksheet', type: 'worksheet', color: '#C47A1A', bg: '#FFF3E8', border: '#F5C98A' },
            { label: '+ Activity', type: 'activity', color: '#1E7C43', bg: '#EDFFF3', border: '#86EFAC' },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={() => setSelectedBlockType(btn.type)}
              disabled={isTyping}
              style={{
                padding: '7px 4px', backgroundColor: btn.bg,
                border: `1.5px solid ${btn.border}`, borderRadius: '8px',
                cursor: isTyping ? 'not-allowed' : 'pointer',
                fontSize: '12.7px', fontWeight: '700', color: btn.color,
                fontFamily: "'DM Sans', sans-serif",
                opacity: isTyping ? 0.55 : 1, transition: 'all 0.15s', textAlign: 'center',
              }}
            >
              ✨ {btn.label}
            </button>
          ))}
        </div>
      )}

      {page === 'topic' && selectedBlockType && (() => {
        const TYPE_META = {
          content:   { label: 'Content', color: '#6B8FE8', bg: '#EAF0FF', border: '#BFD0F8' },
          worksheet: { label: 'Worksheet', color: '#C47A1A', bg: '#FFF3E8', border: '#F5C98A' },
          activity:  { label: 'Activity', color: '#1E7C43', bg: '#EDFFF3', border: '#86EFAC' },
        };
        const meta = TYPE_META[selectedBlockType];
        // Gather all subcategories for this block type, grouped by category (with colors)
        const subcategoryGroups = BLOCK_CATEGORIES
          .filter(cat => cat.allowedTypes.includes(selectedBlockType))
          .map(cat => ({
            color: cat.color,
            subs: cat.clusters
              ? cat.clusters.flatMap(c => c.subcategories)
              : cat.subcategories,
          }));

        return (
          <div style={{ borderTop: '1px solid #E7E5E4', flexShrink: 0, backgroundColor: '#FAFAF8' }}>
            {/* Header row: back + type label + any chip */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 10px 4px',
              borderBottom: '1px solid #F0EDE8',
            }}>
              <button
                onClick={() => setSelectedBlockType(null)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '12px', color: '#888', fontFamily: "'DM Sans', sans-serif",
                  padding: '2px 4px', flexShrink: 0,
                }}
              >
                ←
              </button>
              <span style={{
                fontSize: '11px', fontWeight: '700', color: meta.color,
                fontFamily: "'DM Sans', sans-serif", textTransform: 'uppercase', letterSpacing: '0.4px',
              }}>
                {meta.label} — pick a subcategory
              </span>
              <button
                onClick={() => handleGenerateBlock(selectedBlockType)}
                disabled={isTyping}
                style={{
                  marginLeft: 'auto', padding: '3px 9px',
                  backgroundColor: meta.bg, border: `1px solid ${meta.border}`,
                  borderRadius: '6px', cursor: isTyping ? 'not-allowed' : 'pointer',
                  fontSize: '11.5px', fontWeight: '700', color: meta.color,
                  fontFamily: "'DM Sans', sans-serif", flexShrink: 0,
                  opacity: isTyping ? 0.55 : 1,
                }}
              >
                Any ✨
              </button>
            </div>

            {/* Subcategory chips scrollable area */}
            <div style={{
              padding: '6px 10px 8px',
              maxHeight: '130px', overflowY: 'auto',
              display: 'flex', flexWrap: 'wrap', gap: '5px',
              scrollbarWidth: 'thin', scrollbarColor: '#E8E6E1 transparent',
            }}>
              {subcategoryGroups.map(({ color, subs }) =>
                subs.map(sub => (
                  <button
                    key={sub}
                    onClick={() => handleGenerateBlock(selectedBlockType, sub)}
                    disabled={isTyping}
                    style={{
                      padding: '4px 10px',
                      backgroundColor: color.bg,
                      border: `1px solid ${color.border}`,
                      borderRadius: '20px',
                      cursor: isTyping ? 'not-allowed' : 'pointer',
                      fontSize: '12px', fontWeight: '600', color: color.text,
                      fontFamily: "'DM Sans', sans-serif",
                      opacity: isTyping ? 0.55 : 1,
                      transition: 'all 0.12s',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { if (!isTyping) e.currentTarget.style.opacity = '0.75'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = isTyping ? '0.55' : '1'; }}
                  >
                    {sub}
                  </button>
                ))
              )}
            </div>
          </div>
        );
      })()}

      {page === 'block' && (
        <div style={{
          padding: '7px 10px', borderTop: '1px solid #E7E5E4',
          flexShrink: 0, backgroundColor: '#FAFAF8',
        }}>
          <button
            onClick={handleEnhance}
            disabled={isTyping}
            style={{
              width: '100%', padding: '7px 4px',
              backgroundColor: 'rgba(247,228,160,0.6)',
              border: '1.5px solid rgba(180,150,30,0.35)', borderRadius: '8px',
              cursor: isTyping ? 'not-allowed' : 'pointer',
              fontSize: '12.7px', fontWeight: '700', color: '#5C460A',
              fontFamily: "'DM Sans', sans-serif",
              opacity: isTyping ? 0.55 : 1, transition: 'all 0.15s', textAlign: 'center',
            }}
          >
            ✦ Enhance This Block
          </button>
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
