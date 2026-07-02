/**
 * React Hook for Workspace WebSocket
 * 
 * Provides reactive WebSocket connection with automatic cleanup.
 * 
 * @example
 * ```tsx
 * function TaskList() {
 *   const { ws, status, isConnected } = useWorkspaceWebSocket({
 *     url: 'ws://localhost:3010/ws',
 *     password: 'secret',
 *   });
 *   
 *   useEffect(() => {
 *     if (!ws) return;
 *     
 *     return ws.on('task_update', (payload) => {
 *       console.debug('Task updated:', payload);
 *     });
 *   }, [ws]);
 *   
 *   return <div>Status: {status}</div>;
 * }
 * ```
 */

import { useState, useEffect, useRef, useCallback, useReducer } from 'react';
import { 
  WorkspaceWebSocket, 
  WebSocketStatus, 
  WebSocketMessage,
  WorkspaceWebSocketOptions 
} from './websocket';

export interface UseWorkspaceWebSocketOptions extends WorkspaceWebSocketOptions {
  /** WebSocket URL (null to not connect) */
  url: string | null;
  /** Password for authentication */
  password: string;
  /** Auto-connect on mount */
  autoConnect?: boolean;
}

export interface UseWorkspaceWebSocketReturn {
  /** WebSocket client instance */
  ws: WorkspaceWebSocket | null;
  /** Connection status */
  status: WebSocketStatus;
  /** Whether connected */
  isConnected: boolean;
  /** Connection error */
  error: Error | null;
  /** Last received message */
  lastMessage: WebSocketMessage | null;
  /** Connect manually */
  connect: () => Promise<void>;
  /** Disconnect manually */
  disconnect: () => void;
  /** Send a message */
  send: (message: unknown) => void;
  /** Subscribe to message type */
  on: <T extends WebSocketMessage>(
    type: T['type'],
    handler: (payload: T['payload']) => void
  ) => (() => void) | undefined;
}

export function useWorkspaceWebSocket(
  options: UseWorkspaceWebSocketOptions
): UseWorkspaceWebSocketReturn {
  const { url, password, autoConnect, ...wsOptions } = options;

  type State = {
    status: WebSocketStatus;
    error: Error | null;
    lastMessage: WebSocketMessage | null;
  };

  type Action = 
    | { type: 'SET_STATUS'; status: WebSocketStatus }
    | { type: 'SET_ERROR'; error: Error | null }
    | { type: 'SET_MESSAGE'; message: WebSocketMessage }
    | { type: 'RESET'; url: string | null };

  const [state, dispatch] = useReducer((state: State, action: Action): State => {
    switch (action.type) {
      case 'SET_STATUS': return { ...state, status: action.status };
      case 'SET_ERROR': return { ...state, error: action.error };
      case 'SET_MESSAGE': return { ...state, lastMessage: action.message };
      case 'RESET': return { ...state, status: action.url ? state.status : 'disconnected', error: null, lastMessage: null };
      default: return state;
    }
  }, {
    status: 'disconnected',
    error: null,
    lastMessage: null
  });

  const { status, error, lastMessage } = state;
  const wsRef = useRef<WorkspaceWebSocket | null>(null);

  // Memoize options to avoid stringify in deps
  const memoizedOptions = useRef(wsOptions);
  useEffect(() => {
    memoizedOptions.current = wsOptions;
  }, [wsOptions]);

  // Create WebSocket instance
  useEffect(() => {
    if (!url) {
      wsRef.current = null;
      dispatch({ type: 'RESET', url: null });
      return;
    }

    const ws = new WorkspaceWebSocket(url, password, memoizedOptions.current);
    wsRef.current = ws;

    // Subscribe to status changes
    const unsubscribeStatus = ws.onStatusChange((newStatus) => {
      dispatch({ type: 'SET_STATUS', status: newStatus });
      if (newStatus === 'error') {
        dispatch({ type: 'SET_ERROR', error: new Error('WebSocket connection error') });
      } else if (newStatus === 'connected') {
        dispatch({ type: 'SET_ERROR', error: null });
      }
    });

    // Subscribe to messages
    const unsubscribeMessage = ws.onMessage((message) => {
      dispatch({ type: 'SET_MESSAGE', message });
    });

    // Auto-connect if enabled
    if (autoConnect) {
      ws.connect().catch((err) => {
        dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err : new Error(String(err)) });
      });
    }

    // Cleanup on unmount
    return () => {
      unsubscribeStatus();
      unsubscribeMessage();
      ws.disconnect();
      wsRef.current = null;
    };
  }, [url, password, autoConnect]);
  const connect = useCallback(async () => {
    if (!wsRef.current) {
      throw new Error('WebSocket not initialized');
    }
    
    try {
      dispatch({ type: 'SET_ERROR', error: null });
      await wsRef.current.connect();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      dispatch({ type: 'SET_ERROR', error });
      throw error;
    }
    }, []);

    const disconnect = useCallback(() => {
    wsRef.current?.disconnect();
    }, []);

    const send = useCallback((message: unknown) => {
    wsRef.current?.send(message);
    }, []);

    const on = useCallback(<T extends WebSocketMessage>(
    type: T['type'],
    handler: (payload: T['payload']) => void
    ) => {
    return wsRef.current?.on(type, handler);
    }, []);

    return {
    ws: wsRef.current,
    status,
    isConnected: status === 'connected',
    error,
    lastMessage,
    connect,
    disconnect,
    send,
    on,
    };
}

export default useWorkspaceWebSocket;
