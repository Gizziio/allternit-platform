/**
 * SelectorPicker component (placeholder)
 * 
 * For future enhancement: allows picking from multiple generated selectors
 */

import React from 'react';

interface SelectorPickerProps {
  selectors: string[];
  selected?: string;
  onSelect: (selector: string) => void;
}

export function SelectorPicker({ selectors, selected, onSelect }: SelectorPickerProps) {
  return (
    <div style={styles.container}>
      <div style={styles.title}>Select Best Selector</div>
      <div style={styles.list}>
        {selectors.map((selector, index) => (
          <button
            key={index}
            onClick={() => onSelect(selector)}
            style={{
              ...styles.selectorButton,
              ...(selected === selector ? styles.selectorButtonSelected : {}),
            }}
          >
            {selector}
          </button>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    color: '#475569',
    marginBottom: 12,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  selectorButton: {
    padding: '8px 12px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#1e293b',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s',
  },
  selectorButtonSelected: {
    backgroundColor: '#8b5cf6',
    borderColor: '#7c3aed',
    color: '#ffffff',
  },
};
