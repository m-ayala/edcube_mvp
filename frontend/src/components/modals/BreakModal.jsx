// src/components/modals/BreakModal.jsx
import { useState } from 'react';

const BreakModal = ({ onConfirm, onCancel }) => {
  const [duration, setDuration] = useState('');
  const [unit, setUnit] = useState('minutes');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (duration && parseInt(duration) > 0) {
      onConfirm(duration, unit);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '30px',
          maxWidth: '400px',
          width: '90%'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: '20px' }}>
          ⏸️ Add Break
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Break Duration
            </label>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g., 10"
                min="1"
                required
                autoFocus
                style={{
                  flex: 1,
                  padding: '10px',
                  fontSize: '16px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
              
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                style={{
                  padding: '10px',
                  fontSize: '16px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              >
                <option value="minutes">minutes</option>
                <option value="hours">hours</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Cancel
            </button>
            
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: '#ffc107',
                color: '#000',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600'
              }}
            >
              Add Break
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BreakModal;