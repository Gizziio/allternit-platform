"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Robot, CaretDown, Check } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useAgentStore } from '@/lib/agents/agent.store';
import { WorkspaceTab } from '@/components/AgentDashboard/WorkspaceTab';

/**
 * Standalone per-agent workspace panel: pick an agent, browse and edit its
 * bootstrapped workspace files (agent.config.json + .allternit/*). Shared by
 * the Agent Hub "Workspace" tab and Settings → Agents "Workspace" sub-tab —
 * it reuses the same WorkspaceTab the Agent Dashboard mounts, so all three
 * surfaces expose identical file view/edit behavior.
 */
export function AgentWorkspacePanel() {
  const { agents, selectedAgentId, selectAgent, fetchAgents } = useAgentStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (agents.length === 0) {
      void fetchAgents();
    }
  }, [agents.length, fetchAgents]);

  // Close the picker on outside click / Escape (same pattern as the Agent Hub
  // tab dropdown).
  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pickerOpen]);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Agent picker */}
      <div className="p-3 px-4 border-b border-solid border-studio-border-subtle bg-studio-card flex items-center gap-3">
        <Robot size={16} className="text-[var(--accent-primary)] shrink-0" />
        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="inline-flex h-8 items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] cursor-pointer"
          >
            <span className="text-[var(--text-primary)] font-medium">
              {selectedAgent
                ? selectedAgent.name
                : agents.length === 0
                  ? 'No agents yet'
                  : 'Select an agent…'}
            </span>
            <CaretDown
              size={12}
              className={cn('transition-transform duration-200', pickerOpen && 'rotate-180')}
            />
          </button>

          <AnimatePresence>
            {pickerOpen && agents.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1 shadow-2xl"
              >
                {agents.map((agent) => (
                  <button
                    type="button"
                    key={agent.id}
                    onClick={() => {
                      selectAgent(agent.id);
                      setPickerOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2.5 rounded-lg border-none text-[13px] font-medium text-left transition-colors cursor-pointer',
                      selectedAgentId === agent.id
                        ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                        : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
                    )}
                  >
                    <span className="truncate">{agent.name}</span>
                    {selectedAgentId === agent.id && <Check size={14} weight="bold" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {selectedAgent && (
          <span className="text-[12px] text-studio-text-muted truncate">
            agents/{selectedAgent.id}
          </span>
        )}
      </div>

      {/* Workspace files for the selected agent */}
      {selectedAgent ? (
        <div className="flex-1 overflow-hidden">
          <WorkspaceTab agent={selectedAgent} />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-studio-text-muted p-8">
          <Robot size={64} className="mb-5 opacity-20" />
          <p className="text-[16px] mb-2 text-studio-text-secondary">
            Select an agent to view its workspace
          </p>
          <p className="text-[13px] text-center max-w-[340px]">
            Every agent is bootstrapped with a workspace of configuration,
            identity, memory, and governance files you can inspect and edit here.
          </p>
        </div>
      )}
    </div>
  );
}

export default AgentWorkspacePanel;
