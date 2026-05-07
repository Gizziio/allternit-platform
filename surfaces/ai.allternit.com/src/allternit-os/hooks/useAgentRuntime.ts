/**
 * allternit Super-Agent OS - Agent Runtime Hook
 * 
 * Main integration hook for the Chat interface to interact with:
 * - Kernel protocol (message processing)
 * - Program launching
 * - Auto-detection of program needs
 * - Streaming content handling
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import { useSidecarStore } from '../stores/useSidecarStore';
import { useKernelProtocol } from '../kernel/KernelProtocol';
import { useKernelBridge } from '../kernel/KernelBridge';
import { useLaunchProtocol } from '../utils/launchProtocol';
import type { AllternitProgramType } from '../types/programs';

// ============================================================================
// Types
// ============================================================================

export interface AgentRuntimeOptions {
  threadId: string;
  kernelEndpoint?: string;
  autoLaunch?: boolean;
  onProgramLaunch?: (programId: string, type: AllternitProgramType) => void;
  onError?: (error: Error) => void;
}

export interface AgentRuntime {
  isConnected: boolean;
  reconnect: () => void;
  sendToKernel: (message: Record<string, unknown>) => void;
  processResponse: (content: string) => void;
  launchProgram: (type: AllternitProgramType, title: string, params?: Record<string, unknown>) => string;
  getActiveProgram: () => string | null;
  isStreaming: boolean;
  setAutoLaunch: (enabled: boolean) => void;
}

// ============================================================================
// Main Hook
// ============================================================================

export function useAgentRuntime(options: AgentRuntimeOptions): AgentRuntime {
  const { threadId, kernelEndpoint = 'ws://localhost:8080/kernel' } = options;
  
  const store = useSidecarStore();
  const protocol = useKernelProtocol(threadId);
  const bridge = useKernelBridge({
    endpoint: kernelEndpoint,
    onConnectionChange: (connected) => {
      console.log(`[AgentRuntime] Kernel ${connected ? 'connected' : 'disconnected'}`);
    },
    onError: options.onError,
  });
  const launcher = useLaunchProtocol(threadId);
  
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    const unsubscribe = useSidecarStore.subscribe((state) => {
      const hasActiveStreams = Object.keys(state.activeStreams).length > 0;
      setIsStreaming(hasActiveStreams);
    });
    
    return unsubscribe;
  }, []);

  const sendToKernel = useCallback((message: Record<string, unknown>) => {
    bridge.sendCommand({
      command: 'execute',
      payload: message,
    });
  }, [bridge]);

  const processResponse = useCallback((content: string) => {
    protocol.processAgentResponse(content);
    bridge.sendCommand({
      command: 'execute',
      payload: { type: 'agent.response', content, threadId },
    });
  }, [protocol, bridge, threadId]);

  const launchProgram = useCallback((
    type: AllternitProgramType,
    title: string,
    params?: Record<string, unknown>
  ): string => {
    switch (type) {
      case 'research-doc':
        return launcher.launchResearchDoc(title, params?.topic as string || title, { focus: true });
      case 'data-grid':
        return launcher.launchDataGrid(title, (params?.columns as any[]) || [], { focus: true });
      case 'presentation':
        return launcher.launchPresentation(title, { focus: true });
      case 'code-preview':
        return launcher.launchCodePreview(title, (params?.files as any[]) || [], (params?.entryFile as string) || 'index.html', { focus: true });
      case 'orchestrator':
        return launcher.launchOrchestrator(params?.task as string || title);
      case 'asset-manager':
        return launcher.launchAssetManager();
      case 'image-studio':
        return launcher.launchImageStudio(params?.imageUrl as string);
      case 'audio-studio':
        return launcher.launchAudioStudio(title);
      case 'telephony':
        return launcher.launchTelephony(params?.phoneNumber as string);
      default:
        throw new Error(`Unknown program type: ${type}`);
    }
  }, [launcher]);

  const getActiveProgram = useCallback((): string | null => {
    return store.activeProgramId;
  }, [store]);

  const reconnect = useCallback(() => {
    bridge.bridge?.disconnect();
    setTimeout(() => bridge.bridge?.connect(), 100);
  }, [bridge]);

  const setAutoLaunch = useCallback((enabled: boolean) => {
    protocol.setAutoLaunch(enabled);
  }, [protocol]);

  return {
    isConnected: bridge.isConnected,
    reconnect,
    sendToKernel,
    processResponse,
    launchProgram,
    getActiveProgram,
    isStreaming,
    setAutoLaunch,
  };
}

// ============================================================================
// Chat Integration Hook
// ============================================================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    launchedPrograms?: string[];
    streaming?: boolean;
  };
}

export function useChatWithPrograms(threadId: string) {
  const runtime = useAgentRuntime({ threadId, autoLaunch: true });
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const sendMessage = useCallback((content: string) => {
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, userMsg]);
    
    runtime.sendToKernel({
      type: 'chat.message',
      content,
      threadId,
    });
  }, [runtime, threadId]);

  const receiveMessage = useCallback((content: string) => {
    runtime.processResponse(content);
    
    const assistantMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, assistantMsg]);
  }, [runtime]);

  return {
    messages,
    sendMessage,
    receiveMessage,
    isConnected: runtime.isConnected,
    isStreaming: runtime.isStreaming,
    launchProgram: runtime.launchProgram,
  };
}

// ============================================================================
// Program Streaming Hook
// ============================================================================

export function useProgramStreaming(programId: string) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [buffer, setBuffer] = useState('');
  
  useEffect(() => {
    const unsubscribe = useSidecarStore.subscribe((state) => {
      const streaming = !!state.activeStreams[programId];
      setIsStreaming(streaming);
      
      if (streaming) {
        const program = state.programs[programId];
        if (program?.state && typeof program.state === 'object' && 'streamingContent' in program.state) {
          const content = (program.state as { streamingContent?: { buffer: string } }).streamingContent;
          setBuffer(content?.buffer || '');
        }
      }
    });
    
    return unsubscribe;
  }, [programId]);

  return { isStreaming, buffer };
}

export default useAgentRuntime;
