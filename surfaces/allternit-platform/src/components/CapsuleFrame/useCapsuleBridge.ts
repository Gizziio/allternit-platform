/**
 * useCapsuleBridge Hook
 * 
 * React hook for managing capsule communication.
 * Handles event streaming, tool invocation, and state synchronization.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { CapsuleEvent, CapsulePermission } from './CapsuleFrame';

export interface CapsuleBridgeConfig {
  capsuleId: string;
  apiUrl?: string;
  autoConnect?: boolean;
}

export interface CapsuleState {
  id: string;
  type: string;
  state: 'pending' | 'active' | 'error' | 'closed';
  toolId: string;
  agentId?: string;
  permissions: CapsulePermission[];
}

export interface UseCapsuleBridgeReturn {
  /** Current capsule state */
  capsule: CapsuleState | null;
  /** Event history */
  events: CapsuleEvent[];
  /** Connection status */
  isConnected: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Send event to capsule */
  sendEvent: (eventType: string, payload?: unknown) => Promise<void>;
  /** Invoke tool on behalf of capsule */
  invokeTool: (tool: string, params: unknown) => Promise<unknown>;
  /** Clear event history */
  clearEvents: () => void;
  /** Reconnect to event stream */
  reconnect: () => void;
}

export function useCapsuleBridge(config: CapsuleBridgeConfig): UseCapsuleBridgeReturn {
  const { capsuleId, apiUrl = 'http://localhost:3000', autoConnect = true } = config;
  
  const [capsule, setCapsule] = useState<CapsuleState | null>(null);
  const [events, setEvents] = useState<CapsuleEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch capsule info
  const fetchCapsule = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/v1/mcp-apps/capsules/${capsuleId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch capsule: ${response.status}`);
      }
      const data = await response.json();
      setCapsule(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [capsuleId, apiUrl]);

  // Connect to SSE event stream
  const connectEventStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setIsLoading(true);
    setError(null);

    const eventSource = new EventSource(
      `${apiUrl}/api/v1/mcp-apps/capsules/${capsuleId}/stream`
    );

    eventSource.onopen = () => {
      setIsConnected(true);
      setIsLoading(false);
      reconnectAttemptsRef.current = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle different event types
        if (data.event_type === 'capsule:state_changed') {
          setCapsule(prev => prev ? { ...prev, state: data.payload.state } : null);
        }

        // Add to event history
        setEvents(prev => [
          ...prev,
          {
            type: data.event_type,
            payload: data.payload,
            timestamp: Date.now(),
          }
        ]);
      } catch (err) {
        console.error('[useCapsuleBridge] Failed to parse event:', err);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setIsLoading(false);
      eventSource.close();

      // Exponential backoff reconnect
      reconnectAttemptsRef.current++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);
      
      reconnectTimerRef.current = setTimeout(() => {
        if (autoConnect) {
          connectEventStream();
        }
      }, delay);
    };

    eventSourceRef.current = eventSource;
  }, [capsuleId, apiUrl, autoConnect]);

  // Send event to capsule
  const sendEvent = useCallback(async (eventType: string, payload?: unknown) => {
    try {
      const response = await fetch(
        `${apiUrl}/api/v1/mcp-apps/capsules/${capsuleId}/event`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: eventType,
            payload,
            source: 'ui',
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to send event: ${response.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  }, [capsuleId, apiUrl]);

  // Invoke tool
  const invokeTool = useCallback(async (tool: string, params: unknown) => {
    try {
      const response = await fetch(
        `${apiUrl}/api/v1/mcp-apps/capsules/${capsuleId}/invoke`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool, params }),
        }
      );

      if (!response.ok) {
        throw new Error(`Tool invocation failed: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  }, [capsuleId, apiUrl]);

  // Clear events
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // Reconnect
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connectEventStream();
  }, [connectEventStream]);

  // Initial setup
  useEffect(() => {
    if (autoConnect) {
      fetchCapsule();
      connectEventStream();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [autoConnect, fetchCapsule, connectEventStream]);

  return {
    capsule,
    events,
    isConnected,
    isLoading,
    error,
    sendEvent,
    invokeTool,
    clearEvents,
    reconnect,
  };
}

export default useCapsuleBridge;
