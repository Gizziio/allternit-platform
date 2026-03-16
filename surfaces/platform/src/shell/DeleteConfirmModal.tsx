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
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={onCancel}
      />
      
      {/* Modal content */}
      <div
        style={{
          position: 'relative',
          zIndex: 2147483648,
          background: 'linear-gradient(180deg, rgba(35,32,28,0.98), rgba(25,22,20,0.98))',
          borderRadius: 16,
          border: '1px solid rgba(212,176,140,0.25)',
          padding: '28px 32px',
          minWidth: 380,
          maxWidth: 460,
          boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.3)',
          pointerEvents: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <h3 style={{ 
          margin: '0 0 16px 0', 
          fontSize: 20, 
          fontWeight: 700, 
          color: '#f0c8aa',
          letterSpacing: '-0.01em',
        }}>
          {title}
        </h3>
        
        {/* Message */}
        <p style={{ 
          margin: '0 0 28px 0', 
          fontSize: 15, 
          color: '#a0a0a0',
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
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent',
              color: '#9b9b9b',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              pointerEvents: 'auto',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              e.currentTarget.style.color = '#b8b0aa';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#9b9b9b';
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
              background: 'linear-gradient(135deg, rgba(220,50,50,0.9) 0%, rgba(200,40,40,0.9) 100%)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(220,50,50,0.3)',
              transition: 'all 0.2s',
              pointerEvents: 'auto',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(220,50,50,0.4)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(220,50,50,0.3)';
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
