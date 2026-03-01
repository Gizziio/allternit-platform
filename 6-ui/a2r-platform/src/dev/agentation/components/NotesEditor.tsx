/**
 * NotesEditor component (placeholder)
 * 
 * For future enhancement: rich text editor for annotations
 */

import React from 'react';

interface NotesEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function NotesEditor({ value, onChange, placeholder }: NotesEditorProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || 'Add your notes here...'}
      style={styles.textarea}
      rows={6}
    />
  );
}

const styles: Record<string, React.CSSProperties> = {
  textarea: {
    width: '100%',
    padding: 12,
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    fontSize: 14,
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
};
