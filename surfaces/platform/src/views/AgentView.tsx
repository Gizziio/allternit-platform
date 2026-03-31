"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAgentStore } from "@/lib/agents/agent.store";
import { 
  STUDIO_THEME 
} from "./agent-view/AgentView.constants";
export { STUDIO_THEME };
import { AgentDetailView } from "./agent-view/components/AgentDetailView";
import { CreateAgentForm, CreationProgressAnimation } from "./agent-view/components/CreateAgentForm";
import { AgentCard } from "./agent-view/components/AgentCard";
import { EmptyAgentState } from "./agent-view/components/EmptyAgentState";
import { EditAgentForm } from "./agent-view/components/EditAgentForm";

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
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '16px',
            padding: '8px'
          }}>
            {agents.map((agent, index) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                <AgentCard 
                  agent={agent} 
                  onClick={() => selectAgent(agent.id)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
