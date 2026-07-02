"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSidecarStore } from '../../stores/useSidecarStore';
import { useKernelBridge } from '../../kernel/KernelBridge';
import { useRailsWebSocket } from '../../kernel/AllternitRailsWebSocketBridge';
import type { OrchestratorState, OrchestratorAgent } from '../../types/programs';

export function useAgentStatus(programId: string, isRunning: boolean) {
  const store = useSidecarStore();
  const { isConnected: kernelConnected, sendCommand } = useKernelBridge({
    autoConnect: isRunning,
  });
  
  const { isConnected: railsConnected, messages: railsMessages } = useRailsWebSocket({
    workspaceId: 'default',
    autoConnect: isRunning,
  });

  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const processedMessageCountRef = useRef(0);

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
          const timestamp = new Date().toLocaleTimeString();
          return {
            ...agent,
            status: (payload.status as OrchestratorAgent['status']) || agent.status,
            progress: payload.progress ?? agent.progress,
            currentTask: payload.task || agent.currentTask,
            logs: payload.log 
              ? [...agent.logs, `[${timestamp}] ${payload.log}`]
              : agent.logs,
          };
        }
        return agent;
      }),
    }));

    setLastUpdate(Date.now());
  }, [programId, store]);

  // Process Rails messages for agent updates
  useEffect(() => {
    if (!isRunning || !railsConnected) {
      processedMessageCountRef.current = railsMessages.length;
      return;
    }

    // Process only new messages
    const newMessages = railsMessages.slice(processedMessageCountRef.current);
    processedMessageCountRef.current = railsMessages.length;

    const agentMessages = newMessages.filter(
      msg => msg.kind === 'runner.status' || msg.kind === 'wih.update'
    );

    if (agentMessages.length > 0) {
      // Update agent status from Rails messages
      const latestMessage = agentMessages[agentMessages.length - 1];
      updateAgentStatusFromRails(latestMessage);
    }
  }, [railsMessages, isRunning, railsConnected, updateAgentStatusFromRails]);

  return {
    kernelConnected,
    railsConnected,
    lastUpdate,
    isAnyConnected: kernelConnected || railsConnected,
  };
}
