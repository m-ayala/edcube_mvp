// frontend/src/components/courseBuilder/Modal.jsx
// Accessible modal for the Course Builder: role=dialog, aria-modal, focus moves in on open,
// Tab is trapped inside, Escape calls onCancel (when given), and focus returns to whatever
// had it before the dialog opened. Styling follows the existing confirmation dialogs.
import { useEffect, useRef } from 'react';
import { FONT } from '../../constants/editorTheme';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Modal = ({ titleId, title, onCancel, children, maxWidth = 440, initialFocusRef }) => {
  const boxRef = useRef(null);
  const cancelRef = useRef(onCancel);
  useEffect(() => { cancelRef.current = onCancel; });

  useEffect(() => {
    const previous = document.activeElement;
    const box = boxRef.current;
    const first = initialFocusRef?.current || box.querySelector(FOCUSABLE) || box;
    first.focus();
    const onKey = (e) => {
      if (e.key === 'Escape' && cancelRef.current) {
        e.preventDefault();
        e.stopPropagation();
        cancelRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(box.querySelectorAll(FOCUSABLE));
      if (items.length === 0) { e.preventDefault(); box.focus(); return; }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === firstEl || document.activeElement === box)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      } else if (!box.contains(document.activeElement)) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) previous.focus();
    };
  }, [initialFocusRef]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000, fontFamily: FONT }}>
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ background: '#FFFFFF', borderRadius: 12, padding: 24, width: '100%', maxWidth, maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: 12, outline: 'none' }}
      >
        <h3 id={titleId} style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#1f1f1f' }}>{title}</h3>
        {children}
      </div>
    </div>
  );
};

export default Modal;
