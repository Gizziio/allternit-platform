/**
 * FilterBar - Search and filter controls for SwarmMonitor
 *
 * Based on demo-v3/v4/v5.html design specification
 */

import React, { useCallback, useMemo } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { AgentRole, AgentStatus } from '../types';
import { useFilters, useSwarmMonitorStore } from '../SwarmMonitor.store';
import { BACKGROUND, SAND, STATUS, TEXT } from '@/design/a2r.tokens';

const ACCENT = '#c17817';
const BG_SURFACE = '#121110';
const BORDER_COLOR = '#272522';
const TEXT_MUTED = '#8b8680';
const TEXT_COLOR = '#e8e6e3';

const roleOptions: { value: AgentRole; label: string; color: string }[] = [
  { value: 'orchestrator', label: 'Orch', color: ACCENT },
  { value: 'worker', label: 'Work', color: STATUS.info },
  { value: 'specialist', label: 'Spec', color: '#a78bfa' },
  { value: 'reviewer', label: 'Rev', color: STATUS.success },
];

const statusOptions: { value: AgentStatus; label: string; color: string }[] = [
  { value: 'working', label: 'Active', color: STATUS.success },
  { value: 'idle', label: 'Idle', color: TEXT.secondary },
];

export function FilterBar() {
  const {
    searchQuery,
    roleFilter,
    statusFilter,
    setSearchQuery,
    setRoleFilter,
    setStatusFilter,
  } = useFilters();

  const agents = useSwarmMonitorStore(state => state.agents);
  const filteredAgents = useSwarmMonitorStore(state => state.filteredAgents);

  // Calculate counts for each role and status
  const counts = useMemo(() => {
    const roleCounts: Record<AgentRole, number> = {
      orchestrator: 0,
      worker: 0,
      specialist: 0,
      reviewer: 0,
    };
    const statusCounts: Record<AgentStatus, number> = {
      working: 0,
      idle: 0,
      error: 0,
      offline: 0,
    };

    agents.forEach(agent => {
      roleCounts[agent.role]++;
      statusCounts[agent.status]++;
    });

    return { role: roleCounts, status: statusCounts };
  }, [agents]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, [setSearchQuery]);

  const toggleRoleFilter = useCallback((role: AgentRole) => {
    setRoleFilter(roleFilter === role ? null : role);
  }, [roleFilter, setRoleFilter]);

  const toggleStatusFilter = useCallback((status: AgentStatus) => {
    setStatusFilter(statusFilter === status ? null : status);
  }, [statusFilter, setStatusFilter]);

  return (
    <div
      className="px-6 py-3 border-b flex items-center gap-4"
      style={{ borderColor: 'rgba(255,255,255,0.05)' }}
    >
      {/* Results Count */}
      <div className="text-xs" style={{ color: TEXT_MUTED }}>
        <span className="font-mono" style={{ color: ACCENT }}>
          {filteredAgents.length}
        </span>{' '}
        agents
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <MagnifyingGlass
          size={14}
          color={TEXT_MUTED}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search agents..."
          className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none transition-colors"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${BORDER_COLOR}`,
            color: TEXT_COLOR,
          }}
        />
      </div>

      {/* Role Filters */}
      <div className="flex items-center gap-1">
        {roleOptions.map(({ value, label, color }) => {
          const isActive = roleFilter === value;
          return (
            <button
              key={value}
              onClick={() => toggleRoleFilter(value)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: isActive ? `${color}20` : BG_SURFACE,
                color: isActive ? color : TEXT_MUTED,
                border: `1px solid ${isActive ? color : BORDER_COLOR}`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: color }}
              />
              {label}
            </button>
          );
        })}
      </div>

      {/* Status Filters */}
      <div className="flex items-center gap-1">
        {statusOptions.map(({ value, label, color }) => {
          const isActive = statusFilter === value;
          return (
            <button
              key={value}
              onClick={() => toggleStatusFilter(value)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: isActive ? `${color}20` : BG_SURFACE,
                color: isActive ? color : TEXT_MUTED,
                border: `1px solid ${isActive ? color : BORDER_COLOR}`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: color }}
              />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
