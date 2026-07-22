import React, { useEffect, useRef, useState } from 'react';
import {
  SidebarSimple,
  NotePencil,
  MagnifyingGlass,
  House,
  TerminalWindow,
  Globe,
} from '@phosphor-icons/react';
import type { AppMode } from './ShellHeader';
import { isElectronShell } from '../lib/platform';
import { cn } from '@/lib/utils';

interface RailControlsProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onToggleRail: () => void;
  onNewChat: () => void | Promise<void>;
  onNewAgentSession: () => void | Promise<void>;
  isRailCollapsed: boolean;
  railWidth?: number;
  onSearchOpen?: () => void;
  onModeHover?: (mode: AppMode | null) => void;
  onCollapsedHover?: (hovered: boolean) => void;
}

interface ModeButton {
  id: AppMode;
  label: string;
  icon: React.ElementType;
  accent: string;
}

const MODE_BUTTONS: ModeButton[] = [
  { id: 'chat', label: 'Home', icon: House, accent: 'var(--accent-chat)' },
  { id: 'code', label: 'Code', icon: TerminalWindow, accent: 'var(--accent-code)' },
  { id: 'browser', label: 'ACI', icon: Globe, accent: 'var(--accent-browser)' },
];

export function RailControls({
  mode,
  onModeChange,
  onToggleRail,
  onNewChat,
  onNewAgentSession,
  isRailCollapsed,
  railWidth = 248,
  onSearchOpen,
  onModeHover,
  onCollapsedHover,
}: RailControlsProps): React.ReactNode {
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [collapsedHovered, setCollapsedHovered] = useState(false);
  const createMenuRef = useRef<HTMLDivElement | null>(null);

  // The 100px leading offset clears the frameless window's traffic-light
  // controls, which only exist inside the Electron desktop shell. Plain
  // browsers (and mobile web) have no traffic lights — use a normal inset.
  const trafficLightClearance = isElectronShell() ? 100 : 8;

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

  if (isRailCollapsed) {
    return (
      <div
        data-testid="shell-rail-controls"
        className="fixed top-0 left-0 z-[150] pointer-events-none"
      >
        <div
          className="h-11 flex items-center pointer-events-auto [WebkitAppRegion:no-drag]"
          style={{ marginLeft: trafficLightClearance }}
          onMouseEnter={() => { setCollapsedHovered(true); onCollapsedHover?.(true); }}
          onMouseLeave={() => { setCollapsedHovered(false); onCollapsedHover?.(false); }}
        >
          <div
            className={cn(
              "flex items-center gap-1 rounded-lg transition-all duration-200",
              collapsedHovered
                ? "bg-[var(--shell-control-bg)] border border-solid border-[var(--border-subtle)] px-1 py-0.5"
                : "border border-solid border-transparent"
            )}
          >
            <TitleBarButton
              onClick={onToggleRail}
              title="Expand Sidebar"
            >
              <SidebarSimple size={15} weight="bold" />
            </TitleBarButton>
            {collapsedHovered && (
              <>
                <div className="w-px h-4 bg-[var(--shell-divider)]" />
                {MODE_BUTTONS.map((btn) => {
                  const isActive = mode === btn.id;
                  const IconComponent = btn.icon;
                  return (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => onModeChange(btn.id)}
                      title={btn.label}
                      data-testid={`rail-mode-${btn.id}`}
                      className="flex items-center justify-center w-11 h-11 md:w-7 md:h-7 rounded-lg border-none cursor-pointer transition-all duration-150 [WebkitAppRegion:no-drag]"
                      style={{
                        background: isActive ? btn.accent : 'transparent',
                        color: isActive ? 'var(--ui-text-inverse)' : 'var(--shell-item-muted)',
                      }}
                      onMouseEnter={(e) => {
                        onModeHover?.(btn.id);
                        onModeChange(btn.id);
                        if (!isActive) {
                          e.currentTarget.style.background = 'var(--shell-item-hover)';
                          e.currentTarget.style.color = 'var(--shell-item-fg)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        onModeHover?.(null);
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--shell-item-muted)';
                        }
                      }}
                    >
                      <IconComponent size={15} weight={isActive ? 'fill' : 'bold'} />
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="shell-rail-controls"
      className="fixed top-0 left-0 z-[150] pointer-events-none"
      style={{ width: railWidth }}
    >
      {/* Title bar widget row */}
      <div
        className="h-11 flex items-center pr-2 pointer-events-auto [WebkitAppRegion:no-drag]"
        style={{ paddingLeft: trafficLightClearance }}
      >
        <div className="flex items-center gap-1 [WebkitAppRegion:no-drag]">
          <TitleBarButton
            onClick={onToggleRail}
            title={isRailCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <SidebarSimple size={15} weight="bold" />
          </TitleBarButton>

          <div className="w-px h-4 bg-[var(--shell-divider)] mx-1" />

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

          <TitleBarButton onClick={onSearchOpen} title="Search">
            <MagnifyingGlass size={15} weight="bold" />
          </TitleBarButton>
        </div>

        {/* Draggable title-bar spacer to the right of the controls */}
        <div className="flex-1 h-full [WebkitAppRegion:drag]" />
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
      onMouseDown={(e) => e.stopPropagation()}
      title={title}
      className="bg-transparent border-none rounded-md w-11 h-11 md:w-7 md:h-7 flex items-center justify-center text-[var(--shell-item-muted)] cursor-pointer transition-all duration-150 shrink-0 [WebkitAppRegion:no-drag] hover:bg-[var(--shell-item-hover)] hover:text-[var(--shell-item-fg)]"
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
