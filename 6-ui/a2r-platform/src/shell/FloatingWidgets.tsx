import React, { useEffect, useRef, useState } from 'react';
import {
  SidebarSimple,
  NotePencil,
  ChatText,
  UsersThree,
  TerminalWindow,
  Globe,
  Cpu,
} from '@phosphor-icons/react';

interface RailControlsProps {
  mode: 'chat' | 'cowork' | 'code';
  onModeChange: (mode: 'chat' | 'cowork' | 'code') => void;
  onToggleRail: () => void;
  onNewChat: () => void;
  onNewAgentSession: () => void;
  isRailCollapsed: boolean;
  activeViewType?: string;
  onOpenView?: (view: string) => void;
  onOpenPlugins?: () => void;
}

export function RailControls({
  mode,
  onModeChange,
  onToggleRail,
  onNewChat,
  onNewAgentSession,
  isRailCollapsed,
  activeViewType,
  onOpenView,
  onOpenPlugins,
}: RailControlsProps) {
  const horizontalPadding = 96;
  const isBrowser = activeViewType === 'browser';
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const createMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showCreateMenu) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!createMenuRef.current?.contains(event.target as Node)) {
        setShowCreateMenu(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [showCreateMenu]);

  return (
    <div
      data-testid="shell-rail-controls"
      style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: 284,
      zIndex: 10001,
      pointerEvents: 'none',
      paddingTop: 14
    }}>
      {/* 1. TOP UTILITY ROW */}
      <div style={{
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: horizontalPadding,
        paddingRight: 16,
        pointerEvents: 'auto',
        WebkitAppRegion: 'no-drag'
      }}>
        {/* Left side: Sidebar Toggle + New Chat */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          padding: '3px',
          borderRadius: isRailCollapsed ? 999 : 12,
          background: isRailCollapsed ? 'rgba(20, 20, 20, 0.5)' : 'transparent',
          border: isRailCollapsed ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
          backdropFilter: isRailCollapsed ? 'blur(8px)' : 'none',
          WebkitBackdropFilter: isRailCollapsed ? 'blur(8px)' : 'none',
          boxShadow: isRailCollapsed ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
          transition: 'all 0.3s ease-in-out'
        }}>
          <ControlButton
            onClick={onToggleRail}
            title={isRailCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <SidebarSimple size={18} weight="bold" />
          </ControlButton>

          <div ref={createMenuRef} style={{ position: 'relative' }}>
            <ControlButton
              onClick={() => setShowCreateMenu((value) => !value)}
              title="New Session"
            >
              <NotePencil size={18} weight="bold" />
            </ControlButton>

            {showCreateMenu ? (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  minWidth: 196,
                  padding: 6,
                  borderRadius: 16,
                  border: '1px solid rgba(212,176,140,0.18)',
                  background: 'linear-gradient(180deg, rgba(28,24,23,0.98), rgba(21,19,19,0.98))',
                  boxShadow: '0 20px 40px rgba(8,6,6,0.3)',
                }}
              >
                <CreateMenuButton
                  icon={ChatText}
                  label="New Chat"
                  description="Start a regular chat thread"
                  onClick={() => {
                    setShowCreateMenu(false);
                    onNewChat();
                  }}
                />
                <CreateMenuButton
                  icon={Cpu}
                  label="New Agent Session"
                  description="Start a durable operator session"
                  onClick={() => {
                    setShowCreateMenu(false);
                    onNewAgentSession();
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>

        {/* Right side: Browser + Plugins */}
        <div style={{ display: 'flex', gap: 6 }}>
          {onOpenPlugins && (
            <button
              onClick={onOpenPlugins}
              title="Plugins"
              style={{
                width: 34, height: 34, borderRadius: 10, border: '1px solid rgba(212,176,140,0.18)',
                background: 'rgba(20,20,20,0.85)', backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(212,176,140,0.7)', transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#d4b08c'; e.currentTarget.style.borderColor = 'rgba(212,176,140,0.4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(212,176,140,0.7)'; e.currentTarget.style.borderColor = 'rgba(212,176,140,0.18)'; }}
            >
              {/* Puzzle piece icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2a2 2 0 0 1 0 4V7h4a1 1 0 0 1 1 1v4h-1a2 2 0 0 0 0 4h1v4a1 1 0 0 1-1 1H14v-1a2 2 0 0 0-4 0v1H6a1 1 0 0 1-1-1v-4h1a2 2 0 0 0 0-4H5V8a1 1 0 0 1 1-1h4V5.5a2 2 0 0 1-1.73-2A2 2 0 0 1 14.5 2z"/>
              </svg>
            </button>
          )}
          <div style={{
            display: 'flex',
            background: 'rgba(20, 20, 20, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            padding: '3px',
            borderRadius: 14,
            border: '1px solid #333',
            height: 40,
            width: 92,
            gap: 2,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            transition: 'all 0.3s ease-in-out',
            opacity: isRailCollapsed ? 0.95 : 1
          }}>
            <ProminentModePill
              active={isBrowser}
              onClick={() => onOpenView?.('browser')}
              icon={Globe}
              label="Browser"
              color="#579BD9"
            />
          </div>
        </div>
      </div>

      {/* 2. PROMINENT MODE SWITCHER */}
      <div style={{
        padding: '4px 16px 16px',
        pointerEvents: 'auto',
        opacity: isRailCollapsed ? 0.95 : 1,
        transition: 'all 0.3s ease-in-out',
      }}>
        <div style={{
          display: 'flex',
          background: isRailCollapsed ? 'rgba(20, 20, 20, 0.8)' : 'rgba(20, 20, 20, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          padding: '3px',
          borderRadius: 14,
          border: '1px solid #333',
          height: 40,
          gap: 2,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          transition: 'all 0.3s ease-in-out'
        }}>
          <ProminentModePill
            active={mode === 'chat' && !isBrowser}
            onClick={() => onModeChange('chat')}
            icon={ChatText}
            label="Chat"
            color="#D97757"
          />
          <ProminentModePill
            active={mode === 'cowork' && !isBrowser}
            onClick={() => onModeChange('cowork')}
            icon={UsersThree}
            label="Cowork"
            color="#9A7BAA"
          />
          <ProminentModePill
            active={mode === 'code' && !isBrowser}
            onClick={() => onModeChange('code')}
            icon={TerminalWindow}
            label="Code"
            color="#6B9A7B"
          />
        </div>
      </div>
    </div>
  );
}

function CreateMenuButton({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number | string; weight?: string; color?: string }>;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 12px',
        border: 'none',
        background: 'transparent',
        borderRadius: 12,
        color: '#ececec',
        cursor: 'pointer',
        textAlign: 'left',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = 'rgba(255,255,255,0.05)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = 'transparent';
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 10,
          border: '1px solid rgba(212,176,140,0.14)',
          background: 'rgba(217,119,87,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#d4b08c',
          flexShrink: 0,
        }}
      >
        <Icon size={15} weight="bold" />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
        <div style={{ marginTop: 2, fontSize: 11, color: '#8f8a86', lineHeight: 1.4 }}>
          {description}
        </div>
      </div>
    </button>
  );
}

function ControlButton({ children, onClick, title }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        borderRadius: 8,
        width: 30,
        height: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#9b9b9b',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
      title={title}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
        e.currentTarget.style.color = '#ececec';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = '#9b9b9b';
      }}
    >
      {children}
    </button>
  );
}

function ProminentModePill({ active, onClick, icon: Icon, label, color }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        borderRadius: 6,
        border: 'none',
        background: active ? color : 'transparent',
        color: active ? '#ffffff' : '#6e6e6e',
        cursor: 'pointer',
        transition: 'all 0.2s',
        height: 'calc(100% - 4px)',
        margin: '2px',
        padding: '4px 6px'
      }}
    >
      <Icon size={14} weight={active ? 'fill' : 'bold'} />
      <span style={{ fontSize: 11, fontWeight: active ? 700 : 600 }}>{label}</span>
    </button>
  );
}
