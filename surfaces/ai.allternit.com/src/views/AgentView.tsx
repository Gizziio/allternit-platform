"use client";

import { useState, useEffect } from "react";
import { useAgentStore } from "@/lib/agents/agent.store";
import type { CreateAgentInput } from "@/lib/agents/agent.types";
import { AgentDetailView } from "./agent-view/components/AgentDetailView";
import { CreateAgentForm } from "./agent-view/components/CreateAgentForm";
import { AgentLeaderboard } from "@/components/agents";
import { EmptyAgentState } from "./agent-view/components/EmptyAgentState";
import { EditAgentForm } from "./agent-view/components/EditAgentForm";
import { AgentGalleryGrid } from "./agent-view/main/AgentGalleryGrid";
import { CreateAgentLanding } from "./agent-view/components/CreateAgentLanding";
import { AgentMascotHero, type VoiceStyle, type ToneStyle } from "./agent-view/components/AgentMascotHero";

// UI Components
import { CircleNotch, Plus, Sparkle, Warning } from '@phosphor-icons/react';
import { motion } from "framer-motion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { STUDIO_THEME } from "./agent-view/AgentView.constants";

interface AgentViewProps {
  context?: unknown;
  hideCreateButton?: boolean;
  forceListMode?: boolean;
  title?: string;
  hideHeader?: boolean;
}

export function AgentView({ hideCreateButton = false, forceListMode = false, title = 'Agent Studio', hideHeader = false }: AgentViewProps) {
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
  const [showLanding, setShowLanding] = useState(!forceListMode);

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
            onCreateFromTemplate={(template: Partial<CreateAgentInput>) => {
              setDraftAgent(template);
              setIsCreating(true);
            }}
          />
        ) : (
          <>
            <RegistryHero
              agentCount={agents.length}
              onCreate={() => setIsCreating(true)}
              hideCreateButton={hideCreateButton}
            />
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

function RegistryHero({
  agentCount,
  onCreate,
  hideCreateButton,
}: {
  agentCount: number;
  onCreate: () => void;
  hideCreateButton?: boolean;
}) {
  const [previewVoice, setPreviewVoice] = useState<VoiceStyle>("warm");
  const [previewTone, setPreviewTone] = useState<ToneStyle>("friendly");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative rounded-2xl border m-4 p-6 sm:p-8"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, var(--surface-panel) 70%, transparent), color-mix(in srgb, var(--surface-hover) 60%, transparent))`,
        borderColor: STUDIO_THEME.borderSubtle,
      }}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl"
        style={{ background: STUDIO_THEME.accent14 }}
      />
      <div className="relative grid grid-cols-1 items-center gap-6 lg:grid-cols-2">
        <div>
          <div
            className="mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
            style={{
              background: STUDIO_THEME.accent10,
              color: STUDIO_THEME.accent,
            }}
          >
            <Sparkle size={12} weight="duotone" />
            Agent Registry
          </div>
          <h2
            className="text-2xl font-bold tracking-tight sm:text-3xl"
            style={{ color: STUDIO_THEME.textPrimary }}
          >
            Your{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(135deg, ${STUDIO_THEME.accent}, var(--accent-secondary))`,
              }}
            >
              agent fleet
            </span>
          </h2>
          <p className="mt-1 text-[13px] sm:text-sm" style={{ color: STUDIO_THEME.textSecondary }}>
            {agentCount} agent{agentCount === 1 ? "" : "s"} ready across chat, code, cowork, and design.
          </p>
          {!hideCreateButton && (
            <motion.button
              type="button"
              onClick={onCreate}
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="mt-4 flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold shadow-lg transition-shadow hover:shadow-xl"
              style={{
                background: `linear-gradient(135deg, ${STUDIO_THEME.accent}, var(--accent-secondary))`,
                color: "var(--ui-text-inverse)",
                boxShadow: `0 10px 28px -10px ${STUDIO_THEME.accent30}`,
              }}
            >
              <Plus size={18} weight="bold" />
              Create Agent
            </motion.button>
          )}
        </div>

        <div className="flex justify-center lg:justify-end">
          <AgentMascotHero
            voice={previewVoice}
            tone={previewTone}
            onVoiceChange={setPreviewVoice}
            onToneChange={setPreviewTone}
          />
        </div>
      </div>
    </motion.div>
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

// Re-export CreateAgentForm for AgentHub
export { CreateAgentForm } from "./agent-view/components/CreateAgentForm";
export default AgentView;
