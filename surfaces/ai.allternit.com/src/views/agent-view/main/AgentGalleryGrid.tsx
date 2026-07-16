"use client";

import React, { useState } from "react";
import { MagnifyingGlass, Faders } from '@phosphor-icons/react';
import type { Agent } from "@/lib/agents/agent.types";
import { AgentGalleryCard } from "../components/AgentGalleryCard";

interface AgentGalleryGridProps {
  agents: Agent[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectAgent: (id: string) => void;
  forceListMode?: boolean;
  /** Cap the grid at 2 columns for narrow embeds (e.g. the Settings modal) instead of the viewport-driven 3/4-column layout. */
  compact?: boolean;
}

export function AgentGalleryGrid({ agents, searchQuery, onSearchChange, onSelectAgent, compact }: AgentGalleryGridProps) {
  const filtered = agents.filter((a) => {
    const q = searchQuery.trim().toLowerCase();
    const name = typeof a.name === 'string' ? a.name : '';
    const description = typeof a.description === 'string' ? a.description : '';
    const capabilities = Array.isArray(a.capabilities) ? a.capabilities : [];
    return (
      name.toLowerCase().includes(q) ||
      description.toLowerCase().includes(q) ||
      capabilities.some((capability) =>
        typeof capability === 'string' && capability.toLowerCase().includes(q)
      )
    );
  });

  const myAgents = filtered.filter((a) => (a.source || "personal") === "personal");
  const vendorAgents = filtered.filter((a) => a.source === "vendor");
  const orgAgents = filtered.filter((a) => a.source === "organization");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-2.5">
        <div className="flex h-11 flex-1 items-center gap-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 transition-colors focus-within:border-[var(--accent-primary)]">
          <MagnifyingGlass size={16} className="text-[var(--text-tertiary)]" />
          <input aria-label="Input" type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search agents…"
            className="flex-1 border-none bg-transparent text-[15px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
          />
        </div>
        <button type="button"
          className="flex size-11 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)]"
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
        compact={compact}
      />

      {/* From vendor */}
      {vendorAgents.length > 0 && (
        <AgentSection
          title="From Allternit"
          agents={vendorAgents}
          onSelectAgent={onSelectAgent}
          startIndex={myAgents.length}
          compact={compact}
        />
      )}

      {/* From organization */}
      {orgAgents.length > 0 && (
        <AgentSection
          title="From my organization"
          agents={orgAgents}
          onSelectAgent={onSelectAgent}
          startIndex={myAgents.length + vendorAgents.length}
          compact={compact}
        />
      )}

      {filtered.length === 0 && (
        <div className="px-4 py-24 text-center text-[var(--text-secondary)]">
          <MagnifyingGlass size={48} className="mx-auto mb-3 text-[var(--text-tertiary)] opacity-40" />
          <p className="text-sm">No agents match “{searchQuery}”.</p>
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
  compact,
}: {
  title: string;
  agents: Agent[];
  onSelectAgent: (id: string) => void;
  startIndex: number;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  if (agents.length === 0) return null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="m-0 text-sm font-medium text-[var(--text-primary)]">
          {title}
        </h2>
        {agents.length > 6 && (
          <button type="button"
            onClick={() => setExpanded(!expanded)}
            className="bg-transparent border-none text-[var(--text-muted)] text-[12px] cursor-pointer flex items-center gap-1 hover:text-[var(--text-secondary)]"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>

      <div className={`grid grid-cols-1 gap-5 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
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
