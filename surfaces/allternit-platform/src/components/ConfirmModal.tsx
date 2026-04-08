/**
 * ConfirmModal — a styled, accessible replacement for window.confirm().
 *
 * Renders a centered dialog with a message and two buttons.
 * Enter confirms; Escape cancels.
 */

import React, { useEffect, useRef } from 'react';
import { tokens } from '@/design/tokens';
import { Warning } from '@phosphor-icons/react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button in a destructive (red) style */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && confirmRef.current) {
      confirmRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div
      role="alertdialog"
      aria-modal
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
      onKeyDown={handleKeyDown}
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
        <div style={{ display: 'flex', gap: tokens.space.md, alignItems: 'flex-start' }}>
          {destructive && (
            <Warning
              size={24}
              weight="fill"
              color="#ef4444"
              style={{ flexShrink: 0, marginTop: 1 }}
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space.xs }}>
            <span
              id="confirm-modal-title"
              style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}
            >
              {title}
            </span>
            <p
              id="confirm-modal-desc"
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {message}
            </p>
          </div>
        </div>

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
            ref={confirmRef}
            onClick={onConfirm}
            style={{
              padding: `${tokens.space.sm}px ${tokens.space.lg}px`,
              borderRadius: tokens.radius.sm,
              border: 'none',
              background: destructive ? '#ef4444' : 'var(--accent-chat)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
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
