import React, { useEffect, useRef, useState } from 'react';
import {
  SidebarSimple,
  NotePencil,
  ChatText,
  UsersThree,
  TerminalWindow,
  Globe,
  Cpu,
  Desktop,
  PuzzlePiece,
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
        paddingRight: 4,
        pointerEvents: 'auto',
        ...({'WebkitAppRegion': 'no-drag'} as React.CSSProperties),
      }}>
        {/* Left side: Sidebar Toggle + New Chat + Plugins */}
        <div style={{
          marginLeft: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          padding: '2px',
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
            <SidebarSimple size={16} weight="bold" />
          </ControlButton>

          <div ref={createMenuRef} style={{ position: 'relative', marginLeft: 2 }}>
            <ControlButton
              onClick={() => setShowCreateMenu((value) => !value)}
              title="New Session"
            >
              <NotePencil size={16} weight="bold" />
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
                  zIndex: 10002,
                }}
              >
                <CreateMenuButton
                  icon={ChatText as any}
                  label="New Chat"
                  description="Start a regular chat thread"
                  onClick={() => {
                    setShowCreateMenu(false);
                    onNewChat();
                  }}
                />
                <CreateMenuButton
                  icon={Cpu as any}
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

          {/* Plugin icon - inline with other controls, glass only when collapsed */}
          {onOpenPlugins && (
            <ControlButton
              onClick={onOpenPlugins}
              title="Plugins"
            >
              <PuzzlePiece size={16} weight="bold" />
            </ControlButton>
          )}
        </div>

        {/* Right side: Browser widget - compact */}
        <div style={{ display: 'flex', gap: 6, marginRight: 20 }}>
          <button
            onClick={() => onOpenView?.('browser')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              borderRadius: 6,
              border: '1px solid #333',
              background: 'rgba(20, 20, 20, 0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              color: isBrowser ? '#579BD9' : '#6e6e6e',
              cursor: 'pointer',
              transition: 'all 0.2s',
              height: 26,
              padding: '0 4px',
              fontSize: 10,
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}
            onMouseEnter={(e) => { if (!isBrowser) e.currentTarget.style.color = '#9b9b9b'; }}
            onMouseLeave={(e) => { if (!isBrowser) e.currentTarget.style.color = '#6e6e6e'; }}
          >
            <Desktop size={14} weight={isBrowser ? 'fill' : 'bold'} />
            <span>Browser</span>
          </button>
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
          background: 'transparent',
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
        borderRadius: 6,
        width: 26,
        height: 26,
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
