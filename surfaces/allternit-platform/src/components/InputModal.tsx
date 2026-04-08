/**
 * InputModal — a styled, accessible replacement for window.prompt().
 *
 * Renders a centered dialog with a labelled input, Confirm and Cancel buttons.
 * Enter confirms; Escape cancels.
 */

import React, { useEffect, useRef, useState } from 'react';
import { tokens } from '@/design/tokens';
import { X } from '@phosphor-icons/react';

export interface InputModalProps {
  isOpen: boolean;
  /** Dialog heading / label above the input */
  title: string;
  /** Optional sub-label shown below the title */
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  maxLength?: number;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function InputModal({
  isOpen,
  title,
  description,
  placeholder = '',
  defaultValue = '',
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  maxLength = 200,
  onConfirm,
  onCancel,
}: InputModalProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-seed value when the dialog opens or defaultValue changes
  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
    }
  }, [isOpen, defaultValue]);

  // Focus + select-all when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="input-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: tokens.zindex.modal,
        backgroundColor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: tokens.radius.md,
          boxShadow: tokens.shadows.lg,
          padding: `${tokens.space.xl}px`,
          width: 400,
          maxWidth: 'calc(100vw - 32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.space.md,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            id="input-modal-title"
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            {title}
          </span>
          <button
            onClick={onCancel}
            aria-label="Cancel"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              borderRadius: tokens.radius.xs,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {description && (
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {description}
          </p>
        )}

        {/* Input */}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={maxLength}
          style={{
            width: '100%',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-default)',
            borderRadius: tokens.radius.sm,
            color: 'var(--text-primary)',
            fontSize: 14,
            padding: `${tokens.space.sm}px ${tokens.space.md}px`,
            outline: 'none',
            boxSizing: 'border-box',
            transition: `border-color ${tokens.motion.fast}`,
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--accent-chat)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--border-default)';
          }}
        />

        {/* Actions */}
        <div style={{ display: 'flex', gap: tokens.space.sm, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: `${tokens.space.sm}px ${tokens.space.lg}px`,
              borderRadius: tokens.radius.sm,
              border: '1px solid var(--border-default)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: `all ${tokens.motion.fast}`,
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!value.trim()}
            style={{
              padding: `${tokens.space.sm}px ${tokens.space.lg}px`,
              borderRadius: tokens.radius.sm,
              border: 'none',
              background: value.trim() ? 'var(--accent-chat)' : 'var(--bg-tertiary)',
              color: value.trim() ? '#fff' : 'var(--text-tertiary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: value.trim() ? 'pointer' : 'not-allowed',
              transition: `all ${tokens.motion.fast}`,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
