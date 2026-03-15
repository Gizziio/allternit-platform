/**
 * Header Component
 * 
 * Draggable header with app controls and connection status
 */

import React from 'react';

interface HeaderProps {
  backend: 'cloud' | 'desktop';
  onSettingsClick: () => void;
  onClearChat: () => void;
  isConnected?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  backend,
  onSettingsClick,
  onClearChat,
  isConnected = true,
}) => {
  return (
    <header className="header drag-region">
      <div className="header-left">
        <div className="logo">
          <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
            <path
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>A2R</span>
        </div>
        <div className="backend-indicator">
          <span className={`connection-dot ${isConnected ? 'connected' : 'disconnected'}`} />
          <span className="backend-badge" data-backend={backend}>
            {backend === 'cloud' ? 'Cloud' : 'Desktop'}
          </span>
        </div>
      </div>

      <div className="header-right no-drag">
        <button 
          className="icon-btn" 
          title="Clear chat"
          onClick={onClearChat}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>

        <button 
          className="icon-btn" 
          title="Settings (⌘,)"
          onClick={onSettingsClick}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        <button 
          className="icon-btn close-btn" 
          title="Hide (Esc)"
          onClick={() => window.thinClient.hideWindow()}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <style>{`
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--color-bg-primary);
          border-bottom: 1px solid var(--color-border);
          -webkit-app-region: drag;
          user-select: none;
          flex-shrink: 0;
        }
        
        .header-left {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }
        
        .logo {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          font-weight: 600;
          font-size: var(--font-size-md);
          color: var(--color-text-primary);
        }
        
        .logo svg {
          color: #D4956A;
        }
        
        .backend-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .connection-dot {
          width: 6px;
          height: 6px;
          border-radius: var(--radius-full);
          background: var(--color-text-tertiary);
          transition: background-color 0.3s ease;
        }
        
        .connection-dot.connected {
          background: var(--color-success);
          box-shadow: 0 0 6px rgba(34, 197, 94, 0.4);
        }
        
        .connection-dot.disconnected {
          background: var(--color-error);
          box-shadow: 0 0 6px rgba(239, 68, 68, 0.4);
        }
        
        .backend-badge {
          font-size: var(--font-size-xs);
          padding: 2px 8px;
          border-radius: var(--radius-full);
          background: var(--color-bg-tertiary);
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .backend-badge[data-backend="cloud"] {
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
        }
        
        .backend-badge[data-backend="desktop"] {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
        }
        
        .header-right {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
        }
        
        .icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: none;
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        
        .icon-btn:hover {
          background: var(--color-bg-hover);
          color: var(--color-text-primary);
        }
        
        .icon-btn.close-btn:hover {
          background: var(--color-error);
          color: white;
        }
      `}</style>
    </header>
  );
};
