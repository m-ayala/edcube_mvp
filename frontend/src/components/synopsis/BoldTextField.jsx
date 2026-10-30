// frontend/src/components/synopsis/BoldTextField.jsx
//
// Drop-in replacement for the synopsis description <textarea>: an editable box
// where Ctrl+B / Cmd+B makes the selection bold and bold shows as bold. The
// value stays plain text with **bold** markers and \n line breaks — the same
// format the newsletter/synopsis doc builders (_add_md_text) and the AI
// enhance prompt already use — so stored entries are unchanged.

import { useRef, useEffect, useLayoutEffect } from 'react';

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const lineToHtml = (line) => {
  const parts = line.split('**');
  // An unclosed "**" stays literal instead of bolding the rest of the line.
  if (parts.length % 2 === 0) parts[parts.length - 2] += '**' + parts.pop();
  return parts.map((p, i) => (i % 2 === 1 && p ? `<b>${escapeHtml(p)}</b>` : escapeHtml(p))).join('');
};

const mdToHtml = (md) =>
  (md || '').split('\n').map((line) => `<div>${lineToHtml(line) || '<br>'}</div>`).join('');

const isBoldEl = (el) => {
  if (el.tagName === 'B' || el.tagName === 'STRONG') return true;
  const w = el.style?.fontWeight;
  return w === 'bold' || w === 'bolder' || parseInt(w, 10) >= 600;
};

const segmentsToMd = (segs) => {
  const merged = [];
  segs.forEach((s) => {
    const last = merged[merged.length - 1];
    if (last && last.bold === s.bold) last.text += s.text;
    else merged.push({ ...s });
  });
  return merged.map(({ text, bold }) => {
    if (!bold || !text.trim()) return text;
    // Keep spaces outside the markers so "** word**" never appears.
    const [, lead, core, trail] = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
    return `${lead}**${core}**${trail}`;
  }).join('');
};

const htmlToMd = (root) => {
  const lines = [[]];
  const cur = () => lines[lines.length - 1];
  const walk = (node, bold) => {
    node.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        if (n.nodeValue) cur().push({ text: n.nodeValue.replace(/\u00a0/g, ' '), bold });
        return;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      if (n.tagName === 'BR') { lines.push([]); return; }
      const block = n.tagName === 'DIV' || n.tagName === 'P';
      if (block && cur().length) lines.push([]);
      walk(n, bold || isBoldEl(n));
      if (block && cur().length) lines.push([]);
    });
  };
  walk(root, false);
  if (lines.length > 1 && !cur().length) lines.pop();
  return lines.map(segmentsToMd).join('\n');
};

export default function BoldTextField({ value, onChange, placeholder, style, minRows = 4, maxRows = 20, onFocus, onBlur }) {
  const ref = useRef(null);
  const lastMd = useRef(null);

  // Only rewrite the DOM when the value changed from outside (load, AI
  // enhance) — never on our own edits, which would reset the caret.
  useLayoutEffect(() => {
    if (ref.current && value !== lastMd.current) {
      ref.current.innerHTML = mdToHtml(value);
      lastMd.current = value;
    }
  }, [value]);

  useEffect(() => {
    try { document.execCommand('defaultParagraphSeparator', false, 'div'); } catch { /* unsupported */ }
  }, []);

  const emit = () => {
    const md = htmlToMd(ref.current);
    lastMd.current = md;
    onChange(md);
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      try { document.execCommand('styleWithCSS', false, false); } catch { /* unsupported */ }
      document.execCommand('bold');
      emit();
    }
  };

  // Paste as plain text so foreign formatting/markup doesn't leak in.
  const handlePaste = (e) => {
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  };

  const fontSize = parseFloat(style?.fontSize) || 15;
  const lineHeight = parseFloat(style?.lineHeight) || 1.65;
  const lineHeightPx = fontSize * lineHeight;

  return (
    <div style={{ position: 'relative' }}>
      {!value && placeholder && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none',
          padding: style?.padding, fontSize: style?.fontSize, lineHeight: style?.lineHeight,
          fontFamily: style?.fontFamily, color: '#9a9a9a', border: '1.5px solid transparent',
        }}>
          {placeholder}
        </div>
      )}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        title="Tip: select text and press Ctrl+B (⌘B on Mac) to make it bold"
        onInput={emit}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={onFocus}
        onBlur={onBlur}
        style={{
          ...style,
          minHeight: `calc(${minRows * lineHeightPx}px + 2 * 14px)`,
          maxHeight: `calc(${maxRows * lineHeightPx}px + 2 * 14px)`,
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      />
    </div>
  );
}
