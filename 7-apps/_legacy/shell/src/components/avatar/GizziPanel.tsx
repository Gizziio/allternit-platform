/**
 * GizziPanel Component - Production UX
 *
 * Expanded mode panel for Gizzi presence.
 * Rendered at shell level (outside PresenceTransition).
 *
 * Features:
 * - Spring-like open animation
 * - Backdrop click-to-close
 * - Focus management
 * - Keyboard shortcuts
 * - Reduced motion support
 */

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { ChatPanel } from './ChatPanel';
import { ConductorPanel } from './ConductorPanel';
import { CoworkPanel } from './CoworkPanel';
import { useSpeakingSignal } from '../../hooks/avatar/useSpeakingSignal';

type Mode = 'chat' | 'conductor' | 'cowork';

const MODE_INFO: Record<Mode, { label: string; icon: string }> = {
  chat: { label: 'Chat', icon: '💬' },
  conductor: { label: 'Conductor', icon: '🎛️' },
  cowork: { label: 'Cowork', icon: '🤖' },
};

interface GizziPanelProps {
  onClose: () => void;
  initialMode?: Mode;
}

export const GizziPanel: React.FC<GizziPanelProps> = ({
  onClose,
  initialMode = 'cowork',
}) => {
  const [activeMode, setActiveMode] = useState<Mode>(initialMode);
  const [isVisible, setIsVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);
  const { isSpeaking } = useSpeakingSignal();

  // Animation on mount
  useEffect(() => {
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, []);

  // Focus management
  useEffect(() => {
    if (isVisible && firstFocusRef.current) {
      firstFocusRef.current.focus();
    }
  }, [isVisible]);

  // ESC to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [onClose]);

  // Backdrop click-to-close
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleModeChange = (mode: Mode) => {
    setActiveMode(mode);
  };

  const renderModeContent = () => {
    switch (activeMode) {
      case 'chat':
        return <ChatPanel onClose={onClose} />;
      case 'conductor':
        return <ConductorPanel onClose={onClose} />;
      case 'cowork':
        return <CoworkPanel onClose={onClose} />;
      default:
        return null;
    }
  };

  return (
    <div
      className="gizzi-panel-backdrop"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        padding: '24px',
        background: isVisible ? 'rgba(0, 0, 0, 0.2)' : 'transparent',
        transition: 'background 0.2s ease',
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
    >
      <div
        ref={panelRef}
        className="gizzi-panel"
        role="dialog"
        aria-label="Gizzi Presence Panel"
        data-mode={activeMode}
        style={{
          transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
          opacity: isVisible ? 1 : 0,
          transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease',
        }}
      >
        {/* Header with tabs */}
        <div className="gizzi-panel-shell-header">
          <div
            className="gizzi-panel-shell-tabs gizzi-tabs"
            role="tablist"
            aria-label="Mode selection"
          >
            {(Object.keys(MODE_INFO) as Mode[]).map((mode) => {
              const info = MODE_INFO[mode];
              const isActive = activeMode === mode;

              return (
                <button
                  key={mode}
                  ref={isActive ? firstFocusRef : null}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${mode}`}
                  className={`gizzi-tab ${isActive ? 'active' : ''}`}
                  onClick={() => handleModeChange(mode)}
                  onKeyDown={(e) => {
                    // Keyboard navigation between tabs
                    const modes = ['chat', 'conductor', 'cowork'];
                    const idx = modes.indexOf(mode);
                    if (e.key === 'ArrowRight') {
                      e.preventDefault();
                      handleModeChange(modes[(idx + 1) % modes.length]);
                    } else if (e.key === 'ArrowLeft') {
                      e.preventDefault();
                      handleModeChange(modes[(idx - 1 + modes.length) % modes.length]);
                    }
                  }}
                >
                  <span>{info.icon}</span>
                  <span>{info.label}</span>
                </button>
              );
            })}
          </div>

          <button
            className="gizzi-close-btn"
            onClick={onClose}
            aria-label="Close panel (ESC)"
            title="ESC to close"
          >
            ×
          </button>
        </div>

        {/* Mode content */}
        <div
          id={`panel-${activeMode}`}
          role="tabpanel"
          className="gizzi-panel-body"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {renderModeContent()}
        </div>

        {/* Footer */}
        <div
          className="gizzi-panel-footer"
          style={{
            padding: '12px 16px',
            background: 'rgba(0, 0, 0, 0.1)',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.6)',
          }}
        >
          <span>
            {isSpeaking ? '🎤 Speaking...' : 'Press ESC to close'}
          </span>
          <span style={{ opacity: 0.5 }}>
            {MODE_INFO[activeMode].label} mode
          </span>
        </div>

        {/* CSS for reduced motion */}
        <style>{`
          @media (prefers-reduced-motion: reduce) {
            .gizzi-panel {
              transition: none !important;
            }
            .gizzi-panel-backdrop {
              transition: none !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default GizziPanel;
