import React, { useEffect, useRef, useState } from 'react';
import type { Icon } from '@phosphor-icons/react';
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
  mode: 'chat' | 'cowork' | 'code' | 'design';
  onModeChange: (mode: 'chat' | 'cowork' | 'code' | 'design') => void;
  onToggleRail: () => void;
  onNewChat: () => void | Promise<void>;
  onNewAgentSession: () => void | Promise<void>;
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
}: RailControlsProps): JSX.Element {
  const horizontalPadding = 96;
  const railContentInset = 8;
  const railControlWidth = 228;
  const isBrowser = activeViewType === 'browser';
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const createMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showCreateMenu) {
      return;
    }

    const handlePointerDown = (event: MouseEvent): void => {
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
        justifyContent: 'flex-start',
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
          background: 'var(--shell-floating-bg)',
          border: '1px solid var(--shell-floating-border)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          boxShadow: isRailCollapsed ? 'var(--shadow-sm)' : 'var(--shadow-lg)',
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
                  border: '1px solid var(--shell-menu-border)',
                  background: 'var(--shell-menu-bg)',
                  boxShadow: 'var(--shadow-xl)',
                  zIndex: 10002,
                }}
              >
                <CreateMenuButton
                  icon={ChatText}
                  label="New Chat"
                  description="Start a regular chat thread"
                  onClick={async () => {
                    setShowCreateMenu(false);
                    await onNewChat();
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

          {/* Plugin icon - inline with other controls, glass only when collapsed */}
          {onOpenPlugins && (
            <ControlButton
              onClick={onOpenPlugins}
              title="Plugins"
            >
              <PuzzlePiece size={16} weight="bold" />
            </ControlButton>
          )}

          <div
            aria-hidden="true"
            style={{
              width: 1,
              height: 16,
              marginLeft: 6,
              marginRight: 6,
              background: 'var(--shell-divider)',
              borderRadius: 999,
            }}
          />

          <ConnectedViewButton
            active={isBrowser}
            onClick={() => onOpenView?.('browser')}
            title="Browser"
            icon={Desktop}
            label="Browser"
          />
        </div>
      </div>

      {/* 2. PROMINENT MODE SWITCHER */}
      <div style={{
        paddingTop: 4,
        paddingBottom: 10,
        paddingLeft: railContentInset,
        paddingRight: railContentInset,
        pointerEvents: 'auto',
        opacity: isRailCollapsed ? 0.95 : 1,
        transition: 'all 0.3s ease-in-out',
      }}>
        <div style={{
          display: 'flex',
          width: railControlWidth,
          background: 'var(--shell-floating-bg)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          padding: '3px',
          borderRadius: 10,
          border: '1px solid var(--shell-floating-border)',
          height: 28,
          gap: 2,
          boxShadow: 'var(--shadow-sm)',
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
            color="var(--accent-cowork)"
          />
          <ProminentModePill
            active={mode === 'code' && !isBrowser}
            onClick={() => onModeChange('code')}
            icon={TerminalWindow}
            label="Code"
            color="var(--accent-code)"
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
  icon: Icon;
  label: string;
  description: string;
  onClick: () => void;
}): JSX.Element {
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
        color: 'var(--shell-item-fg)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = 'var(--shell-item-hover)';
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
          border: '1px solid var(--shell-floating-border)',
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--shell-item-active-fg)',
          flexShrink: 0,
        }}
      >
        <Icon size={15} weight="bold" />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
        <div style={{ marginTop: 2, fontSize: 11, color: 'var(--shell-item-muted)', lineHeight: 1.4 }}>
          {description}
        </div>
      </div>
    </button>
  );
}

function ControlButton({ children, onClick, title }: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
}): JSX.Element {
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
        color: 'var(--shell-item-muted)',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
      title={title}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--shell-item-hover)';
        e.currentTarget.style.color = 'var(--shell-item-fg)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'var(--shell-item-muted)';
      }}
    >
      {children}
    </button>
  );
}

function ConnectedViewButton({
  active,
  onClick,
  title,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick?: () => void;
  title?: string;
  icon: Icon;
  label: string;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        height: 26,
        padding: '0 6px',
        border: 'none',
        borderRadius: 8,
        background: active ? 'var(--status-info-bg)' : 'transparent',
        color: active ? 'var(--status-info)' : 'var(--shell-item-muted)',
        cursor: 'pointer',
        transition: 'all 0.2s',
        fontSize: 10,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
      title={title}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'var(--shell-item-hover)';
          e.currentTarget.style.color = 'var(--shell-item-fg)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--shell-item-muted)';
        }
      }}
    >
      <Icon size={14} weight={active ? 'fill' : 'bold'} />
      <span>{label}</span>
    </button>
  );
}

function ProminentModePill({ active, onClick, icon: Icon, label, color }: {
  active: boolean;
  onClick?: () => void;
  icon: Icon;
  label: string;
  color: string;
}): JSX.Element {
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
        color: active ? 'var(--ui-text-inverse)' : 'var(--shell-item-muted)',
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
