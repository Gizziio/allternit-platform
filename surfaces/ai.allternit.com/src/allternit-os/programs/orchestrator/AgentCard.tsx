"use client";

import React, { useMemo } from 'react';
import { useIsClient } from '@/lib/hooks/use-is-client';
import type { OrchestratorAgent } from '../../types/programs';

interface AgentCardProps {
  agent: OrchestratorAgent;
  isLive?: boolean;
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent, isLive }) => {
  const isClient = useIsClient();
  const statusColors = {
    idle: 'bg-zinc-100 text-zinc-600',
    working: 'bg-blue-100 text-blue-700 animate-pulse',
    completed: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
  };

  const statusIcons = {
    idle: '⏸️',
    working: '🔄',
    completed: '✅',
    error: '❌',
  };

  const duration = useMemo(() => {
    if (!isClient) return null;
    if (agent.startTime && agent.endTime) {
      return ((agent.endTime - agent.startTime) / 1000).toFixed(1);
    }
    if (agent.startTime) {
      return ((Date.now() - agent.startTime) / 1000).toFixed(1);
    }
    return null;
  }, [isClient, agent.startTime, agent.endTime]);

  return (
    <div className={`p-4 rounded-lg border ${agent.status === 'working' ? 'border-blue-300 shadow-sm' : 'border-zinc-200 dark:border-zinc-700'} ${isLive ? 'ring-1 ring-blue-400/30' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{statusIcons[agent.status]}</span>
          <span className="font-medium text-zinc-900 dark:text-white">{agent.name}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">
            {agent.model}
          </span>
          {isLive && (
            <span className="size-2  bg-green-500 rounded-full animate-pulse" title="Live updates" />
          )}
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${statusColors[agent.status]}`}>
          {agent.status.toUpperCase()}
        </span>
      </div>

      {agent.currentTask && (
        <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
          {agent.currentTask}
        </div>
      )}

      {/* Progress bar */}
      <div className="mt-2">
        <div className="flex justify-between text-xs text-zinc-500 mb-1">
          <span>Progress</span>
          <span>{agent.progress}%</span>
        </div>
        <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${
              agent.status === 'error' ? 'bg-red-500' : 
              agent.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${agent.progress}%` }}
          />
        </div>
      </div>

      {/* Duration */}
      {duration && (
        <div className="mt-2 text-xs text-zinc-500">
          Duration: {duration}s
        </div>
      )}

      {/* Token usage */}
      {agent.tokensUsed && (
        <div className="mt-2 text-xs text-zinc-500">
          Tokens: {agent.tokensUsed.input + agent.tokensUsed.output.toLocaleString()} 
          (${agent.tokensUsed.cost?.toFixed(4) || '0.0000'})
        </div>
      )}

      {/* Recent logs */}
      {agent.logs.length > 0 && (
        <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <div className="text-xs text-zinc-500 mb-1">Recent Activity:</div>
          <div className="space-y-1 max-h-20 overflow-y-auto text-xs text-zinc-600 dark:text-zinc-400">
            {agent.logs.slice(-3).map((log, i) => (
              <div key={`${agent.id}-log-${i}-${log.slice(0, 20)}`} className="truncate">• {log}</div>
            ))}          </div>
        </div>
      )}
    </div>
  );
};
