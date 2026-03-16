/**
 * React Hook for Session Bridge
 * 
 * Provides convenient access to the SessionSyncClient from React components.
 * 
 * @example
 * ```tsx
 * function ChatView() {
 *   const { isConnected, sendMessage, isAgentThread } = useSessionBridge();
 *   
 *   const handleSend = async (text: string) => {
 *     if (isAgentThread) {
 *       await sendMessage(text);
 *     }
 *   };
 *   
 *   return (
 *     <div>
 *       <ConnectionStatus connected={isConnected} />
 *       <ChatInput onSend={handleSend} />
 *     </div>
 *   );
 * }
 * ```
 */

import { useCallback, useEffect, useState } from 'react';
import { useChatStore } from '../views/chat/ChatStore';
import { sessionBridge, SessionSyncClient } from './session-bridge';

export interface UseSessionBridgeOptions {
  /** Auto-connect on mount (default: false, connect at app level instead) */
  autoConnect?: boolean;
  /** Thread ID to operate on (defaults to active thread) */
  threadId?: string;
}

export interface UseSessionBridgeReturn {
  /** Whether the bridge is connected to the backend */
  isConnected: boolean;
  /** Whether the current/active thread is an agent thread */
  isAgentThread: boolean;
  /** The OpenClaw session ID for the current thread */
  sessionId: string | undefined;
  /** Send a message to the OpenClaw session */
  sendMessage: (text: string, role?: string) => Promise<void>;
  /** Convert current thread to agent thread */
  convertToAgent: () => Promise<string | undefined>;
  /** Create a new agent thread */
  createAgentThread: (name: string, description?: string) => Promise<string>;
  /** Delete the current agent thread */
  deleteAgentThread: () => Promise<void>;
  /** Get all agent threads */
  agentThreads: ReturnType<SessionSyncClient['getAgentThreads']>;
  /** Manual reconnect to the bridge */
  reconnect: () => void;
  /** The underlying session bridge instance */
  bridge: SessionSyncClient;
}

/**
 * Hook for using the session bridge in React components
 */
export function useSessionBridge(options: UseSessionBridgeOptions = {}): UseSessionBridgeReturn {
  const { autoConnect = false, threadId: explicitThreadId } = options;
  
  const [isConnected, setIsConnected] = useState(sessionBridge.connected);
  
  const activeThreadId = useChatStore(state => state.activeThreadId);
  const agentSessions = useChatStore(state => state.agentSessions);
  const threads = useChatStore(state => state.threads);
  
  const threadId = explicitThreadId || activeThreadId;
  const sessionId = threadId ? agentSessions.get(threadId) : undefined;
  const isAgentThread = !!sessionId;
  
  const currentThread = threads.find(t => t.id === threadId);

  // Subscribe to connection changes
  useEffect(() => {
    const unsubscribe = sessionBridge.onConnectionChange((connected) => {
      setIsConnected(connected);
    });
    
    return unsubscribe;
  }, []);

  // Auto-connect if requested
  useEffect(() => {
    if (autoConnect && !sessionBridge.connected) {
      sessionBridge.connect();
    }
  }, [autoConnect]);

  const sendMessage = useCallback(async (text: string, role: string = 'user') => {
    if (!threadId) {
      throw new Error('No active thread');
    }
    await sessionBridge.sendMessage(threadId, text, role);
  }, [threadId]);

  const convertToAgent = useCallback(async () => {
    if (!threadId) {
      throw new Error('No active thread');
    }
    return sessionBridge.convertToAgentThread(threadId);
  }, [threadId]);

  const createAgentThread = useCallback(async (name: string, description?: string) => {
    return sessionBridge.createAgentThread(name, description);
  }, []);

  const deleteAgentThread = useCallback(async () => {
    if (!threadId) {
      throw new Error('No active thread');
    }
    await sessionBridge.deleteThread(threadId);
  }, [threadId]);

  const agentThreads = sessionBridge.getAgentThreads();

  const reconnect = useCallback(() => {
    sessionBridge.disconnect();
    sessionBridge.connect();
  }, []);

  return {
    isConnected,
    isAgentThread,
    sessionId,
    sendMessage,
    convertToAgent,
    createAgentThread,
    deleteAgentThread,
    agentThreads,
    reconnect,
    bridge: sessionBridge,
  };
}

/**
 * Hook to check if a specific thread is an agent thread
 */
export function useIsAgentThread(threadId?: string): boolean {
  const agentSessions = useChatStore(state => state.agentSessions);
  const activeThreadId = useChatStore(state => state.activeThreadId);
  const targetThreadId = threadId || activeThreadId;
  
  return targetThreadId ? agentSessions.has(targetThreadId) : false;
}

/**
 * Hook to get the session ID for a thread
 */
export function useThreadSessionId(threadId?: string): string | undefined {
  const agentSessions = useChatStore(state => state.agentSessions);
  const activeThreadId = useChatStore(state => state.activeThreadId);
  const targetThreadId = threadId || activeThreadId;
  
  return targetThreadId ? agentSessions.get(targetThreadId) : undefined;
}

export default useSessionBridge;
