/**
 * ConfirmModal — a styled, accessible replacement for window.confirm().
 *
 * Refactored to use the shared Modal component for consistent presentation.
 */

import React from 'react';
import { Warning } from '@phosphor-icons/react';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalButton } from '@/components/ui/Modal';

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
  return (
    <Modal isOpen={isOpen} onClose={onCancel} size="small">
      <ModalHeader title={title} onClose={onCancel} />
      <ModalBody>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {destructive && (
            <Warning
              size={24}
              weight="fill"
              color="var(--status-error)"
              style={{ flexShrink: 0, marginTop: 2 }}
            />
          )}
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 }}>
            {message}
          </p>
        </div>
      </ModalBody>
      <ModalFooter>
        <ModalButton onClick={onCancel} variant="secondary">
          {cancelLabel}
        </ModalButton>
        <ModalButton
          onClick={onConfirm}
          variant={destructive ? 'danger' : 'primary'}
        >
          {confirmLabel}
        </ModalButton>
      </ModalFooter>
    </Modal>
  );
}
