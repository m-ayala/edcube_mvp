// frontend/src/components/courses/AccessBanner.jsx
// Strip shown above an open course when the teacher's right to edit changed under them. It always
// offers the unsaved text, because nothing the teacher typed is ever dropped.
import { useState } from 'react';
import { LOCK_MESSAGES, copyText } from './courseAccess';

const btn = (primary) => ({
  height: '32px', padding: '0 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600,
  fontFamily: 'inherit', fontSize: '13.5px', flexShrink: 0,
  border: `1px solid ${primary ? '#7A5A00' : '#B9AE8E'}`,
  background: primary ? '#7A5A00' : '#fff', color: primary ? '#fff' : '#7A5A00',
});

const AccessBanner = ({ lock, getUnsavedText, onBack }) => {
  const [copied, setCopied] = useState(false);
  if (!lock) return null;
  const removed = lock === 'removed';
  const handleCopy = async () => {
    const ok = await copyText(getUnsavedText ? getUnsavedText() : '');
    setCopied(ok ? 'ok' : 'fail');
    setTimeout(() => setCopied(false), 2500);
  };
  return (
    <div role="alert" data-testid="access-banner" data-lock={lock} style={{
      padding: '12px 24px', flexShrink: 0, fontFamily: "'DM Sans', sans-serif", fontSize: '14px', lineHeight: 1.5,
      display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
      background: removed ? '#FDECEC' : '#FFF8E6',
      borderBottom: `1px solid ${removed ? '#F4B6B6' : '#F2D58A'}`,
      color: removed ? '#9B1C1C' : '#7A5A00',
    }}>
      <span style={{ flex: 1, minWidth: '220px' }}>{LOCK_MESSAGES[lock]}</span>
      {getUnsavedText && (
        <button type="button" onClick={handleCopy} style={btn(true)}>
          {copied === 'ok' ? 'Copied' : copied === 'fail' ? 'Copy failed' : 'Copy my unsaved changes'}
        </button>
      )}
      {removed && onBack && <button type="button" onClick={onBack} style={btn(false)}>Back to My courses</button>}
    </div>
  );
};

export default AccessBanner;
