"use client";

import React, { useState } from 'react';
import { Robot } from '@phosphor-icons/react';
import { useAgentStore } from '@/lib/agents/agent.store';
import type { AgentStatus } from '@/lib/agents/agent.types';
import { CoworkAgentProfileCard } from './CoworkAgentProfileCard';

type FilterTab = 'all' | AgentStatus;

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'idle', label: 'Idle' },
  { key: 'running', label: 'Running' },
  { key: 'paused', label: 'Paused' },
  { key: 'error', label: 'Error' },
];

const TAB_ACCENTS: Record<FilterTab, string> = {
  all: 'var(--accent-cowork)',
  idle: 'var(--status-success)',
  running: 'var(--status-info)',
  paused: 'var(--status-warning)',
  error: 'var(--status-error)',
};

export const CoworkTeamAgentsView: React.FC = () => {
  const { agents } = useAgentStore();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const filtered = activeTab === 'all' ? agents : agents.filter((a) => a.status === activeTab);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-lg)',
        padding: 'var(--spacing-xl)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Robot size={28} color="#af52de" weight="duotone" />
          <h1 style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>Team Agents</h1>
        </div>
        <button
          onClick={() => alert('Register Agent — coming soon.')}
          style={{
            padding: '8px 18px',
            borderRadius: '8px',
            background: 'var(--accent-cowork)',
            color: '#fff',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Register Agent
        </button>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          background: 'var(--bg-secondary)',
          borderRadius: '10px',
          padding: '4px',
          width: 'fit-content',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {TABS.map(({ key, label }) => {
          const isActive = activeTab === key;
          const accent = TAB_ACCENTS[key];
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                padding: '6px 16px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                background: isActive ? `${accent}22` : 'transparent',
                color: isActive ? accent : 'var(--text-secondary)',
                transition: 'all 0.15s',
              }}
            >
              {label}
              {key !== 'all' && (
                <span
                  style={{
                    marginLeft: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: isActive ? `${accent}33` : 'var(--bg-secondary)',
                    color: isActive ? accent : 'var(--text-secondary)',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {agents.filter((a) => a.status === key).length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Agent Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px', padding: '48px 0' }}>
          No agents found.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 'var(--spacing-md)',
          }}
        >
          {filtered.map((agent) => (
            <CoworkAgentProfileCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
};

export default CoworkTeamAgentsView;
