/**
 * InputModal — a styled, accessible replacement for window.prompt().
 *
 * Refactored to use the shared Modal component for consistent presentation.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalButton } from '@/components/ui/Modal';

export interface InputModalProps {
  isOpen: boolean;
  title: string;
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

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
    }
  }, [isOpen, defaultValue]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} size="small">
      <ModalHeader title={title} onClose={onCancel} />
      <ModalBody>
        {description && (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>
            {description}
          </p>
        )}
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
            borderRadius: 8,
            color: 'var(--text-primary)',
            fontSize: 14,
            padding: '10px 14px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </ModalBody>
      <ModalFooter>
        <ModalButton onClick={onCancel} variant="secondary">
          {cancelLabel}
        </ModalButton>
        <ModalButton
          onClick={handleConfirm}
          variant="primary"
          disabled={!value.trim()}
        >
          {confirmLabel}
        </ModalButton>
      </ModalFooter>
    </Modal>
  );
}
