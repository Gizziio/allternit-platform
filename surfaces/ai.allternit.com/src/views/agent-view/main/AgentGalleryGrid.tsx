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
}

export function AgentGalleryGrid({ agents, searchQuery, onSearchChange, onSelectAgent }: AgentGalleryGridProps) {
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
    <div className="py-2 flex flex-col gap-7">
      {/* Search bar */}
      <div className="flex items-center gap-2.5 px-2">
        <div
          className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] transition-[border-color] duration-200 focus-within:border-[var(--accent-primary)]"
        >
          <MagnifyingGlass size={16} className="text-[var(--text-muted)]" />
          <input aria-label="Input" type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search for agents"
            className="flex-1 bg-transparent border-none outline-none text-[var(--text-primary)] text-[14px] font-sans"
          />
        </div>
        <button type="button"
          className="size-9 rounded-[10px] border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-hover)] text-[var(--text-muted)] flex items-center justify-center cursor-pointer hover:bg-[var(--bg-secondary)]"
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
        <div className="text-center py-12 px-4 text-[var(--text-muted)]">
          <MagnifyingGlass size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-[14px]">No agents match "{searchQuery}"</p>
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
    <div className="px-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)] m-0">
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

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
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
