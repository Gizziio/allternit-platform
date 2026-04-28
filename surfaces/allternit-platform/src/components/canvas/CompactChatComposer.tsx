"use client";

import React, { useState, useRef, useCallback } from 'react';
import { PaperPlaneRight, Stop } from '@phosphor-icons/react';

interface CompactChatComposerProps {
  onSend: (text: string) => void;
  isLoading?: boolean;
  onStop?: () => void;
  placeholder?: string;
}

export function CompactChatComposer({
  onSend,
  isLoading,
  onStop,
  placeholder = 'Ask anything...',
}: CompactChatComposerProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, isLoading, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    setText(el.value);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        padding: '8px 10px',
        background: 'var(--surface-hover)',
        borderTop: '1px solid var(--ui-border-muted)',
      }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        style={{
          flex: 1,
          minHeight: 28,
          maxHeight: 120,
          padding: '6px 10px',
          borderRadius: 10,
          border: '1px solid var(--ui-border-muted)',
          background: 'var(--surface-hover)',
          color: 'var(--text-primary)',
          fontSize: 13,
          lineHeight: 1.4,
          outline: 'none',
          resize: 'none',
          fontFamily: 'inherit',
        }}
      />
      {isLoading ? (
        <button
          onClick={onStop}
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            border: 'none',
            background: 'var(--ui-border-muted)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Stop size={16} />
        </button>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            border: 'none',
            background: text.trim() ? 'var(--accent-primary)' : 'var(--ui-border-muted)',
            color: text.trim() ? 'var(--shell-frame-bg)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: text.trim() ? 'pointer' : 'default',
            flexShrink: 0,
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          <PaperPlaneRight size={16} />
        </button>
      )}
    </div>
  );
}
