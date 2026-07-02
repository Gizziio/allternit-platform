// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { useAgentStore } from "@/lib/agents/agent.store";
import { AgentDetailView } from "./agent-view/components/AgentDetailView";
import { CreateAgentForm, CreationProgressAnimation } from "./agent-view/components/CreateAgentForm";
import { AgentLeaderboard } from "@/components/agents";
import { EmptyAgentState } from "./agent-view/components/EmptyAgentState";
import { EditAgentForm } from "./agent-view/components/EditAgentForm";
import { AgentGalleryGrid } from "./agent-view/main/AgentGalleryGrid";

// UI Components
import { CircleNotch, Plus, Warning } from '@phosphor-icons/react';
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AgentViewProps {
  context?: any;
  hideCreateButton?: boolean;
  forceListMode?: boolean;
  title?: string;
}

export function AgentView({ hideCreateButton = false, forceListMode = false, title = 'Agent Studio' }: AgentViewProps) {
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

  // Global forge animation state
  const [globalForgeVisible, setGlobalForgeVisible] = useState(false);
  const [globalForgeAgentName, setGlobalForgeAgentName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Render based on view mode
  if (viewMode === 'create' && !forceListMode) {
    return (
      <div className="h-full w-full">
        <CreateAgentForm 
          onCancel={() => setIsCreating(false)}
          onShowForge={(name) => {
            setGlobalForgeAgentName(name);
            setGlobalForgeVisible(true);
          }}
          onComplete={() => {
            setGlobalForgeVisible(false);
            setIsCreating(false);
          }}
        />
        {globalForgeVisible && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0f172a]/98"
          >
            <CreationProgressAnimation 
              onComplete={() => setGlobalForgeVisible(false)}
              agentName={globalForgeAgentName}
            />
          </div>
        )}
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

  // Default: Agent List View
  return (
    <div className="flex flex-col h-full w-full bg-transparent overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-center p-4 px-6 border-b border-solid border-[var(--border-subtle)] bg-transparent shrink-0 relative">
        {!hideCreateButton && (
          <button type="button" 
            onClick={() => setIsCreating(true)}
            className="absolute left-6 px-4 py-2 rounded-[6px] bg-gradient-to-r from-[var(--accent-primary)] to-[#B08D6E] text-[var(--ui-text-inverse)] text-[14px] font-semibold border-none cursor-pointer flex items-center gap-1.5"
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

      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 relative">
        {error && error !== 'API_OFFLINE' && (
          <Alert variant="destructive" className="mb-4 bg-red-900/50 border-red-500/50">
            <Warning className="size-4  text-red-400" />
            <AlertDescription className="text-red-200">{error}</AlertDescription>
          </Alert>
        )}

        {isLoadingAgents ? (
          <div className="flex items-center justify-center h-64">
            <CircleNotch className="size-8  animate-spin text-amber-400" />
          </div>
        ) : agents.length === 0 ? (
          <EmptyAgentState 
            onCreate={() => setIsCreating(true)} 
            onCreateFromTemplate={(template) => {
              sessionStorage.setItem('agentTemplate', JSON.stringify(template));
              setIsCreating(true);
            }}
          />
        ) : (
          <>
            <div className="px-2 mb-2">
              <AgentLeaderboard
                agents={agents}
                onSelectAgent={(agent) => selectAgent(agent.id)}
              />
            </div>
            <AgentGalleryGrid
              agents={agents}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelectAgent={selectAgent}
              forceListMode={forceListMode}
            />
          </>
        )}
      </div>
    </div>
  );
}

// Re-export CreateAgentForm for AgentHub
export { CreateAgentForm } from "./agent-view/components/CreateAgentForm";
export default AgentView;
