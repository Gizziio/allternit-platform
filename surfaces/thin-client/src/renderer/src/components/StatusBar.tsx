/**
 * Status Bar Component
 * 
 * Shows connection status and backend info
 */

import React from 'react';

interface StatusBarProps {
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  backend: 'cloud' | 'desktop';
  error?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  status,
  backend,
  error,
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return (
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <circle cx="12" cy="12" r="10" />
          </svg>
        );
      case 'connecting':
        return (
          <svg className="spin" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        );
      case 'error':
        return (
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
          </svg>
        );
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return backend === 'cloud' ? 'Connected to cloud' : 'Connected to desktop';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return error || 'Connection error';
      default:
        return 'Unknown status';
    }
  };

  return (
    <div className="status-bar" data-status={status}>
      <div className="status-left">
        <span className={`status-indicator status-${status}`}>
          {getStatusIcon()}
        </span>
        <span className="status-text">{getStatusText()}</span>
      </div>

      <div className="status-right">
        <span className="shortcut-hint">
          {window.thinClient.platform === 'darwin' ? '⌘+⇧+A' : 'Ctrl+Shift+A'} to toggle
        </span>
      </div>

      <style>{`
        .status-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--color-bg-secondary);
          border-top: 1px solid var(--color-border);
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          user-select: none;
        }
        
        .status-left {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }
        
        .status-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .status-connected {
          color: var(--color-success);
        }
        
        .status-connecting {
          color: var(--color-warning);
        }
        
        .status-disconnected {
          color: var(--color-text-tertiary);
        }
        
        .status-error {
          color: var(--color-error);
        }
        
        .status-text {
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .shortcut-hint {
          font-family: 'SF Mono', Monaco, monospace;
          opacity: 0.6;
        }
        
        .spin {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
