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
import { cn } from '@/lib/utils';

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
}: RailControlsProps): React.ReactNode {
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
      className="fixed top-0 left-0 w-[284px] z-[150] pointer-events-none"
    >
      {/* 1. TITLE BAR ROW */}
      <div
        className="h-11 flex items-center pl-20 pr-2 pointer-events-auto [WebkitAppRegion:drag]"
      >
        {/* All widgets grouped together after traffic lights */}
        <div
          className="flex items-center gap-px [WebkitAppRegion:no-drag]"
        >
          <TitleBarButton
            onClick={onToggleRail}
            title={isRailCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <SidebarSimple size={15} weight="bold" />
          </TitleBarButton>

          <div ref={createMenuRef} className="relative">
            <TitleBarButton onClick={() => setShowCreateMenu((v) => !v)} title="New Session">
              <NotePencil size={15} weight="bold" />
            </TitleBarButton>
            {showCreateMenu && (
              <div
                className="absolute top-[calc(100%+8px)] left-0 min-w-[196px] p-1.5 rounded-xl border border-solid border-[var(--shell-menu-border)] bg-[var(--shell-menu-bg)] shadow-[var(--shadow-xl)] z-[152]"
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
        className="p-[2px_8px_10px] pointer-events-auto"
      >
        <div
          className="inline-flex items-center gap-0.5"
        >
          {MODES.map((m) => {
            const active = mode === m.key;
            const Icon = m.icon;
            return (
              <button type="button"
                key={m.key}
                onClick={() => {
                  if (m.key === 'browser') {
                    onOpenView?.('browser');
                  } else {
                    onModeChange(m.key as AppMode);
                  }
                }}
                className={cn(
                  "flex-[0_0_auto] flex items-center justify-center h-[30px] border-none rounded-[7px] cursor-pointer text-[13px] tracking-tight whitespace-nowrap overflow-hidden transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  active 
                    ? "gap-1.5 px-2.5 bg-[var(--shell-item-hover,rgba(255,255,255,0.08))] text-[var(--shell-item-fg,var(--text-primary))] font-semibold" 
                    : "gap-0 px-2 bg-transparent text-[var(--shell-item-muted,var(--text-tertiary))] font-medium hover:bg-[var(--shell-item-hover,rgba(255,255,255,0.05))] hover:text-[var(--shell-item-fg,var(--text-primary))]"
                )}
              >
                <Icon size={14} weight={active ? 'fill' : 'regular'} className="shrink-0" />
                {active && (
                  <span className="overflow-hidden text-ellipsis">
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
}): React.ReactNode {
  return (
    <button type="button"
      onClick={onClick}
      title={title}
      className="bg-transparent border-none rounded-md w-7 h-7 flex items-center justify-center text-[var(--shell-item-muted)] cursor-pointer transition-all duration-150 shrink-0 [WebkitAppRegion:no-drag] hover:bg-[var(--shell-item-hover)] hover:text-[var(--shell-item-fg)]"
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
}): React.ReactNode {
  return (
    <button type="button"
      onClick={onClick}
      className="w-full flex flex-col items-start gap-0.5 p-[9px_12px] border-none bg-transparent rounded-lg text-[var(--shell-item-fg)] cursor-pointer text-left hover:bg-[var(--shell-item-hover)]"
    >
      <span className="text-[13px] font-semibold">{label}</span>
      <span className="text-[12px] text-[var(--shell-item-muted)] leading-tight">{description}</span>
    </button>
  );
}
