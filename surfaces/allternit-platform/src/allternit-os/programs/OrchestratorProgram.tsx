/**
 * A2rchitect Super-Agent OS - Orchestrator Program (Live Dashboard)
 * 
 * Production-ready multi-agent orchestration with:
 * - Real-time kernel integration for agent status
 * - Live task DAG visualization
 * - WebSocket connection to Rails for runner updates
 * - Cost tracking and progress monitoring
 */

import * as React from 'react';
const { useState, useEffect, useMemo, useCallback, useRef } = React;
import { useSidecarStore } from '../stores/useSidecarStore';
import { useKernelBridge, KernelBackend } from '../kernel/KernelBridge';
import { useRailsWebSocket } from '../kernel/A2RRailsWebSocketBridge';
import type { A2rProgram, OrchestratorState, OrchestratorAgent } from '../types/programs';

interface OrchestratorProgramProps {
  program: A2rProgram;
}

// ============================================================================
// Real-Time Agent Status Hook
// ============================================================================

function useAgentStatus(programId: string, isRunning: boolean) {
  const store = useSidecarStore();
  const { isConnected: kernelConnected, sendCommand } = useKernelBridge({
    autoConnect: isRunning,
  });
  
  const { isConnected: railsConnected, messages: railsMessages } = useRailsWebSocket({
    workspaceId: 'default',
    autoConnect: isRunning,
  });

  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Process kernel updates
  useEffect(() => {
    if (!isRunning || !kernelConnected) return;

    // Poll for agent status from kernel
    const interval = setInterval(() => {
      sendCommand({
        command: 'query',
        programId,
        payload: { type: 'agent-status' },
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isRunning, kernelConnected, programId, sendCommand]);

  // Process Rails messages for agent updates
  useEffect(() => {
    if (!isRunning || !railsConnected) return;

    // Look for agent-related messages from Rails
    const agentMessages = railsMessages.filter(
      msg => msg.kind === 'runner.status' || msg.kind === 'wih.update'
    );

    if (agentMessages.length > 0) {
      // Update agent status from Rails messages
      const latestMessage = agentMessages[agentMessages.length - 1];
      updateAgentStatusFromRails(latestMessage);
    }
  }, [railsMessages, isRunning, railsConnected]);

  const updateAgentStatusFromRails = useCallback((message: { kind: string; payload: unknown }) => {
    const payload = message.payload as {
      agent_id?: string;
      status?: string;
      progress?: number;
      task?: string;
      log?: string;
    };

    if (!payload.agent_id) return;

    store.updateProgramState<OrchestratorState>(programId, (prev) => ({
      ...prev,
      agents: prev.agents.map(agent => {
        if (agent.id === payload.agent_id || agent.name === payload.agent_id) {
          return {
            ...agent,
            status: (payload.status as OrchestratorAgent['status']) || agent.status,
            progress: payload.progress ?? agent.progress,
            currentTask: payload.task || agent.currentTask,
            logs: payload.log 
              ? [...agent.logs, `[${new Date().toLocaleTimeString()}] ${payload.log}`]
              : agent.logs,
          };
        }
        return agent;
      }),
    }));

    setLastUpdate(Date.now());
  }, [programId, store]);

  return {
    kernelConnected,
    railsConnected,
    lastUpdate,
    isAnyConnected: kernelConnected || railsConnected,
  };
}

// ============================================================================
// Agent Status Card
// ============================================================================

const AgentCard: React.FC<{ 
  agent: OrchestratorAgent;
  isLive?: boolean;
}> = ({ agent, isLive }) => {
  const statusColors = {
    idle: 'bg-gray-100 text-gray-600',
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

  const duration = agent.startTime && agent.endTime 
    ? ((agent.endTime - agent.startTime) / 1000).toFixed(1)
    : agent.startTime 
      ? ((Date.now() - agent.startTime) / 1000).toFixed(1)
      : null;

  return (
    <div className={`p-4 rounded-lg border ${agent.status === 'working' ? 'border-blue-300 shadow-sm' : 'border-gray-200 dark:border-gray-700'} ${isLive ? 'ring-1 ring-blue-400/30' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{statusIcons[agent.status]}</span>
          <span className="font-medium text-gray-900 dark:text-white">{agent.name}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
            {agent.model}
          </span>
          {isLive && (
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Live updates" />
          )}
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${statusColors[agent.status]}`}>
          {agent.status.toUpperCase()}
        </span>
      </div>

      {agent.currentTask && (
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          {agent.currentTask}
        </div>
      )}

      {/* Progress bar */}
      <div className="mt-2">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progress</span>
          <span>{agent.progress}%</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
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
        <div className="mt-2 text-xs text-gray-500">
          Duration: {duration}s
        </div>
      )}

      {/* Token usage */}
      {agent.tokensUsed && (
        <div className="mt-2 text-xs text-gray-500">
          Tokens: {agent.tokensUsed.input + agent.tokensUsed.output.toLocaleString()} 
          (${agent.tokensUsed.cost?.toFixed(4) || '0.0000'})
        </div>
      )}

      {/* Recent logs */}
      {agent.logs.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="text-xs text-gray-500 mb-1">Recent Activity:</div>
          <div className="space-y-1 max-h-20 overflow-y-auto text-xs text-gray-600 dark:text-gray-400">
            {agent.logs.slice(-3).map((log, i) => (
              <div key={i} className="truncate">• {log}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Task DAG Visualization
// ============================================================================

const TaskDAG: React.FC<{ 
  nodes: OrchestratorState['taskGraph']['nodes'];
  edges: OrchestratorState['taskGraph']['edges'];
  onNodeClick?: (nodeId: string) => void;
}> = ({ nodes, edges, onNodeClick }) => {
  const levels = useMemo(() => {
    const levelMap = new Map<string, number>();
    
    const getLevel = (nodeId: string): number => {
      if (levelMap.has(nodeId)) return levelMap.get(nodeId)!;
      
      const node = nodes.find(n => n.id === nodeId);
      if (!node || node.dependencies.length === 0) {
        levelMap.set(nodeId, 0);
        return 0;
      }
      
      const maxDepLevel = Math.max(...node.dependencies.map(getLevel));
      const level = maxDepLevel + 1;
      levelMap.set(nodeId, level);
      return level;
    };
    
    nodes.forEach(n => getLevel(n.id));
    
    const levels: string[][] = [];
    levelMap.forEach((level, nodeId) => {
      if (!levels[level]) levels[level] = [];
      levels[level].push(nodeId);
    });
    
    return levels;
  }, [nodes]);

  const statusColors = {
    pending: 'bg-gray-200 dark:bg-gray-700 border-gray-300',
    running: 'bg-blue-100 dark:bg-blue-900/30 border-blue-400',
    completed: 'bg-green-100 dark:bg-green-900/30 border-green-400',
    error: 'bg-red-100 dark:bg-red-900/30 border-red-400',
  };

  const statusIcons = {
    pending: '⏳',
    running: '🔄',
    completed: '✅',
    error: '❌',
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Task DAG</h4>
      
      <div className="space-y-4">
        {levels.map((levelNodes, levelIndex) => (
          <div key={levelIndex} className="flex items-center gap-4">
            <span className="text-xs text-gray-400 w-8">L{levelIndex}</span>
            <div className="flex gap-3">
              {levelNodes.map(nodeId => {
                const node = nodes.find(n => n.id === nodeId);
                if (!node) return null;
                
                return (
                  <button
                    key={nodeId}
                    onClick={() => onNodeClick?.(nodeId)}
                    className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 transition-all hover:scale-105 ${
                      statusColors[node.status as keyof typeof statusColors] || statusColors.pending
                    }`}
                  >
                    <span>{statusIcons[node.status as keyof typeof statusIcons] || '⏳'}</span>
                    <span>{node.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex gap-4 text-xs">
        {Object.entries(statusColors).map(([status, colorClass]) => (
          <div key={status} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded ${colorClass.split(' ')[0]}`} />
            <span className="capitalize">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// Connection Status Indicator
// ============================================================================

const ConnectionStatus: React.FC<{
  kernelConnected: boolean;
  railsConnected: boolean;
}> = ({ kernelConnected, railsConnected }) => {
  if (!kernelConnected && !railsConnected) {
    return (
      <span className="flex items-center gap-1 text-xs text-gray-400" title="No real-time connection">
        <span className="w-2 h-2 bg-gray-400 rounded-full" />
        Simulated
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {kernelConnected && (
        <span className="flex items-center gap-1 text-xs text-green-600" title="Kernel connected">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Kernel
        </span>
      )}
      {railsConnected && (
        <span className="flex items-center gap-1 text-xs text-blue-600" title="Rails connected">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          Rails
        </span>
      )}
    </div>
  );
};

// ============================================================================
// Overall Progress
// ============================================================================

const OverallProgress: React.FC<{ progress: number; isRunning: boolean }> = ({ 
  progress, 
  isRunning 
}) => {
  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Overall Progress
        </span>
        <span className={`text-sm font-bold ${isRunning ? 'text-blue-600' : 'text-green-600'}`}>
          {progress}%
        </span>
      </div>
      
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-500 ${
            isRunning 
              ? 'bg-gradient-to-r from-blue-500 to-purple-500' 
              : 'bg-green-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {isRunning && (
        <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
          <span className="animate-pulse">●</span>
          <span>Execution in progress...</span>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Cost Estimate Panel
// ============================================================================

const CostEstimate: React.FC<{ 
  costEstimate?: OrchestratorState['costEstimate'];
  actualCost?: number;
}> = ({ costEstimate, actualCost }) => {
  if (!costEstimate) return null;

  const isOverBudget = actualCost && actualCost > costEstimate.estimatedCost;

  return (
    <div className={`p-4 rounded-lg border ${isOverBudget ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'}`}>
      <h4 className={`text-sm font-medium mb-2 ${isOverBudget ? 'text-red-800 dark:text-red-300' : 'text-yellow-800 dark:text-yellow-300'}`}>
        {isOverBudget ? '⚠️ Over Budget' : 'Cost Estimate'}
      </h4>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Input Tokens:</span>
          <span>{costEstimate.inputTokens.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Output Tokens:</span>
          <span>{costEstimate.outputTokens.toLocaleString()}</span>
        </div>
        {actualCost !== undefined && (
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Actual Cost:</span>
            <span className={isOverBudget ? 'text-red-600 font-medium' : ''}>${actualCost.toFixed(4)}</span>
          </div>
        )}
        <div className="flex justify-between font-medium pt-1 border-t border-yellow-200 dark:border-yellow-800">
          <span>Estimated:</span>
          <span>${costEstimate.estimatedCost.toFixed(4)}</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Orchestrator Program Component
// ============================================================================

export const OrchestratorProgram: React.FC<OrchestratorProgramProps> = ({ program }) => {
  const { updateProgramState } = useSidecarStore();
  const state = program.state as OrchestratorState;
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

  // Calculate overall progress from agents
  useEffect(() => {
    if (agents.length === 0) return;

    const totalProgress = agents.reduce((sum, agent) => sum + agent.progress, 0);
    const averageProgress = Math.round(totalProgress / agents.length);

    if (averageProgress !== overallProgress) {
      updateProgramState<OrchestratorState>(program.id, (prev) => ({
        ...prev,
        overallProgress: averageProgress,
        isRunning: averageProgress < 100 && agents.some(a => a.status === 'working'),
      }));
    }
  }, [agents, overallProgress, program.id, updateProgramState]);

  // Simulation fallback when no real connection
  useEffect(() => {
    if (isAnyConnected || !isRunning) return;

    // Simulate progress updates when not connected to real kernel
    const interval = setInterval(() => {
      updateProgramState<OrchestratorState>(program.id, (prev) => ({
        ...prev,
        agents: prev.agents.map(agent => {
          if (agent.status === 'working' && agent.progress < 100) {
            const newProgress = Math.min(100, agent.progress + Math.random() * 10);
            return { 
              ...agent, 
              progress: newProgress,
              status: newProgress >= 100 ? 'completed' : 'working',
              endTime: newProgress >= 100 ? Date.now() : agent.endTime,
              logs: newProgress >= 100 
                ? [...agent.logs, `[${new Date().toLocaleTimeString()}] Task completed successfully`]
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
    const node = taskGraph.nodes.find(n => n.id === nodeId);
    if (node?.assignedAgent) {
      // Find and highlight the agent
      const agent = agents.find(a => a.id === node.assignedAgent);
      if (agent) {
        setActiveTab('agents');
      }
    }
  }, [taskGraph.nodes, agents]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <span className="text-xl">🧠</span>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Orchestrator
            </h2>
            <p className="text-xs text-gray-500 truncate max-w-md">
              {originalPrompt || 'Multi-Agent Execution'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <ConnectionStatus kernelConnected={kernelConnected} railsConnected={railsConnected} />
          
          {isRunning && (
            <span className="flex items-center gap-1 text-xs text-blue-600">
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
              Running
            </span>
          )}
          <span className="text-xs text-gray-500">
            Mode: {state?.executionMode?.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <OverallProgress progress={overallProgress} isRunning={isRunning} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {(['agents', 'dag', 'logs'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === tab 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
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
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
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
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
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
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
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
            
            {selectedNode && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                  Selected Task: {taskGraph.nodes.find(n => n.id === selectedNode)?.name}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Status: {taskGraph.nodes.find(n => n.id === selectedNode)?.status}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-2">
            {agents.flatMap(agent => 
              agent.logs.map((log, i) => (
                <div 
                  key={`${agent.id}-${i}`}
                  className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm font-mono"
                >
                  <span className="text-gray-400">[{agent.name}]</span>{' '}
                  <span className="text-gray-600 dark:text-gray-400">{log}</span>
                </div>
              ))
            )}
            {agents.every(a => a.logs.length === 0) && (
              <div className="text-center text-gray-400 py-8">No logs yet</div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 flex justify-between">
        <span>{agents.length} agents • {taskGraph.nodes.length} tasks</span>
        <span>Last update: {new Date(lastUpdate).toLocaleTimeString()}</span>
      </div>
    </div>
  );
};

export default OrchestratorProgram;
