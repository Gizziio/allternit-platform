
import React from 'react';
import { Robot, CaretDown, ChatTeardropText, UsersThree } from '@phosphor-icons/react';
import { useMode } from '@/providers/mode-provider';
import { cn } from '@/lib/utils';
import { AgentSelectorDropdown } from './AgentSelectorDropdown';
import type { Agent } from '@/lib/agents';

const THEME = {
  inputBg: 'var(--chat-composer-bg)',
  inputBorder: 'var(--chat-composer-border)',
  textSecondary: 'var(--chat-composer-muted)',
  textMuted: 'var(--ui-text-muted)',
  hoverBg: 'var(--chat-composer-hover)',
};

function ChatCoworkToggle() {
  const { mode: appMode, setMode } = useMode();
  if (appMode !== 'chat' && appMode !== 'cowork') return null;
  const mode = appMode === 'cowork' ? 'cowork' : 'chat';

  const handleSwitch = (next: 'chat' | 'cowork') => {
    setMode(next);
  };

  return (
    <div
      role="group"
      aria-label="Chat or Cowork"
      className="flex items-center rounded-md overflow-hidden border border-composer-border bg-composer-soft h-7 flex-shrink-0"
    >
      <button
        type="button"
        aria-pressed={mode === 'chat'}
        onClick={() => handleSwitch('chat')}
        className={cn(
          'flex items-center gap-1 px-2 h-full border-none transition-all duration-150 text-xs font-semibold',
          mode === 'chat'
            ? 'bg-composer-hover text-primary'
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
            ? 'bg-composer-hover text-[var(--accent-cowork)]'
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
  selectedSurfaceAgent: { name: string } | null;
  onToggle: () => void;
  onOpenMenu: () => void;
  showMenu: boolean;
}

function AgentModePill({
  agentModeEnabled,
  agentModeTheme,
  selectedSurfaceAgent,
  onToggle,
  onOpenMenu,
  showMenu,
}: AgentModePillProps) {
  const glowColor = agentModeEnabled ? agentModeTheme.glow : 'var(--chat-composer-border)';
  const softColor = agentModeEnabled ? agentModeTheme.soft : 'transparent';
  const accentColor = agentModeEnabled ? agentModeTheme.accent : 'var(--chat-composer-muted)';
  const label = agentModeEnabled
    ? selectedSurfaceAgent
      ? `Agent | ${selectedSurfaceAgent.name}`
      : 'Agent On'
    : 'Agent Off';

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
        onClick={onToggle}
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
            aria-label="Select agent"
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
  selectedSurfaceAgent: { name: string } | null;
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
}: BottomDockProps) {
  const borderColor = agentModeEnabled ? agentModeTheme.glow : THEME.inputBorder;

  return (
    <div
      className="w-full box-border mt-0 flex items-center justify-between py-2 px-4 bg-input-bg rounded-b-2xl z-11 relative"
      style={{
        borderTop: `1px solid ${borderColor}`,
        borderRight: `1px solid ${borderColor}`,
        borderBottom: `1px solid ${borderColor}`,
        borderLeft: `1px solid ${borderColor}`,
      }}
    >
      {customLeftContent ? (
        <div className="flex items-center">{customLeftContent}</div>
      ) : (
        <AgentModePill
          agentModeEnabled={agentModeEnabled}
          agentModeTheme={agentModeTheme}
          selectedSurfaceAgent={selectedSurfaceAgent}
          onToggle={onToggleAgentMode || (() => {})}
          onOpenMenu={() => setShowAgentMenu(true)}
          showMenu={showAgentMenu}
        />
      )}
      <div className="flex items-center gap-2">
        <ChatCoworkToggle />
      </div>

      {showAgentMenu && agentModeSurface && (
        <div className="absolute bottom-full left-4 mb-2">
          <AgentSelectorDropdown
            agents={agents.filter((a) => {
              const allowedSurfaces = (a.allowedSurfaces as string[] | undefined) || [];
              return allowedSurfaces.includes(agentModeSurface);
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
