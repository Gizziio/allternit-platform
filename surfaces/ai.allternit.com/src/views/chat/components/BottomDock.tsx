
import React from 'react';
import { Robot, CaretDown, ChatTeardropText, UsersThree } from '@phosphor-icons/react';
import { useMode } from '@/providers/mode-provider';
import { cn } from '@/lib/utils';
import { AgentSelectorDropdown } from './AgentSelectorDropdown';
import { MODE_TABS } from './ModeDock';
import type { Agent } from '@/lib/agents';

const THEME = {
  inputBg: 'var(--chat-composer-bg)',
  inputBorder: 'var(--chat-composer-border)',
  textSecondary: 'var(--chat-composer-muted)',
  textMuted: 'var(--ui-text-muted)',
  hoverBg: 'var(--chat-composer-hover)',
};

function ChatCoworkToggle() {
  const { mode: appMode } = useMode();
  if (appMode !== 'chat' && appMode !== 'cowork') return null;
  const mode = appMode === 'cowork' ? 'cowork' : 'chat';

  const handleSwitch = (next: 'chat' | 'cowork') => {
    // Route through the shell's mode-change handler (not just the persisted
    // mode value) so the mode's home view always opens — otherwise, when the
    // mode is already `cowork` but another view is showing (e.g. Automation
    // Tasks), the toggle is a no-op and the user stays stuck on that view.
    window.dispatchEvent(new CustomEvent('allternit:switch-mode', { detail: { mode: next } }));
  };

  return (
    <div
      role="group"
      aria-label="Chat or Cowork"
      className="flex items-center rounded-md overflow-hidden border border-composer-border bg-transparent h-7 flex-shrink-0"
    >
      <button
        type="button"
        aria-pressed={mode === 'chat'}
        onClick={() => handleSwitch('chat')}
        className={cn(
          'flex items-center gap-1 px-2 h-full border-none transition-all duration-150 text-xs font-semibold',
          mode === 'chat'
            ? 'bg-composer-soft text-primary rounded-r-md'
            : 'bg-transparent text-muted hover:text-primary'
        )}
      >
        <ChatTeardropText size={14} weight={mode === 'chat' ? 'fill' : 'bold'} />
        Chat
      </button>
      <button
        type="button"
        aria-pressed={mode === 'cowork'}
        onClick={() => handleSwitch('cowork')}
        className={cn(
          'flex items-center gap-1 px-2 h-full border-none border-l border-composer-border transition-all duration-150 text-xs font-semibold',
          mode === 'cowork'
            ? 'bg-composer-soft text-primary rounded-l-md'
            : 'bg-transparent text-muted hover:text-primary'
        )}
      >
        <UsersThree size={14} weight={mode === 'cowork' ? 'fill' : 'bold'} />
        Cowork
      </button>
    </div>
  );
}

interface AgentModePillProps {
  agentModeEnabled: boolean;
  agentModeTheme: { glow: string; soft: string; accent: string };
  selectedSurfaceAgent: Agent | null;
  selectedModeId: string | null;
  onToggle: () => void;
  onOpenMenu: () => void;
  showMenu: boolean;
  disableToggle?: boolean;
  onOpenModeMenu?: () => void;
}

function agentDisplayName(agent: Agent | null): string | null {
  if (!agent) return null;
  return agent.botProfile?.displayName || agent.name;
}

function AgentModePill({
  agentModeEnabled,
  agentModeTheme,
  selectedSurfaceAgent,
  selectedModeId,
  onToggle,
  onOpenMenu,
  showMenu,
  disableToggle,
  onOpenModeMenu,
}: AgentModePillProps) {
  const glowColor = agentModeEnabled ? agentModeTheme.glow : 'var(--chat-composer-border)';
  const softColor = agentModeEnabled ? agentModeTheme.soft : 'transparent';
  const accentColor = agentModeEnabled ? agentModeTheme.accent : 'var(--chat-composer-muted)';
  const selectedModeLabel = selectedModeId
    ? MODE_TABS.find((m) => m.id === selectedModeId)?.label ?? null
    : null;
  const displayName = agentDisplayName(selectedSurfaceAgent);
  const label = agentModeEnabled
    ? displayName && selectedModeLabel
      ? `${displayName} · ${selectedModeLabel}`
      : selectedModeLabel
        ? `Bot · ${selectedModeLabel}`
        : displayName
          ? displayName
          : 'Bot'
    : 'Bot';

  return (
    <div
      className={cn(
        'inline-flex items-center h-8 pl-2.5 pr-1 rounded-full text-xs font-bold transition-all ease border overflow-hidden',
        agentModeEnabled ? 'shadow-sm' : 'opacity-75'
      )}
      style={{
        borderColor: glowColor,
        background: softColor,
        color: accentColor,
        boxShadow: agentModeEnabled ? `0 0 10px ${glowColor}` : 'none',
      }}
    >
      <button
        type="button"
        onClick={disableToggle ? onOpenModeMenu : onToggle}
        className="flex items-center gap-1.5 h-full bg-transparent border-none cursor-pointer"
        style={{ color: accentColor }}
      >
        <Robot size={14} />
        <span>{label}</span>
      </button>
      {agentModeEnabled && (
        <>
          <div className="w-px h-4 mx-1 opacity-30" style={{ background: glowColor }} />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenMenu();
            }}
            aria-label="Select bot"
            className="flex items-center justify-center size-6 rounded-full bg-transparent border-none cursor-pointer transition-colors hover:bg-black/5"
            style={{ color: accentColor }}
          >
            <CaretDown
              size={12}
              className={cn('transition-transform', showMenu && 'rotate-180')}
            />
          </button>
        </>
      )}
    </div>
  );
}

