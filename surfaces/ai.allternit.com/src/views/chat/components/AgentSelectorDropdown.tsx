
import React from 'react';
import type { Agent } from '@/lib/agents';

const THEME = {
  menuBg: 'var(--chat-composer-menu-bg)',
  menuBorder: 'var(--chat-composer-menu-border)',
  inputBorder: 'var(--chat-composer-border)',
  textPrimary: 'var(--ui-text-primary)',
  textSecondary: 'var(--chat-composer-muted)',
  textMuted: 'var(--ui-text-muted)',
};

interface AgentSelectorDropdownProps {
  agents: Agent[];
  isLoading: boolean;
  selectedAgent: string | null;
  workspaceArtifacts: Record<string, Array<{ path?: string }>>;
  error: string | null;
  openClawCandidatesCount?: number;
  onOpenImportWizard?: () => void;
  onSelect: (agent: Agent) => void;
  onClear?: () => void;
  onClose: () => void;
}

export function AgentSelectorDropdown({
  agents,
  isLoading,
  selectedAgent,
  workspaceArtifacts,
  error,
  openClawCandidatesCount = 0,
  onOpenImportWizard,
  onSelect,
  onClear,
  onClose,
}: AgentSelectorDropdownProps) {
  return (
    <>
      <div className="fixed inset-0 z-199" onClick={onClose} />
      <div
        className="absolute bottom-full right-36 w-72 max-h-80 bg-menu-bg rounded-xl border border-menu-border shadow-xl z-200 flex flex-col overflow-hidden"
        style={{
          boxShadow: '0 10px 30px var(--shell-overlay-backdrop)',
        }}
      >
        <div className="flex items-center justify-between gap-2 p-3 border-b border-input-border">
          <div>
            <div className="text-xs font-extrabold text-muted tracking-wider uppercase">
              Agent Workspace
            </div>
            <div className="mt-0.5 text-sm text-primary">
              Choose an agent
            </div>
          </div>
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="border-none bg-transparent text-muted text-xs font-semibold cursor-pointer"
            >
              Clear
            </button>
          ) : null}
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted">
              Loading agents...
            </div>
          ) : error ? (
            <div className="p-4 text-center text-sm text-red-500">{error}</div>
          ) : (
            agents.map((agent) => {
              const artifacts = workspaceArtifacts[agent.id] || [];
              const artifactCount = artifacts.length;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => onSelect(agent)}
                  className={`w-full text-left p-2 rounded-lg transition-colors ${
                    selectedAgent === agent.id ? 'bg-hover' : ''
                  }`}
                >
                  <div className="text-sm font-medium text-primary">
                    {agent.name}
                  </div>
                  <div className="text-xs text-muted">
                    {artifactCount > 0
                      ? `${artifactCount} workspace files`
                      : 'No workspace files'}
                  </div>
                </button>
              );
            })
          )}
        </div>
        {openClawCandidatesCount > 0 && (
          <div className="p-2 border-t border-input-border">
            <button
              type="button"
              onClick={onOpenImportWizard}
              className="w-full p-2 rounded-lg bg-green-500/10 text-green-500 text-sm font-semibold"
            >
              Import from OpenClaw ({openClawCandidatesCount})
            </button>
          </div>
        )}
      </div>
    </>
  );
}
