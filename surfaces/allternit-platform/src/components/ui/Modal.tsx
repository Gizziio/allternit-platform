/**
 * Modal - Unified modal component
 *
 * Problem: The codebase had 30+ modals each with their own backdrop,
 * border-radius, padding, shadow, and z-index. This created visual
 * inconsistency and made layering bugs inevitable.
 *
 * This component provides a single source of truth for modal presentation.
 * All modals should use this or be wrapped by it.
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Z } from '@/design/z-index';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'small' | 'medium' | 'large' | 'full';
  usePortal?: boolean;
  preventBackdropClose?: boolean;
  className?: string;
}

const SIZE_WIDTHS: Record<string, string> = {
  small: '380px',
  medium: '520px',
  large: '720px',
  full: '90vw',
};

export function Modal({
  isOpen,
  onClose,
  children,
  size = 'medium',
  usePortal = true,
  preventBackdropClose = false,
  className = '',
}: ModalProps): JSX.Element | null {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (preventBackdropClose) return;
    if (e.target === e.currentTarget) onClose();
  };

  const modal = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: Z.modalBackdrop,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--shell-overlay-backdrop, rgba(0,0,0,0.65))',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Content */}
      <div
        ref={contentRef}
        className={className}
        style={{
          position: 'relative',
          zIndex: Z.modal,
          width: '100%',
          maxWidth: SIZE_WIDTHS[size],
          maxHeight: '90vh',
          background: 'var(--shell-dialog-bg, var(--bg-elevated))',
          borderRadius: 16,
          border: '1px solid var(--shell-dialog-border, var(--border-subtle))',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          pointerEvents: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  );

  if (usePortal && typeof document !== 'undefined') {
    return createPortal(modal, document.body);
  }

  return modal;
}

// ------------------------------------------------------------------
// ModalHeader — consistent header with optional close button
// ------------------------------------------------------------------

interface ModalHeaderProps {
  title: string;
  onClose?: () => void;
  showClose?: boolean;
}

export function ModalHeader({ title, onClose, showClose = true }: ModalHeaderProps): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 24px',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <h2
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--text-primary)',
          margin: 0,
        }}
      >
        {title}
      </h2>
      {showClose && onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            fontSize: 20,
            lineHeight: 1,
            padding: 4,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Close modal"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// ModalBody — scrollable body area
// ------------------------------------------------------------------

interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalBody({ children, className = '' }: ModalBodyProps): JSX.Element {
  return (
    <div
      className={className}
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '20px 24px',
      }}
    >
      {children}
    </div>
  );
}

// ------------------------------------------------------------------
// ModalFooter — action button row
// ------------------------------------------------------------------

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalFooter({ children, className = '' }: ModalFooterProps): JSX.Element {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 12,
        padding: '16px 24px',
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      {children}
    </div>
  );
}

// ------------------------------------------------------------------
// ModalButton — consistent button styles for footers
// ------------------------------------------------------------------

interface ModalButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  type?: 'button' | 'submit';
}

export function ModalButton({
  children,
  onClick,
  variant = 'secondary',
  disabled = false,
  type = 'button',
}: ModalButtonProps): JSX.Element {
  const variants: Record<string, React.CSSProperties> = {
    primary: {
      background: 'var(--accent-primary)',
      color: 'var(--bg-primary)',
      border: 'none',
    },
    secondary: {
      background: 'transparent',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-subtle)',
    },
    danger: {
      background: 'var(--status-error)',
      color: '#fff',
      border: 'none',
    },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '10px 20px',
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...variants[variant],
      }}
    >
      {children}
    </button>
  );
}