interface BottomDockProps {
  selectedModeId: string | null;
  agentModeSurface?: 'chat' | 'cowork' | 'code' | 'browser' | 'design' | null;
  agentModeEnabled: boolean;
  agentModeTheme: { glow: string; soft: string; accent: string };
  setShowAgentMenu: (show: boolean) => void;
  showAgentMenu: boolean;
  selectedSurfaceAgent: Agent | null;
  onToggleAgentMode?: () => void;
  customLeftContent?: React.ReactNode;
  // Agent menu data
  agents?: Agent[];
  isLoadingAgents?: boolean;
  selectedSurfaceAgentId?: string | null;
  workspaceArtifacts?: Record<string, Array<{ path?: string }>>;
  agentError?: string | null;
  openClawCandidatesCount?: number;
  onOpenImportWizard?: () => void;
  onSelectAgent?: (agent: Agent) => void;
  onClearAgent?: () => void;
  /** Chat/Cowork mode toggle is only for pre-session composers; hide once a session is active */
  showModeToggle?: boolean;
  /** Render as toolbar controls beside the composer's attachment button. */
  inline?: boolean;
  /** When true, the bot pill toggles mode selection instead of turning agent mode off. */
  sessionLocked?: boolean;
  onOpenModeMenu?: () => void;
}

export function BottomDock({
  selectedModeId: _selectedModeId,
  agentModeSurface,
  agentModeEnabled,
  agentModeTheme,
  setShowAgentMenu,
  showAgentMenu,
  selectedSurfaceAgent,
  onToggleAgentMode,
  customLeftContent,
  agents = [],
  isLoadingAgents = false,
  selectedSurfaceAgentId = null,
  workspaceArtifacts = {},
  agentError = null,
  openClawCandidatesCount = 0,
  onOpenImportWizard,
  onSelectAgent,
  onClearAgent,
  showModeToggle = true,
  inline = false,
  sessionLocked = false,
  onOpenModeMenu,
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
      ) : (
        <AgentModePill
          agentModeEnabled={agentModeEnabled}
          agentModeTheme={agentModeTheme}
          selectedSurfaceAgent={selectedSurfaceAgent}
          selectedModeId={_selectedModeId}
          onToggle={onToggleAgentMode || (() => {})}
          onOpenMenu={() => setShowAgentMenu(true)}
          showMenu={showAgentMenu}
          disableToggle={sessionLocked}
          onOpenModeMenu={onOpenModeMenu}
        />
      )}

      {showAgentMenu && agentModeSurface && (
        <div className="absolute bottom-[calc(100%+8px)] left-4 z-200">
          <AgentSelectorDropdown
            agents={agents.filter((a) => {
              const allowedSurfaces = (a.allowedSurfaces as string[] | undefined) || [];
              return a.isBot === true && allowedSurfaces.includes(agentModeSurface);
            })}
            isLoading={isLoadingAgents}
            selectedAgent={selectedSurfaceAgentId}
            workspaceArtifacts={workspaceArtifacts}
            error={agentError}
            openClawCandidatesCount={openClawCandidatesCount}
            onOpenImportWizard={onOpenImportWizard}
            onSelect={(agent) => {
              onSelectAgent?.(agent);
              setShowAgentMenu(false);
            }}
            onClear={() => {
              onClearAgent?.();
              setShowAgentMenu(false);
            }}
            onClose={() => setShowAgentMenu(false)}
          />
        </div>
      )}
    </div>
  );
}
