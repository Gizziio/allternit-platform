
import React from 'react';
import { Robot, ChatTeardropText, UsersThree } from '@phosphor-icons/react';
import { useMode } from '@/providers/mode-provider';
import { cn } from '@/lib/utils';
import type { AgentModeSurface } from '@/stores/agent-surface-mode.store';

const THEME = {
  inputBg: 'var(--chat-composer-bg)',
  inputBorder: 'var(--chat-composer-border)',
  textSecondary: 'var(--chat-composer-muted)',
  textMuted: 'var(--ui-text-muted)',
  hoverBg: 'var(--chat-composer-hover)',
};

type DockMode = 'chat' | 'cowork' | 'bot';

const MODE_SEGMENTS: Array<{ id: DockMode; label: string; icon: typeof ChatTeardropText }> = [
  { id: 'chat', label: 'Chat', icon: ChatTeardropText },
  { id: 'cowork', label: 'Cowork', icon: UsersThree },
  { id: 'bot', label: 'Bots', icon: Robot },
];

function ChatCoworkToggle() {
  const { mode: appMode } = useMode();
  if (appMode !== 'chat' && appMode !== 'cowork' && appMode !== 'bot') return null;
  const mode: DockMode = appMode === 'cowork' ? 'cowork' : appMode === 'bot' ? 'bot' : 'chat';

  const handleSwitch = (next: DockMode) => {
    // Route through the shell's mode-change handler (not just the persisted
    // mode value) so the mode's home view always opens — otherwise, when the
    // mode is already `cowork` but another view is showing (e.g. Automation
    // Tasks), the toggle is a no-op and the user stays stuck on that view.
    window.dispatchEvent(new CustomEvent('allternit:switch-mode', { detail: { mode: next } }));
  };

  return (
    <div
      role="group"
      aria-label="Chat, Cowork, or Bots"
      className="flex items-center gap-0.5 rounded-lg border border-composer-border bg-transparent h-7 flex-shrink-0 p-0.5 overflow-hidden"
    >
      {MODE_SEGMENTS.map((segment) => {
        const isActive = mode === segment.id;
        const SegmentIcon = segment.icon;
        return (
          <button
            type="button"
            key={segment.id}
            aria-pressed={isActive}
            onClick={() => handleSwitch(segment.id)}
            className={cn(
              'flex items-center gap-1 px-2 h-full border-none rounded-md transition-all duration-150 text-xs font-semibold',
              isActive
                ? '-my-0.5 h-[calc(100%+0.25rem)] bg-composer-soft text-primary'
                : 'bg-transparent text-muted hover:text-primary'
            )}
          >
            <SegmentIcon size={14} weight={isActive ? 'fill' : 'bold'} />
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}

interface BottomDockProps {
  agentModeSurface?: AgentModeSurface | null;
  agentModeEnabled: boolean;
  agentModeTheme: { glow: string; soft: string; accent: string };
  customLeftContent?: React.ReactNode;
  /** Chat/Cowork/Bots mode toggle is only for pre-session composers; hide once a session is active */
  showModeToggle?: boolean;
  /** Render as toolbar controls beside the composer's attachment button. */
  inline?: boolean;
}

export function BottomDock({
  agentModeSurface: _agentModeSurface,
  agentModeEnabled,
  agentModeTheme,
  customLeftContent,
  showModeToggle = true,
  inline = false,
}: BottomDockProps) {
  const borderColor = agentModeEnabled ? agentModeTheme.glow : THEME.inputBorder;

  return (
    <div
      className={cn(
        'box-border flex items-center justify-start gap-2 z-11 relative',
        inline ? 'w-auto p-0 bg-transparent' : 'w-full mt-0 py-2 px-4 bg-input-bg rounded-b-2xl'
      )}
      style={inline ? undefined : {
        borderTop: `1px solid ${borderColor}`,
        borderRight: `1px solid ${borderColor}`,
        borderBottom: `1px solid ${borderColor}`,
        borderLeft: `1px solid ${borderColor}`,
      }}
    >
      {showModeToggle && (
        <div className="flex items-center">
          <ChatCoworkToggle />
        </div>
      )}
      {customLeftContent ? (
        <div className="flex items-center">{customLeftContent}</div>
      ) : null}
    </div>
  );
}
