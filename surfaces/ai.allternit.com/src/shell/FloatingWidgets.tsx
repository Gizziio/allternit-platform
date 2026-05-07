import React, { useEffect, useRef, useState } from 'react';
import type { Icon } from '@phosphor-icons/react';
import {
  SidebarSimple,
  NotePencil,
  PuzzlePiece,
  MagnifyingGlass,
  GraduationCap,
  ChatTeardropText,
  UsersThree,
  TerminalWindow,
  Globe,
  Palette,
} from '@phosphor-icons/react';
import type { AppMode } from './ShellHeader';

interface RailControlsProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onToggleRail: () => void;
  onNewChat: () => void | Promise<void>;
  onNewAgentSession: () => void | Promise<void>;
  isRailCollapsed: boolean;
  activeViewType?: string;
  onOpenView?: (view: string) => void;
  onOpenIntegrations?: () => void;
  onSearchOpen?: () => void;
  onOpenLabs?: () => void;
}

const MODES: Array<{
  key: string;
  label: string;
  color: string;
  icon: Icon;
}> = [
  { key: 'chat',    label: 'Chat',    color: '#D97757', icon: ChatTeardropText },
  { key: 'cowork',  label: 'Cowork',  color: '#A78BFA', icon: UsersThree },
  { key: 'code',    label: 'Code',    color: '#79C47C', icon: TerminalWindow },
  { key: 'browser', label: 'Browser', color: '#69A8C8', icon: Globe },
  { key: 'design',  label: 'Design',  color: 'var(--accent-primary)', icon: Palette },
];

export function RailControls({
  mode,
  onModeChange,
  onToggleRail,
  onNewChat,
  onNewAgentSession,
  isRailCollapsed,
  activeViewType,
  onOpenView,
  onOpenIntegrations,
  onSearchOpen,
  onOpenLabs,
}: RailControlsProps): JSX.Element {
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const createMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showCreateMenu) return;
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
        zIndex: 150,
        pointerEvents: 'none',
      }}
    >
      {/* 1. TITLE BAR ROW */}
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 80,
          paddingRight: 8,
          pointerEvents: 'auto',
          ...({ WebkitAppRegion: 'drag' } as React.CSSProperties),
        }}
      >
        {/* All widgets grouped together after traffic lights */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            ...({ WebkitAppRegion: 'no-drag' } as React.CSSProperties),
          }}
        >
          <TitleBarButton
            onClick={onToggleRail}
            title={isRailCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <SidebarSimple size={15} weight="bold" />
          </TitleBarButton>

          <div ref={createMenuRef} style={{ position: 'relative' }}>
            <TitleBarButton onClick={() => setShowCreateMenu((v) => !v)} title="New Session">
              <NotePencil size={15} weight="bold" />
            </TitleBarButton>
            {showCreateMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  minWidth: 196,
                  padding: 6,
                  borderRadius: 12,
                  border: '1px solid var(--shell-menu-border)',
                  background: 'var(--shell-menu-bg)',
                  boxShadow: 'var(--shadow-xl)',
                  zIndex: 152,
                }}
              >
                <CreateMenuButton
                  label="New Chat"
                  description="Start a regular chat thread"
                  onClick={async () => { setShowCreateMenu(false); await onNewChat(); }}
                />
                <CreateMenuButton
                  label="New Agent Session"
                  description="Start a durable operator session"
                  onClick={() => { setShowCreateMenu(false); onNewAgentSession(); }}
                />
              </div>
            )}
          </div>

          {onOpenIntegrations && (
            <TitleBarButton onClick={onOpenIntegrations} title="Integrations">
              <PuzzlePiece size={15} weight="bold" />
            </TitleBarButton>
          )}

          <TitleBarButton onClick={onOpenLabs} title="A://Labs">
            <GraduationCap size={15} weight="bold" />
          </TitleBarButton>

          <TitleBarButton onClick={onSearchOpen} title="Search">
            <MagnifyingGlass size={15} weight="bold" />
          </TitleBarButton>
        </div>
      </div>

      {/* 2. MODE TABS — full-width, active expands with label */}
      <div
        style={{
          padding: '2px 8px 10px',
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          {MODES.map((m) => {
            const active = mode === m.key;
            const Icon = m.icon;
            return (
              <button
                key={m.key}
                onClick={() => {
                  if (m.key === 'browser') {
                    onOpenView?.('browser');
                  } else {
                    onModeChange(m.key as AppMode);
                  }
                }}
                style={{
                  flex: '0 0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: active ? 6 : 0,
                  height: 30,
                  padding: active ? '0 10px' : '0 8px',
                  border: 'none',
                  borderRadius: 7,
                  background: active ? 'var(--shell-item-hover, rgba(255,255,255,0.08))' : 'transparent',
                  color: active ? 'var(--shell-item-fg, var(--text-primary))' : 'var(--shell-item-muted, var(--text-tertiary))',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  transition: 'all 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'var(--shell-item-hover, rgba(255,255,255,0.05))';
                    e.currentTarget.style.color = 'var(--shell-item-fg, var(--text-primary))';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--shell-item-muted, var(--text-tertiary))';
                  }
                }}
              >
                <Icon size={14} weight={active ? 'fill' : 'regular'} style={{ flexShrink: 0 }} />
                {active && (
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TitleBarButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'transparent',
        border: 'none',
        borderRadius: 6,
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--shell-item-muted)',
        cursor: 'pointer',
        transition: 'background 0.15s, color 0.15s',
        flexShrink: 0,
        ...({ WebkitAppRegion: 'no-drag' } as React.CSSProperties),
      }}
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

function CreateMenuButton({
  label,
  description,
  onClick,
}: {
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
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
        padding: '9px 12px',
        border: 'none',
        background: 'transparent',
        borderRadius: 8,
        color: 'var(--shell-item-fg)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--shell-item-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--shell-item-muted)', lineHeight: 1.4 }}>{description}</span>
    </button>
  );
}
