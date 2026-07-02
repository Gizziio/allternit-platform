"use client";

import * as React from 'react';
const { useState, useEffect, useMemo, useCallback } = React;
import { useSidecarStore } from '../../stores/useSidecarStore';
import { useIsClient } from '../../../lib/hooks/use-is-client';
import type { AllternitProgram, OrchestratorState } from '../../types/programs';

// Modular components
import { useAgentStatus } from './useAgentStatus';
import { AgentCard } from './AgentCard';
import { TaskDAG } from './TaskDAG';
import { ConnectionStatus } from './ConnectionStatus';
import { OverallProgress } from './OverallProgress';
import { CostEstimate } from './CostEstimate';

interface OrchestratorProgramProps {
  program: AllternitProgram;
}

export const OrchestratorProgram: React.FC<OrchestratorProgramProps> = ({ program }) => {
  const { updateProgramState } = useSidecarStore();
  const state = program.state as OrchestratorState;
  const isClient = useIsClient();
  const [activeTab, setActiveTab] = useState<'agents' | 'dag' | 'logs'>('agents');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const agents = state?.agents ?? [];
  const taskGraph = state?.taskGraph ?? { nodes: [], edges: [] };
  const overallProgress = state?.overallProgress ?? 0;
  const isRunning = state?.isRunning ?? false;
  const originalPrompt = state?.originalPrompt ?? '';
  const costEstimate = state?.costEstimate;

  // Real-time connection to kernel and rails
  const { kernelConnected, railsConnected, lastUpdate, isAnyConnected } = useAgentStatus(
    program.id,
    isRunning
  );

  // Calculate actual cost from agent token usage
  const actualCost = useMemo(() => {
    return agents.reduce((total, agent) => {
      return total + (agent.tokensUsed?.cost || 0);
    }, 0);
  }, [agents]);

  // Task lookup map for performance
  const nodesMap = useMemo(() => {
    const map = new Map<string, any>();
    taskGraph.nodes.forEach(node => map.set(node.id, node));
    return map;
  }, [taskGraph.nodes]);

  const selectedNodeData = selectedNode ? nodesMap.get(selectedNode) : null;

  // Calculate overall progress from agents (Inline Adjustment)
  const [prevAgents, setPrevAgents] = useState(agents);
  if (agents !== prevAgents && agents.length > 0) {
    setPrevAgents(agents);
    const totalProgress = agents.reduce((sum, agent) => sum + agent.progress, 0);
    const averageProgress = Math.round(totalProgress / agents.length);

    if (averageProgress !== overallProgress) {
      updateProgramState<OrchestratorState>(program.id, (prev) => ({
        ...prev,
        overallProgress: averageProgress,
        isRunning: averageProgress < 100 && agents.some(a => a.status === 'working'),
      }));
    }
  }

  // Simulation fallback when no real connection
  useEffect(() => {
    if (!isClient) return;
    if (isAnyConnected || !isRunning) return;

    // Simulate progress updates when not connected to real kernel
    const interval = setInterval(() => {
      updateProgramState<OrchestratorState>(program.id, (prev) => ({
        ...prev,
        agents: prev.agents.map(agent => {
          if (agent.status === 'working' && agent.progress < 100) {
            const newProgress = Math.min(100, agent.progress + Math.random() * 10);
            const timestamp = new Date().toLocaleTimeString();
            return { 
              ...agent, 
              progress: newProgress,
              status: newProgress >= 100 ? 'completed' : 'working',
              endTime: newProgress >= 100 ? Date.now() : agent.endTime,
              logs: newProgress >= 100 
                ? [...agent.logs, `[${timestamp}] Task completed successfully`]
                : agent.logs,
            };
          }
          return agent;
        }),
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, [isAnyConnected, isRunning, program.id, updateProgramState]);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNode(nodeId);
    const node = nodesMap.get(nodeId);
    if (node?.assignedAgent) {
      // Find and highlight the agent
      const agent = agents.find(a => a.id === node.assignedAgent);
      if (agent) {
        setActiveTab('agents');
      }
    }
  }, [nodesMap, agents]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-3">
          <span className="text-xl">🧠</span>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Orchestrator
            </h2>
            <p className="text-xs text-zinc-500 truncate max-w-md">
              {originalPrompt || 'Multi-Agent Execution'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <ConnectionStatus kernelConnected={kernelConnected} railsConnected={railsConnected} />
          
          {isRunning && (
            <span className="flex items-center gap-1 text-xs text-blue-600">
              <span className="size-2  bg-blue-600 rounded-full animate-pulse" />
              Running
            </span>
          )}
          <span className="text-xs text-zinc-500">
            Mode: {state?.executionMode?.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
        <OverallProgress progress={overallProgress} isRunning={isRunning} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-700">
        {(['agents', 'dag', 'logs'] as const).map(tab => (
          <button type="button"
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === tab 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'agents' && (
          <div className="space-y-4">
            {/* Active agents */}
            {agents.filter(a => a.status === 'working').length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
                  Active ({agents.filter(a => a.status === 'working').length})
                </h3>
                <div className="grid gap-3">
                  {agents.filter(a => a.status === 'working').map(agent => (
                    <AgentCard key={agent.id} agent={agent} isLive={isAnyConnected} />
                  ))}
                </div>
              </div>
            )}

            {/* Completed agents */}
            {agents.filter(a => a.status === 'completed').length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
                  Completed ({agents.filter(a => a.status === 'completed').length})
                </h3>
                <div className="grid gap-3">
                  {agents.filter(a => a.status === 'completed').map(agent => (
                    <AgentCard key={agent.id} agent={agent} />
                  ))}
                </div>
              </div>
            )}

            {/* Idle/Error agents */}
            {agents.filter(a => a.status === 'idle' || a.status === 'error').length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
                  Others
                </h3>
                <div className="grid gap-3">
                  {agents.filter(a => a.status === 'idle' || a.status === 'error').map(agent => (
                    <AgentCard key={agent.id} agent={agent} />
                  ))}
                </div>
              </div>
            )}

            {/* Cost estimate */}
            <CostEstimate costEstimate={costEstimate} actualCost={actualCost} />
          </div>
        )}

        {activeTab === 'dag' && (
          <div className="space-y-4">
            <TaskDAG 
              nodes={taskGraph.nodes} 
              edges={taskGraph.edges}
              onNodeClick={handleNodeClick}
            />
            
            {selectedNodeData && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
                  Selected Task: {selectedNodeData.name}
                </h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Status: {selectedNodeData.status}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-2">
            {agents.flatMap(agent => 
              agent.logs.map((log, logIdx) => (
                <div 
                  key={`${agent.id}-${logIdx}`}
                  className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded text-sm font-mono"
                >
                  <span className="text-zinc-400">[{agent.name}]</span>{' '}
                  <span className="text-zinc-600 dark:text-zinc-400">{log}</span>
                </div>
              ))
            )}
            {agents.every(a => a.logs.length === 0) && (
              <div className="text-center text-zinc-400 py-8">No logs yet</div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500 flex justify-between">
        <span>{agents.length} agents • {taskGraph.nodes.length} tasks</span>
        <span>Last update: {isClient && lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : '...'}</span>
      </div>
    </div>
  );
};
