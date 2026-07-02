"use client";

import { useMemo, useEffect } from 'react';
import { useAgentStore } from './agent.store';
import type { 
  Agent, 
  AgentRun, 
  AgentTask, 
  AgentMailMessage, 
  GateReview 
} from './agent.types';
import type { 
  CharacterLayerConfig, 
  CharacterStats 
} from './character.types';

/**
 * useAgent - Unified hook for agent data and operations
 * 
 * Centralizes access to agent-specific state from the store and 
 * provides convenient accessors for related data (runs, tasks, mail, etc.)
 */
export function useAgent(agentId?: string | null) {
  const store = useAgentStore();
  
  // Data selection
  const agent = useMemo(() => 
    agentId ? store.agents.find(a => a.id === agentId) : null,
    [store.agents, agentId]
  );
  
  const runs = useMemo(() => 
    agentId ? (store.runs[agentId] || []) : [],
    [store.runs, agentId]
  );
  
  const tasks = useMemo(() => 
    agentId ? (store.tasks[agentId] || []) : [],
    [store.tasks, agentId]
  );
  
  const mail = useMemo(() => 
    agentId ? (store.mail[agentId] || []) : [],
    [store.mail, agentId]
  );
  
  const unreadMailCount = useMemo(() => 
    agentId ? (store.unreadMailCount[agentId] || 0) : 0,
    [store.unreadMailCount, agentId]
  );
  
  const character = useMemo(() => 
    agentId ? store.character[agentId] : null,
    [store.character, agentId]
  );
  
  const stats = useMemo(() => 
    agentId ? store.characterStats[agentId] : null,
    [store.characterStats, agentId]
  );
  
  const reviews = useMemo(() => 
    agentId ? (store.reviews[agentId] || []) : [],
    [store.reviews, agentId]
  );

  const activeRun = useMemo(() => 
    agentId && store.activeAgentId === agentId ? store.activeRunId : null,
    [store.activeAgentId, store.activeRunId, agentId]
  );

  // Status flags
  const isWorking = useMemo(() => 
    runs.some(r => r.status === 'running'),
    [runs]
  );
  
  const hasErrors = useMemo(() => 
    runs.some(r => r.status === 'failed') || tasks.some(t => t.status === 'failed'),
    [runs, tasks]
  );

  // Auto-refresh logic (optional, can be triggered by caller)
  const refresh = async () => {
    if (!agentId) return;
    await Promise.all([
      store.fetchRuns(agentId),
      store.fetchTasks(agentId),
      store.fetchMail(agentId),
      store.loadCharacterLayer(agentId),
    ]);
  };

  // Operations proxy
  const ops = {
    update: (updates: Partial<Agent>) => agentId && store.updateAgent(agentId, updates),
    delete: () => agentId && store.deleteAgent(agentId),
    run: (input: string) => agentId && store.startRun(agentId, input),
    cancelRun: (runId: string) => agentId && store.cancelRun(agentId, runId),
    markMailRead: (messageId: string) => agentId && store.acknowledgeMail(agentId, messageId),
    updateCharacter: (config: Partial<CharacterLayerConfig>) => agentId && store.saveCharacterLayer(agentId, config as CharacterLayerConfig),
    compile: () => agentId && store.compileCharacterLayer(agentId),
  };

  return {
    // Data
    agent,
    runs,
    tasks,
    mail,
    unreadMailCount,
    character,
    stats,
    reviews,
    activeRun,
    
    // Status
    isWorking,
    hasErrors,
    isLoading: store.isLoadingAgents || store.isLoadingRuns || store.isLoadingTasks,
    
    // Actions
    refresh,
    ...ops,
  };
}
