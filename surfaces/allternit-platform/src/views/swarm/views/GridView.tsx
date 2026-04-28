/**
 * Grid View - Information-dense overview
 * 
 * Based on demo-v3/v4/v5.html design specification
 * Simple grid layout without masonry sizing
 */

import React from 'react';
import { Robot } from '@phosphor-icons/react';
import { SwarmAgent } from '../types';
import { AgentCard } from '../components/AgentCard';

const TEXT_MUTED = 'var(--ui-text-muted)';
const TEXT_SUBTLE = 'var(--ui-text-muted)';
const BG_SURFACE = '#121110';
const ACCENT = '#c17817';

interface GridViewProps {
  agents: SwarmAgent[];
  modeColors: {
    accent: string;
  };
  onAgentSelect: (agentId: string) => void;
}

export function GridView({ agents, modeColors, onAgentSelect }: GridViewProps) {
  if (agents.length === 0) {
    return (
      <div 
        className="h-full flex flex-col items-center justify-center gap-4"
        style={{ color: TEXT_MUTED }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: BG_SURFACE, opacity: 0.4 }}
        >
          <Robot size={28} color={TEXT_SUBTLE} weight="duotone" />
        </div>
        <p className="text-sm">No agents running</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Grid toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs" style={{ color: TEXT_MUTED }}>
          <span className="font-mono" style={{ color: ACCENT }}>{agents.length}</span> agents in workspace
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              background: BG_SURFACE,
              border: `1px solid #272522`,
              color: TEXT_MUTED,
            }}
          >
            <span>☐</span> Select
          </button>
          <button
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              background: BG_SURFACE,
              border: `1px solid #272522`,
              color: TEXT_MUTED,
            }}
          >
            <span>⚙</span> Filter
          </button>
        </div>
      </div>

      {/* Agent Grid */}
      <div 
        className="grid gap-3"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        }}
      >
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            modeColors={modeColors}
            onClick={() => onAgentSelect(agent.id)}
          />
        ))}
      </div>
    </div>
  );
}
