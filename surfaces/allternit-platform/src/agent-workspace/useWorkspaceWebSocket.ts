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
 *       console.log('Task updated:', payload);
 *     });
 *   }, [ws]);
 *   
 *   return <div>Status: {status}</div>;
 * }
 * ```
 */

import { useState, useEffect, useRef, useCallback } from 'react';
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
  const { url, password, autoConnect = true, ...wsOptions } = options;
  
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [error, setError] = useState<Error | null>(null);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  
  const wsRef = useRef<WorkspaceWebSocket | null>(null);

  // Create WebSocket instance
  useEffect(() => {
    if (!url) {
      wsRef.current = null;
      setStatus('disconnected');
      return;
    }

    const ws = new WorkspaceWebSocket(url, password, wsOptions);
    wsRef.current = ws;

    // Subscribe to status changes
    const unsubscribeStatus = ws.onStatusChange((newStatus) => {
      setStatus(newStatus);
      if (newStatus === 'error') {
        setError(new Error('WebSocket connection error'));
      } else if (newStatus === 'connected') {
        setError(null);
      }
    });

    // Subscribe to messages
    const unsubscribeMessage = ws.onMessage((message) => {
      setLastMessage(message);
    });

    // Auto-connect if enabled
    if (autoConnect) {
      ws.connect().catch((err) => {
        setError(err instanceof Error ? err : new Error(String(err)));
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
      setError(null);
      await wsRef.current.connect();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
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
  ): (() => void) | undefined => {
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
