"use client";

import { useState, useEffect } from "react";
import { useAgentStore } from "@/lib/agents/agent.store";
import type { CreateAgentInput } from "@/lib/agents/agent.types";
import { AgentDetailView } from "./agent-view/components/AgentDetailView";
import { CreateAgentForm } from "./agent-view/components/CreateAgentForm";
import { EmptyAgentState } from "./agent-view/components/EmptyAgentState";
import { EditAgentForm } from "./agent-view/components/EditAgentForm";
import { AgentGalleryGrid } from "./agent-view/main/AgentGalleryGrid";
import { CreateAgentLanding } from "./agent-view/components/CreateAgentLanding";

// UI Components
import { CircleNotch, Plus, Warning, Robot, UserCircle } from '@phosphor-icons/react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isBot } from '@/lib/bots/bot-profile';
import { cn } from '@/lib/utils';

interface AgentViewProps {
  context?: unknown;
  hideCreateButton?: boolean;
  forceListMode?: boolean;
  title?: string;
  hideHeader?: boolean;
  showLandingOnEntry?: boolean;
  /** Cap the agent gallery at 2 columns — for narrow embeds like the Settings modal. */
  compactGrid?: boolean;
}

export function AgentView({ hideCreateButton = false, forceListMode = false, title = 'Agent Studio', hideHeader = false, showLandingOnEntry = true, compactGrid = false }: AgentViewProps) {
  const {
    agents,
    selectedAgentId,
    viewMode,
    isLoadingAgents,
    error,
    fetchAgents,
    selectAgent,
    setIsCreating,
    setIsEditing,
    connectEventStream,
    setViewMode,
    setDraftAgent,
  } = useAgentStore();

  // Fetch agents on mount
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Connect to event stream when agent is selected
  useEffect(() => {
    if (!selectedAgentId) return;
    const cleanup = connectEventStream(selectedAgentId);
    return cleanup;
  }, [selectedAgentId, connectEventStream]);

  // If forceListMode is true and we're in create mode, switch to list view
  useEffect(() => {
    if (forceListMode && viewMode === 'create') {
      setViewMode('list');
    }
  }, [forceListMode, viewMode, setViewMode]);

  const [searchQuery, setSearchQuery] = useState('');
  const [showLanding, setShowLanding] = useState(showLandingOnEntry && !forceListMode);
  const [studioFilter, setStudioFilter] = useState<'all' | 'bots' | 'agents'>('all');

  const filteredAgents = agents.filter((agent) => {
    if (studioFilter === 'bots') return isBot(agent);
    if (studioFilter === 'agents') return !isBot(agent);
    return true;
  });

  // Render based on view mode
  if (viewMode === 'create' && !forceListMode) {
    return (
      <div className="h-full w-full">
        <CreateAgentFlow onClose={() => setIsCreating(false)} />
      </div>
    );
  }

  if (viewMode === 'edit' && selectedAgentId) {
    const agent = agents.find(a => a.id === selectedAgentId);
    if (!agent) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <CircleNotch className="size-8  animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading agent…</p>
          </div>
        </div>
      );
    }
    return (
      <div className="h-full w-full">
        <EditAgentForm agent={agent} onCancel={() => setIsEditing(null)} />
      </div>
    );
  }

  if (viewMode === 'detail' && selectedAgentId) {
    return (
      <div className="h-full w-full">
        <AgentDetailView agentId={selectedAgentId} />
      </div>
    );
  }

  // Show the promotional landing page first when entering Agent Studio.
  if (showLanding && !forceListMode) {
    return (
      <div className="h-full w-full">
        <CreateAgentLanding
          onStart={() => {
            setShowLanding(false);
            setIsCreating(true);
          }}
          onBrowseAgents={() => setShowLanding(false)}
          onBack={() => setShowLanding(false)}
          onBotImported={async (agent) => {
            setShowLanding(false);
            await selectAgent(agent.id);
          }}
          onStartFromTemplate={(template) => {
            const bot = template.create();
            setDraftAgent({
              isBot: true,
              botProfile: bot.botProfile,
              name: bot.name,
              description: bot.description,
              type: bot.type,
              model: bot.model,
              provider: bot.provider,
              capabilities: bot.capabilities,
              systemPrompt: bot.systemPrompt,
              tools: bot.tools,
              maxIterations: bot.maxIterations,
              temperature: bot.temperature,
              tags: bot.tags,
              category: bot.category,
            });
            setShowLanding(false);
            setIsCreating(true);
          }}
        />
      </div>
    );
  }

  // Default: Agent List View
  return (
    <div className="flex flex-col h-full w-full bg-transparent overflow-hidden relative">
      {!hideHeader && (
        <div className="flex items-center justify-center p-4 px-6 border-b border-solid border-[var(--border-subtle)] bg-transparent shrink-0 relative">
          {!hideCreateButton && (
            <button type="button" 
              onClick={() => setIsCreating(true)}
              className="absolute left-6 px-4 py-2 rounded-[6px] bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[var(--ui-text-inverse)] text-[14px] font-semibold border-none cursor-pointer flex items-center gap-1.5"
            >
              <Plus size={16} />
              Create Agent
            </button>
          )}

          <div className="text-center">
            <h1 className="text-[20px] font-semibold text-[var(--text-primary)] m-0 font-research">{title}</h1>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1 m-0">
              {forceListMode ? 'Browse and manage your AI agents' : 'Create, manage, and orchestrate autonomous AI agents'}
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 relative">
        <div className="mx-auto w-full max-w-6xl px-8 pb-12 pt-6">
        {error && error !== 'API_OFFLINE' && (
          <Alert variant="destructive" className="mb-4 bg-red-900/50 border-red-500/50">
            <Warning className="size-4  text-red-400" />
            <AlertDescription className="text-red-200">{error}</AlertDescription>
          </Alert>
        )}

        {isLoadingAgents ? (
          <div className="flex h-64 items-center justify-center">
            <CircleNotch className="size-8  animate-spin text-amber-400" />
          </div>
        ) : agents.length === 0 ? (
          <EmptyAgentState
            onCreate={() => setIsCreating(true)}
            onCreateFromTemplate={(template: Partial<CreateAgentInput>) => {
              setDraftAgent(template);
              setIsCreating(true);
            }}
          />
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1">
                <FilterButton
                  active={studioFilter === 'all'}
                  onClick={() => setStudioFilter('all')}
                  label="All"
                />
                <FilterButton
                  active={studioFilter === 'bots'}
                  onClick={() => setStudioFilter('bots')}
                  label="Bots"
                  icon={Robot}
                />
                <FilterButton
                  active={studioFilter === 'agents'}
                  onClick={() => setStudioFilter('agents')}
                  label="Agents"
                  icon={UserCircle}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (studioFilter === 'bots') {
                    setDraftAgent({
                      isBot: true,
                      botProfile: {
                        displayName: '',
                        tagline: '',
                        welcomeMessage: '',
                        starterPrompts: [],
                        accentColor: '#6366f1',
                        groupChatEnabled: true,
                        botCategory: 'custom',
                      },
                    });
                  } else {
                    setDraftAgent(undefined);
                  }
                  setIsCreating(true);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-3 text-[13px] font-medium text-[var(--bg-elevated)] transition-opacity hover:opacity-90"
              >
                <Plus size={16} />
                {studioFilter === 'bots' ? 'Create Bot' : 'Create Agent'}
              </button>
            </div>
            <AgentGalleryGrid
              agents={filteredAgents}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelectAgent={selectAgent}
              forceListMode={forceListMode}
              compact={compactGrid}
            />
            {filteredAgents.length === 0 && agents.length > 0 && (
              <div className="py-12 text-center text-[var(--text-secondary)]">
                <Robot size={40} className="mx-auto mb-3 text-[var(--text-tertiary)] opacity-40" />
                <p className="text-sm">
                  {studioFilter === 'bots'
                    ? 'No bots yet. Create one to package an agent.'
                    : 'No agents yet. Create one to get started.'}
                </p>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

function CreateAgentFlow({ onClose }: { onClose: () => void }) {
  const { clearDraftAgent } = useAgentStore();

  return (
    <CreateAgentForm
      onClose={() => {
        clearDraftAgent();
        onClose();
      }}
      onSuccess={() => {
        clearDraftAgent();
        onClose();
      }}
    />
  );
}

function FilterButton({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ElementType;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors',
        active
          ? 'bg-[var(--accent-primary)] text-white'
          : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
      )}
    >
      {Icon && <Icon size={14} />}
      {label}
    </button>
  );
}

// Re-export CreateAgentForm for AgentHub
export { CreateAgentForm } from "./agent-view/components/CreateAgentForm";
export default AgentView;
