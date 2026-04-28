/**
 * DeleteConfirmModal - Unified delete confirmation modal for all rail items
 * Refactored to use the shared Modal component for consistent presentation.
 */

import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalButton } from '@/components/ui/Modal';

interface DeleteConfirmModalProps {
  title: string;
  itemName: string;
  itemType: 'task' | 'project' | 'conversation' | 'session' | 'agent-task';
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({
  title,
  itemName,
  itemType,
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) {
  const getDeleteMessage = () => {
    switch (itemType) {
      case 'project':
        return `Are you sure you want to delete the project "${itemName}"? All tasks in this project will be unassigned. This action cannot be undone.`;
      case 'conversation':
      case 'session':
        return `Are you sure you want to delete "${itemName}"? This will remove the conversation and all its messages. This action cannot be undone.`;
      case 'agent-task':
        return `Are you sure you want to delete the agent task "${itemName}"? This action cannot be undone.`;
      case 'task':
      default:
        return `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
    }
  };

  return (
    <Modal isOpen onClose={onCancel} size="small" usePortal>
      <ModalHeader title={title} onClose={onCancel} />
      <ModalBody>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 }}>
          {getDeleteMessage()}
        </p>
      </ModalBody>
      <ModalFooter>
        <ModalButton onClick={onCancel} variant="secondary">
          Cancel
        </ModalButton>
        <ModalButton onClick={onConfirm} variant="danger">
          Delete
        </ModalButton>
      </ModalFooter>
    </Modal>
  );
}
