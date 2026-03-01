/**
 * GizziDock Component - Production UX Polish
 *
 * Contains:
 * - OrbButton: Voice listening/TTS with visual states
 * - ModeBar: 3 mode icons with tooltips and keyboard nav
 * - StatusPip: Activity state indicator
 *
 * Features:
 * - Drag-to-reposition (persisted in localStorage)
 * - Proper hitboxes (36x36 minimum)
 * - Keyboard navigation (Tab/Enter/Space)
 * - Tooltips on hover/focus
 * - Reduced motion support
 * - Glassy UI consistent with shell
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAvatarState } from '../../hooks/avatar/useAvatarState';
import { useSpeakingSignal } from '../../hooks/avatar/useSpeakingSignal';
import { useAudioEnergy } from '../../hooks/avatar/useAudioEnergy';

type Mode = 'chat' | 'conductor' | 'cowork';
type ActivityStatus = 'idle' | 'connecting' | 'thinking' | 'streaming' | 'speaking' | 'done' | 'error';

interface GizziDockProps {
  VoiceOrbComponent: React.ComponentType<any>;
  voiceOrbProps: {
    isListening: boolean;
    onToggleListening: () => void;
    transcript?: string;
    onTranscript?: (text: string) => void;
  };
  orbSize?: number;
  onExpand: (mode: Mode) => void;
  bottomOffset?: string;
  rightOffset?: string;
}

interface DockPosition {
  x: number;
  y: number;
}

const DEFAULT_OFFSET = 16;
const MIN_MARGIN = 12;

function clampPosition(position: DockPosition): DockPosition {
  if (typeof window === 'undefined') return position;
  const maxX = Math.max(MIN_MARGIN, window.innerWidth - 80);
  const maxY = Math.max(MIN_MARGIN, window.innerHeight - 120);
  return {
    x: Math.min(Math.max(MIN_MARGIN, position.x), maxX),
    y: Math.min(Math.max(MIN_MARGIN, position.y), maxY),
  };
}

// Status colors
const STATUS_COLORS: Record<ActivityStatus, string> = {
  idle: 'rgba(96, 165, 250, 0.8)',       // blue
  connecting: 'rgba(245, 158, 11, 0.9)',  // amber
  thinking: 'rgba(139, 92, 246, 0.9)',    // violet
  streaming: 'rgba(59, 130, 246, 0.9)',   // blue
  speaking: 'rgba(16, 185, 129, 0.9)',    // green
  done: 'rgba(16, 185, 129, 0.8)',        // green
  error: 'rgba(239, 68, 68, 0.9)',        // red
};

const MODE_INFO: Record<Mode, { icon: string; label: string; shortcut: string }> = {
  chat: { icon: '💬', label: 'Chat', shortcut: '1' },
  conductor: { icon: '🎛️', label: 'Conductor', shortcut: '2' },
  cowork: { icon: '🤖', label: 'Cowork', shortcut: '3' },
};

export const GizziDock: React.FC<GizziDockProps> = ({
  VoiceOrbComponent,
  voiceOrbProps,
  orbSize = 56,
  onExpand,
  bottomOffset = `${DEFAULT_OFFSET}px`,
  rightOffset = `${DEFAULT_OFFSET}px`,
}) => {
  // Position state with localStorage persistence
  const [position, setPosition] = useState<DockPosition | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('gizzi-dock-position');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return clampPosition(parsed);
        }
      }
    } catch (e) {
      console.warn('[GizziDock] Failed to load position:', e);
    }
    return null;
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hoveredMode, setHoveredMode] = useState<Mode | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  const { status } = useAvatarState();
  const { isSpeaking } = useSpeakingSignal();
  const { energy } = useAudioEnergy();

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    const rect = dockRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (!position) {
      setPosition({ x: rect.left, y: rect.top });
    }
    
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = dockRef.current?.getBoundingClientRect();
      const width = rect?.width ?? 80;
      const height = rect?.height ?? 120;
      const maxX = Math.max(MIN_MARGIN, window.innerWidth - width - MIN_MARGIN);
      const maxY = Math.max(MIN_MARGIN, window.innerHeight - height - MIN_MARGIN);
      const x = Math.min(Math.max(MIN_MARGIN, e.clientX - dragOffset.x), maxX);
      const y = Math.min(Math.max(MIN_MARGIN, e.clientY - dragOffset.y), maxY);
      setPosition({ x, y });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // Persist position
      if (position) {
        try {
          localStorage.setItem('gizzi-dock-position', JSON.stringify(position));
        } catch (e) {
          console.warn('[GizziDock] Failed to persist position:', e);
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, position]);

  // Mode click handler
  const handleModeClick = useCallback((mode: Mode) => {
    onExpand(mode);
  }, [onExpand]);

  // Keyboard handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setHoveredMode(null);
    }
  }, []);

  // Get status color
  const statusColor = STATUS_COLORS[status as ActivityStatus] || STATUS_COLORS.idle;

  return (
    <div
      ref={dockRef}
      className="gizzi-dock"
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        left: position ? position.x : undefined,
        top: position ? position.y : undefined,
        right: position ? undefined : rightOffset,
        bottom: position ? undefined : bottomOffset,
        zIndex: 9999,
        opacity: 1,
        transform: 'none',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: '6px',
        cursor: isDragging ? 'grabbing' : 'default',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        outline: 'none',
      }}
      tabIndex={0}
      role="application"
      aria-label="Gizzi presence dock"
    >
      {/* Orb Button - Voice Interaction */}
      <div
        className="gizzi-orb-button"
        role="button"
        tabIndex={0}
        aria-label={voiceOrbProps.isListening ? 'Stop listening' : 'Start listening'}
        onClick={(e) => {
          e.stopPropagation();
          voiceOrbProps.onToggleListening();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            voiceOrbProps.onToggleListening();
          }
        }}
        style={{
          width: orbSize,
          height: orbSize,
          borderRadius: '50%',
          cursor: 'pointer',
          position: 'relative',
          transition: 'transform 0.15s ease',
        }}
      >
        <VoiceOrbComponent
          {...voiceOrbProps}
          isListening={voiceOrbProps.isListening}
          onToggleListening={voiceOrbProps.onToggleListening}
          size={orbSize}
          simple={true}
        />
        
        {/* Speaking energy ring */}
        {isSpeaking && (
          <div
            className="gizzi-speaking-ring"
            style={{
              position: 'absolute',
              inset: -4,
              borderRadius: '50%',
              border: `2px solid ${statusColor}`,
              opacity: 0.6,
              animation: 'gizzi-pulse 1s ease-in-out infinite',
            }}
          />
        )}
      </div>

      {/* Mode Bar - 3 mode buttons with tooltips */}
      <div
        className="gizzi-mode-bar"
        role="toolbar"
        aria-label="Mode selection"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          padding: '6px',
          background: 'rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(12px)',
          borderRadius: '14px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        {(Object.keys(MODE_INFO) as Mode[]).map((mode) => {
          const info = MODE_INFO[mode];
          const isHovered = hoveredMode === mode;

          return (
            <div key={mode} style={{ position: 'relative' }}>
              {/* Tooltip */}
              <div
                className="gizzi-tooltip"
                style={{
                  position: 'absolute',
                  right: '100%',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  marginRight: '8px',
                  padding: '6px 10px',
                  background: 'rgba(0, 0, 0, 0.85)',
                  color: 'white',
                  fontSize: '12px',
                  borderRadius: '6px',
                  whiteSpace: 'nowrap',
                  opacity: isHovered ? 1 : 0,
                  visibility: isHovered ? 'visible' : 'hidden',
                  transition: 'opacity 0.15s ease, visibility 0.15s ease',
                  pointerEvents: 'none',
                  zIndex: 9998,
                }}
              >
                {info.label}
                <span style={{ opacity: 0.5, marginLeft: '6px' }}>⌨️ {info.shortcut}</span>
              </div>

              {/* Mode Button */}
              <button
                className="gizzi-mode-btn"
                role="button"
                tabIndex={0}
                aria-label={info.label}
                aria-pressed={false}
                onClick={(e) => {
                  e.stopPropagation();
                  handleModeClick(mode);
                }}
                onMouseEnter={() => setHoveredMode(mode)}
                onMouseLeave={() => setHoveredMode(null)}
                onFocus={() => setHoveredMode(mode)}
                onBlur={() => setHoveredMode(null)}
                onKeyDown={(e) => {
                  if (e.key === info.shortcut) {
                    e.preventDefault();
                    handleModeClick(mode);
                  }
                }}
                style={{
                  width: '36px',
                  height: '36px',
                  minWidth: '36px',
                  border: 'none',
                  borderRadius: '10px',
                  background: isHovered 
                    ? 'rgba(255, 255, 255, 0.35)' 
                    : 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                }}
              >
                {info.icon}
              </button>
            </div>
          );
        })}
      </div>

      {/* Status Pip - Activity State Indicator */}
      <div
        className="gizzi-status-pip"
        role="status"
        aria-label={`Status: ${status}`}
        style={{
          position: 'absolute',
          bottom: '-2px',
          right: '-2px',
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          background: statusColor,
          border: '2px solid rgba(255, 255, 255, 0.9)',
          boxShadow: `0 2px 6px ${statusColor}40`,
        }}
      />

      {/* Drag handle indicator */}
      <div
        className="gizzi-drag-handle"
        style={{
          position: 'absolute',
          top: '-8px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '24px',
          height: '4px',
          background: 'rgba(255, 255, 255, 0.3)',
          borderRadius: '2px',
          opacity: isDragging ? 1 : 0.5,
          transition: 'opacity 0.15s ease',
          pointerEvents: 'none',
        }}
        title="Drag to reposition"
      />

      {/* CSS Animations */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .gizzi-orb-button,
          .gizzi-mode-btn,
          .gizzi-tooltip,
          .gizzi-speaking-ring {
            transition: none !important;
            animation: none !important;
          }
        }

        @keyframes gizzi-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.3;
          }
        }

        .gizzi-orb-button:hover {
          transform: scale(1.03);
        }

        .gizzi-orb-button:active {
          transform: scale(0.96);
        }

        .gizzi-mode-btn:hover {
          background: rgba(255, 255, 255, 0.35) !important;
        }

        .gizzi-mode-btn:active {
          transform: scale(0.95);
        }

        .gizzi-mode-btn:focus-visible {
          outline: 2px solid rgba(255, 255, 255, 0.5);
          outline-offset: 2px;
        }

        .gizzi-orb-button:focus-visible {
          outline: 2px solid rgba(255, 255, 255, 0.5);
          outlineOffset: 4px;
        }
      `}</style>
    </div>
  );
};

export default GizziDock;
