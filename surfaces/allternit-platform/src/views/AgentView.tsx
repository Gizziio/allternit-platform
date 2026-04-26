"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAgentStore } from "@/lib/agents/agent.store";
import type { Agent } from "@/lib/agents/agent.types";
import { 
  STUDIO_THEME 
} from "./agent-view/AgentView.constants";
export { STUDIO_THEME };
import { AgentDetailView } from "./agent-view/components/AgentDetailView";
import { CreateAgentForm, CreationProgressAnimation } from "./agent-view/components/CreateAgentForm";
import { AgentCard } from "./agent-view/components/AgentCard";
import { AgentGalleryCard } from "./agent-view/components/AgentGalleryCard";
import { EmptyAgentState } from "./agent-view/components/EmptyAgentState";
import { EditAgentForm } from "./agent-view/components/EditAgentForm";

// UI Components
import { CircleNotch, Plus, Warning, MagnifyingGlass, Faders } from '@phosphor-icons/react';
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
            className="fixed inset-0 z-[100] flex items-center justify-center"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.98)' }}
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
            <CircleNotch className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading agent...</p>
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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: 'transparent',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 24px',
        borderBottom: `1px solid ${STUDIO_THEME.borderSubtle}`,
        background: 'transparent',
        flexShrink: 0,
        position: 'relative'
      }}>
        {!hideCreateButton && (
          <button 
            onClick={() => setIsCreating(true)}
            style={{
              position: 'absolute',
              left: '24px',
              padding: '8px 16px',
              borderRadius: '6px',
              background: `linear-gradient(to right, ${STUDIO_THEME.accent}, #B08D6E)`,
              color: '#1A1612',
              fontSize: '14px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus style={{ width: 16, height: 16 }} />
            Create Agent
          </button>
        )}

        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: '20px',
            fontWeight: 600,
            color: STUDIO_THEME.textPrimary,
            margin: 0,
            fontFamily: 'Georgia, serif'
          }}>{title}</h1>
          <p style={{
            fontSize: '13px',
            color: STUDIO_THEME.textSecondary,
            margin: '4px 0 0 0'
          }}>
            {forceListMode ? 'Browse and manage your AI agents' : 'Create, manage, and orchestrate autonomous AI agents'}
          </p>
        </div>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        minHeight: 0,
        position: 'relative'
      }}>
        {error && error !== 'API_OFFLINE' && (
          <Alert variant="destructive" className="mb-4 bg-red-900/50 border-red-500/50">
            <Warning className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-200">{error}</AlertDescription>
          </Alert>
        )}

        {isLoadingAgents ? (
          <div className="flex items-center justify-center h-64">
            <CircleNotch className="w-8 h-8 animate-spin text-amber-400" />
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
          <AgentGalleryGrid
            agents={agents}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectAgent={selectAgent}
            forceListMode={forceListMode}
          />
        )}
      </div>
    </div>
  );
}

// Re-export CreateAgentForm for AgentHub
export { CreateAgentForm } from "./agent-view/components/CreateAgentForm";

// ─── Gemini-style Gallery Grid ─────────────────────────────────────────────

interface AgentGalleryGridProps {
  agents: Agent[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectAgent: (id: string) => void;
  forceListMode?: boolean;
}

function AgentGalleryGrid({ agents, searchQuery, onSearchChange, onSelectAgent, forceListMode }: AgentGalleryGridProps) {
  const filtered = agents.filter((a) => {
    const q = searchQuery.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.capabilities.some((c) => c.toLowerCase().includes(q))
    );
  });

  const myAgents = filtered.filter((a) => (a.source || "personal") === "personal");
  const vendorAgents = filtered.filter((a) => a.source === "vendor");
  const orgAgents = filtered.filter((a) => a.source === "organization");

  return (
    <div style={{ padding: "8px 0", display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Search bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 8px" }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 14px",
            borderRadius: "10px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            transition: "border-color 0.2s",
          }}
        >
          <MagnifyingGlass size={16} color={STUDIO_THEME.textMuted} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search for agents"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: STUDIO_THEME.textPrimary,
              fontSize: "14px",
              fontFamily: "system-ui, sans-serif",
            }}
          />
        </div>
        <button
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.03)",
            color: STUDIO_THEME.textMuted,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Faders size={16} />
        </button>
      </div>

      {/* My agents */}
      <AgentSection
        title="My agents"
        agents={myAgents}
        onSelectAgent={onSelectAgent}
        startIndex={0}
      />

      {/* From vendor */}
      {vendorAgents.length > 0 && (
        <AgentSection
          title="From Allternit"
          agents={vendorAgents}
          onSelectAgent={onSelectAgent}
          startIndex={myAgents.length}
        />
      )}

      {/* From organization */}
      {orgAgents.length > 0 && (
        <AgentSection
          title="From my organization"
          agents={orgAgents}
          onSelectAgent={onSelectAgent}
          startIndex={myAgents.length + vendorAgents.length}
        />
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 16px", color: STUDIO_THEME.textMuted }}>
          <MagnifyingGlass size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
          <p style={{ fontSize: "14px" }}>No agents match "{searchQuery}"</p>
        </div>
      )}
    </div>
  );
}

function AgentSection({
  title,
  agents,
  onSelectAgent,
  startIndex,
}: {
  title: string;
  agents: Agent[];
  onSelectAgent: (id: string) => void;
  startIndex: number;
}) {
  const [expanded, setExpanded] = useState(true);
  if (agents.length === 0) return null;

  return (
    <div style={{ padding: "0 8px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
        }}
      >
        <h2
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: STUDIO_THEME.textPrimary,
            margin: 0,
          }}
        >
          {title}
        </h2>
        {agents.length > 6 && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "transparent",
              border: "none",
              color: STUDIO_THEME.textMuted,
              fontSize: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "12px",
        }}
      >
        {(expanded ? agents : agents.slice(0, 6)).map((agent, i) => (
          <AgentGalleryCard
            key={agent.id}
            agent={agent}
            onClick={() => onSelectAgent(agent.id)}
            index={startIndex + i}
          />
        ))}
      </div>
    </div>
  );
}
