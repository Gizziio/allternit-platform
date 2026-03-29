/**
 * Agent Selector Component
 *
 * Dropdown for selecting an agent for the current surface.
 * Shows all available agents from the registry.
 *
 * @module AgentSelector
 */

import React from 'react';
import {
  CaretDown,
} from '@phosphor-icons/react';
import { useSurfaceAgentSelection } from '@/lib/agents/surface-agent-context';
import { useAgentStore } from '@/lib/agents/agent.store';
import { useAgentSurfaceModeStore } from '@/stores/agent-surface-mode.store';
import type { AgentModeSurface } from '@/stores/agent-surface-mode.store';

interface AgentSelectorProps {
  surface: AgentModeSurface;
  compact?: boolean;
}

export function AgentSelector({ surface, compact = false }: AgentSelectorProps) {
  const { agentModeEnabled, selectedAgentId, selectedAgent } =
    useSurfaceAgentSelection(surface);
  const agents = useAgentStore((state) => state.agents);
  const isLoading = useAgentStore((state) => state.isLoadingAgents);
  const setSelectedAgent = useAgentSurfaceModeStore(
    (state) => state.setSelectedAgent
  );

  if (!agentModeEnabled) {
    return null;
  }

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newAgentId = event.target.value || null;
    setSelectedAgent(surface, newAgentId);
  };

  // Loading state
  if (isLoading) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
        style={{
          background: 'rgba(255,255,255,0.05)',
          color: '#9B9B9B',
        }}
      >
        <span className="animate-pulse">Loading agents...</span>
      </div>
    );
  }

  // No agents state
  if (agents.length === 0) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
        style={{
          background: 'rgba(245,158,11,0.1)',
          color: '#f59e0b',
        }}
      >
        <span>No agents available</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <select
        value={selectedAgentId || ''}
        onChange={handleChange}
        className="appearance-none flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium outline-none cursor-pointer transition-colors"
        style={{
          background: selectedAgent
            ? 'rgba(212,149,106,0.15)'
            : 'rgba(255,255,255,0.05)',
          color: selectedAgent ? '#D4956A' : '#9B9B9B',
          border: '1px solid rgba(212,149,106,0.3)',
          paddingRight: '32px',
        }}
      >
        <option value="">Choose Agent...</option>
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name} {agent.model ? `(${agent.model})` : ''}
          </option>
        ))}
      </select>

      {/* Custom dropdown arrow */}
      <CaretDown
        size={14}
        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: selectedAgent ? '#D4956A' : '#9B9B9B' }}
      />
    </div>
  );
}
