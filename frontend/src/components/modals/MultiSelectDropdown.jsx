// frontend/src/components/common/MultiSelectDropdown.jsx

import { useState, useRef, useEffect } from 'react';
import './MultiSelectDropdown.css';

const MultiSelectDropdown = ({ 
  options, 
  selectedValues, 
  onChange, 
  placeholder = "Select...",
  label 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (value) => {
    const newSelected = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    
    onChange(newSelected);
  };

  const handleSelectAll = () => {
    onChange(options);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length === 1) return selectedValues[0];
    return `${selectedValues.length} selected`;
  };

  return (
    <div className="multi-select-dropdown" ref={dropdownRef}>
      {label && <label className="multi-select-label">{label}</label>}
      
      {/* Dropdown Button */}
      <div 
        className="multi-select-button" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="multi-select-text">{getDisplayText()}</span>
        <span className={`multi-select-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="multi-select-menu">
          {/* Select All / Clear All */}
          <div className="multi-select-actions">
            <button 
              type="button"
              onClick={handleSelectAll}
              className="multi-select-action-btn"
            >
              Select All
            </button>
            <button 
              type="button"
              onClick={handleClearAll}
              className="multi-select-action-btn"
            >
              Clear All
            </button>
          </div>

          {/* Options List */}
          <div className="multi-select-options">
            {options.map((option) => (
              <label 
                key={option} 
                className="multi-select-option"
              >
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option)}
                  onChange={() => handleToggle(option)}
                />
                <span className="multi-select-checkbox">
                  {selectedValues.includes(option) ? '☑' : '☐'}
                </span>
                <span className="multi-select-option-text">{option}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;