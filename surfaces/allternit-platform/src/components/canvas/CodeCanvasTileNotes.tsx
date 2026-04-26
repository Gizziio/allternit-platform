"use client";

import React, { useState, useCallback } from 'react';
import { NotePencil } from '@phosphor-icons/react';

interface CodeCanvasTileNotesProps {
  initialContent?: string;
  onChange?: (content: string) => void;
}

export function CodeCanvasTileNotes({ initialContent = '', onChange }: CodeCanvasTileNotesProps) {
  const [content, setContent] = useState(initialContent);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      setContent(newContent);
      onChange?.(newContent);
    },
    [onChange],
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.02)',
          flexShrink: 0,
        }}
      >
        <NotePencil size={12} color="var(--text-tertiary)" />
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Notes</span>
      </div>
      <textarea
        value={content}
        onChange={handleChange}
        placeholder="Type notes here..."
        spellCheck={false}
        style={{
          flex: 1,
          minHeight: 0,
          padding: 12,
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          fontSize: 13,
          lineHeight: 1.6,
          resize: 'none',
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
}
