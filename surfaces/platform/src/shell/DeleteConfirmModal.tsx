/**
 * DeleteConfirmModal - Unified delete confirmation modal for all rail items
 * Uses React Portal to render at document body level for proper z-index stacking
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

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
  onConfirm 
}: DeleteConfirmModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleEscape);
    
    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = originalOverflow;
      setMounted(false);
    };
  }, [onCancel]);

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

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 2147483647,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Full screen backdrop - blocks all clicks */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2147483647,
          background: 'var(--shell-overlay-backdrop)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={onCancel}
      />
      
      {/* Modal content */}
      <div
        style={{
          position: 'relative',
          zIndex: 2147483648,
          background: 'var(--shell-dialog-bg)',
          borderRadius: 16,
          border: '1px solid var(--shell-dialog-border)',
          padding: '28px 32px',
          minWidth: 380,
          maxWidth: 460,
          boxShadow: 'var(--shadow-xl)',
          pointerEvents: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <h3 style={{ 
          margin: '0 0 16px 0', 
          fontSize: 20, 
          fontWeight: 700, 
          color: 'var(--shell-dialog-title)',
          letterSpacing: '-0.01em',
        }}>
          {title}
        </h3>
        
        {/* Message */}
        <p style={{ 
          margin: '0 0 28px 0', 
          fontSize: 15, 
          color: 'var(--shell-dialog-text)',
          lineHeight: 1.6,
        }}>
          {getDeleteMessage()}
        </p>
        
        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '11px 22px',
              borderRadius: 10,
              border: '1px solid var(--ui-border-default)',
              background: 'transparent',
              color: 'var(--ui-text-secondary)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              pointerEvents: 'auto',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--shell-item-hover)';
              e.currentTarget.style.color = 'var(--shell-item-fg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--ui-text-secondary)';
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '11px 22px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--shell-danger-bg)',
              color: 'var(--shell-danger-fg)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.2s',
              pointerEvents: 'auto',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--shell-danger-bg-hover)';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--shell-danger-bg)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );

  // Use portal to render at body level
  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}

export default DeleteConfirmModal;
