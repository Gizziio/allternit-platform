import React, { useEffect, useRef, useState } from 'react';
import type { Icon } from '@phosphor-icons/react';
import {
  SidebarSimple,
  NotePencil,
  PuzzlePiece,
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

const PILL_WIDTH = 88;

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
}: RailControlsProps): JSX.Element {
  const horizontalPadding = 96;
  const activeIndex = MODES.findIndex((m) => m.key === mode);

  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const createMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const target = (activeIndex * PILL_WIDTH) + (PILL_WIDTH / 2) - (el.clientWidth / 2);
    el.scrollTo({ left: target, behavior: 'smooth' });
  }, [activeIndex]);

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
        paddingTop: 14,
      }}
    >
      {/* 1. TOP UTILITY ROW */}
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingLeft: horizontalPadding,
          paddingRight: 4,
          pointerEvents: 'auto',
          ...({ WebkitAppRegion: 'no-drag' } as React.CSSProperties),
        }}
      >
        <div
          style={{
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
            transition: 'all 0.3s ease-in-out',
          }}
        >
          <ControlButton
            onClick={onToggleRail}
            title={isRailCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <SidebarSimple size={16} weight="bold" />
          </ControlButton>

          <div ref={createMenuRef} style={{ position: 'relative', marginLeft: 2 }}>
            <ControlButton
              onClick={() => setShowCreateMenu((v) => !v)}
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
                  zIndex: 152,
                }}
              >
                <CreateMenuButton
                  label="New Chat"
                  description="Start a regular chat thread"
                  onClick={async () => {
                    setShowCreateMenu(false);
                    await onNewChat();
                  }}
                />
                <CreateMenuButton
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

          {onOpenIntegrations && (
            <ControlButton
              onClick={onOpenIntegrations}
              title="Integrations"
            >
              <PuzzlePiece size={16} weight="bold" />
            </ControlButton>
          )}
        </div>
      </div>

      {/* 2. SCROLL-SNAPPING HORIZONTAL MODE SWITCHER */}
      <div
        style={{
          paddingTop: 6,
          paddingBottom: 10,
          paddingLeft: 8,
          paddingRight: 8,
          pointerEvents: 'auto',
          opacity: isRailCollapsed ? 0.95 : 1,
          transition: 'opacity 0.3s ease',
        }}
      >
        <div
          ref={scrollerRef}
          style={{
            width: 228,
            height: 34,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            padding: 3,
            background: 'var(--shell-floating-bg)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid var(--shell-floating-border)',
            borderRadius: 10,
            boxShadow: 'var(--shadow-sm)',
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <style>{`
            [data-rail-scroller]::-webkit-scrollbar { display: none; }
          `}</style>
          {MODES.map((m, i) => {
            const active = mode === m.key;
            const distance = Math.abs(i - activeIndex);
            const Icon = m.icon;

            return (
              <button
                key={m.key}
                data-rail-scroller
                onClick={() => {
                  if (m.key === 'browser') {
                    onOpenView?.('browser');
                  } else {
                    onModeChange(m.key as AppMode);
                  }
                }}
                style={{
                  scrollSnapAlign: 'center',
                  flex: '0 0 auto',
                  width: PILL_WIDTH,
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: active ? 6 : 0,
                  padding: active ? '0 10px' : '0',
                  border: 'none',
                  borderRadius: 7,
                  background: active ? m.color : 'transparent',
                  color: active ? 'var(--ui-text-inverse)' : m.color,
                  cursor: 'pointer',
                  fontSize: active ? 11 : 0,
                  fontWeight: active ? 700 : 600,
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  opacity: distance === 0 ? 1 : distance === 1 ? 0.6 : 0.3,
                  transform: distance === 0 ? 'scale(1)' : 'scale(0.88)',
                  transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.opacity = '0.9';
                    e.currentTarget.style.background = m.color + '12';
                    e.currentTarget.style.transform = 'scale(0.94)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.opacity = distance === 1 ? '0.6' : '0.3';
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.transform = 'scale(0.88)';
                  }
                }}
              >
                {active && (
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: 'var(--ui-text-primary)',
                      boxShadow: '0 0 6px rgba(255,255,255,0.5)',
                      flexShrink: 0,
                    }}
                  />
                )}
                {active && <span>{m.label}</span>}
                {!active && <Icon size={16} weight="bold" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
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
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
        <div style={{ marginTop: 2, fontSize: 11, color: 'var(--shell-item-muted)', lineHeight: 1.4 }}>
          {description}
        </div>
      </div>
    </button>
  );
}

function ControlButton({
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
        transition: 'all 0.2s',
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
