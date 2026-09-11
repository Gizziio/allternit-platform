import React, { useRef, useState } from 'react';
import {
  SidebarSimple,
  CaretLeft,
  CaretRight,
  Plus,
  Bell,
  House,
  Robot,
  Terminal,
  TerminalWindow,
  Globe,
  ChatCircle,
} from '@phosphor-icons/react';
import type { AppMode } from './ShellHeader';
import { isElectronShell } from '../lib/platform';
import { cn } from '@/lib/utils';
import { openNativeSessionPicker } from '@/components/native-sessions/NativeSessionPicker';
import { ShellMenu, ShellMenuItem } from './ShellMenu';

interface RailControlsProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onToggleRail: () => void;
  onNewChat: () => void | Promise<void>;
  onNewAgentSession: () => void | Promise<void>;
  isRailCollapsed: boolean;
  railWidth?: number;
  onAgentActivityOpen?: () => void;
  agentActivityUnreadCount?: number;
  onModeHover?: (mode: AppMode | null) => void;
  onCollapsedHover?: (hovered: boolean) => void;
  onBack?: () => void;
  onForward?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
}

interface ModeButton {
  id: AppMode;
  label: string;
  icon: React.ElementType;
  accent: string;
}

const MODE_BUTTONS: ModeButton[] = [
  { id: 'chat', label: 'Home', icon: House, accent: 'var(--accent-chat)' },
  { id: 'bot', label: 'Bots', icon: Robot, accent: 'var(--accent-bot)' },
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
  onAgentActivityOpen,
  agentActivityUnreadCount = 0,
  onModeHover,
  onCollapsedHover,
  onBack,
  onForward,
  canGoBack = true,
  canGoForward = true,
}: RailControlsProps): React.ReactNode {
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [collapsedHovered, setCollapsedHovered] = useState(false);
  const createTriggerRef = useRef<HTMLButtonElement | null>(null);

  // Tight leading offset for the frameless window's traffic-light controls
  // in the Electron desktop shell; on the web there's no traffic-light strip.
  const trafficLightClearance = isElectronShell() ? 72 : 4;

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
              "flex items-center gap-0.5 rounded-lg transition-all duration-200",
              collapsedHovered || showCreateMenu
                ? "bg-[var(--shell-control-bg)] border border-solid border-[var(--border-subtle)] px-1 py-0.5"
                : "bg-[var(--shell-control-bg)]/60 border border-solid border-transparent"
            )}
          >
            <TitleBarButton onClick={onBack} title="Back" disabled={!canGoBack}>
              <CaretLeft size={15} weight="bold" />
            </TitleBarButton>
            <TitleBarButton onClick={onForward} title="Forward" disabled={!canGoForward}>
              <CaretRight size={15} weight="bold" />
            </TitleBarButton>
            <TitleBarButton
              onClick={onToggleRail}
              title="Expand Sidebar"
            >
              <SidebarSimple size={15} weight="bold" />
            </TitleBarButton>
            {(collapsedHovered || showCreateMenu) && (
              <>
                <div className="w-px h-4 bg-[var(--shell-divider)]" />
                <div className="relative">
                  <TitleBarButton
                    buttonRef={createTriggerRef}
                    onClick={() => setShowCreateMenu((v) => !v)}
                    title="New"
                    ariaHaspopup
                    ariaExpanded={showCreateMenu}
                  >
                    <Plus size={15} weight="bold" />
                  </TitleBarButton>
                  <ShellMenu
                    open={showCreateMenu}
                    onClose={() => setShowCreateMenu(false)}
                    triggerRef={createTriggerRef}
                    className="absolute left-[calc(100%+8px)] top-0 min-w-[196px]"
                  >
                    <ShellMenuItem
                      icon={<ChatCircle size={16} weight="bold" />}
                      label="New Chat"
                      onClick={async () => { setShowCreateMenu(false); await onNewChat(); }}
                    />
                    <ShellMenuItem
                      icon={<Robot size={16} weight="bold" />}
                      label="New Agent Session"
                      onClick={() => { setShowCreateMenu(false); onNewAgentSession(); }}
                    />
                    <ShellMenuItem
                      icon={<Terminal size={16} weight="bold" />}
                      label="Continue CLI Session"
                      onClick={() => {
                        setShowCreateMenu(false);
                        openNativeSessionPicker(mode === 'browser' ? 'chat' : mode, 'regular');
                      }}
                    />
                  </ShellMenu>
                </div>
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
        <div className="flex items-center gap-0.5 [WebkitAppRegion:no-drag]">
          <TitleBarButton onClick={onBack} title="Back" disabled={!canGoBack}>
            <CaretLeft size={15} weight="bold" />
          </TitleBarButton>

          <TitleBarButton onClick={onForward} title="Forward" disabled={!canGoForward}>
            <CaretRight size={15} weight="bold" />
          </TitleBarButton>

          <TitleBarButton
            onClick={onToggleRail}
            title={isRailCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <SidebarSimple size={15} weight="bold" />
          </TitleBarButton>

          <div className="w-px h-4 bg-[var(--shell-divider)] mx-1" />

          <div className="relative">
            <TitleBarButton
              buttonRef={createTriggerRef}
              onClick={() => setShowCreateMenu((v) => !v)}
              title="New"
              ariaHaspopup
              ariaExpanded={showCreateMenu}
            >
              <Plus size={15} weight="bold" />
            </TitleBarButton>
            <ShellMenu
              open={showCreateMenu}
              onClose={() => setShowCreateMenu(false)}
              triggerRef={createTriggerRef}
              className="absolute top-[calc(100%+8px)] left-0 min-w-[196px]"
            >
              <ShellMenuItem
                icon={<ChatCircle size={16} weight="bold" />}
                label="New Chat"
                onClick={async () => { setShowCreateMenu(false); await onNewChat(); }}
              />
              <ShellMenuItem
                icon={<Robot size={16} weight="bold" />}
                label="New Agent Session"
                onClick={() => { setShowCreateMenu(false); onNewAgentSession(); }}
              />
              <ShellMenuItem
                icon={<Terminal size={16} weight="bold" />}
                label="Continue CLI Session"
                onClick={() => {
                  setShowCreateMenu(false);
                  openNativeSessionPicker(mode === 'browser' ? 'chat' : mode, 'regular');
                }}
              />
            </ShellMenu>
          </div>

          <div className="relative">
            <TitleBarButton onClick={onAgentActivityOpen} title="Bot Activity (⌘⇧M)">
              <Bell size={15} weight="bold" />
            </TitleBarButton>
            {agentActivityUnreadCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[14px] h-[14px] px-[3px] rounded-full text-[9px] font-bold leading-none pointer-events-none"
                style={{ background: 'var(--status-error)', color: '#fff' }}
              >
                {agentActivityUnreadCount > 9 ? '9+' : agentActivityUnreadCount}
              </span>
            )}
          </div>
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
  disabled,
  buttonRef,
  ariaHaspopup,
  ariaExpanded,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
  buttonRef?: React.Ref<HTMLButtonElement>;
  ariaHaspopup?: boolean;
  ariaExpanded?: boolean;
}): React.ReactNode {
  return (
    <button type="button"
      ref={buttonRef}
      onClick={onClick}
      onMouseDown={(e) => e.stopPropagation()}
      title={title}
      disabled={disabled}
      aria-haspopup={ariaHaspopup ? 'menu' : undefined}
      aria-expanded={ariaExpanded}
      className="bg-transparent border-none rounded-md w-11 h-11 md:w-7 md:h-7 flex items-center justify-center text-[var(--shell-item-muted)] cursor-pointer transition-all duration-150 shrink-0 [WebkitAppRegion:no-drag] hover:bg-[var(--shell-item-hover)] hover:text-[var(--shell-item-fg)] disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}
