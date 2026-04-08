/**
 * Platform Kernel/Control-Plane Client
 *
 * This client handles platform-internal event planes that are NOT the Gizzi runtime SDK:
 * - Session sync planes (OpenClaw, Native Agent)
 * - Gateway-level events
 * - Control-plane APIs
 *
 * IMPORTANT: This is distinct from @allternit/sdk which handles the Gizzi runtime API.
 * Do not use this client for Gizzi runtime session operations - use @allternit/sdk instead.
 *
 * @module platform-client
 * @version 1.0.0
 */

import { GATEWAY_BASE_URL } from './api-client';

// ============================================================================
// Types
// ============================================================================

export interface SessionSyncEvent {
  type: 'created' | 'updated' | 'deleted' | 'message_added' | 'status_changed';
  session_id?: string;
  session?: SessionSyncSession;
  changes?: SessionChanges;
  message?: SessionMessage;
  active?: boolean;
}

export interface SessionSyncSession {
  id: string;
  name?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
  last_accessed?: string;
  message_count: number;
  active: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface SessionChanges {
  name?: string | null;
  description?: string | null;
  active?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface SessionMessage {
  id: string;
  role: string;
  content: string;
  timestamp: string;
}

export interface AgentSessionSyncEvent {
  type: 'created' | 'updated' | 'deleted' | 'message_added' | 'status_changed';
  session_id?: string;
  session?: AgentSession;
  changes?: AgentSessionChanges;
  message?: AgentSessionMessage;
  active?: boolean;
}

export interface AgentSession {
  id: string;
  name?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  last_accessed?: string;
  message_count: number;
  active?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface AgentSessionChanges {
  name?: string | null;
  description?: string | null;
  active?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface AgentSessionMessage {
  id: string;
  role: string;
  content: string;
  timestamp: string;
}

export interface GatewayEvent {
  type: string;
  data: unknown;
  timestamp: string;
}

export interface SyncConnection {
  disconnect: () => void;
  isConnected: () => boolean;
}

// ============================================================================
// Platform Client
// ============================================================================

class PlatformClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = GATEWAY_BASE_URL;
  }

  // ========================================================================
  // OpenClaw Session Sync
  // ========================================================================

  /**
   * Connect to OpenClaw session sync SSE endpoint.
   * This is a platform-internal sync mechanism, NOT the Gizzi runtime event stream.
   *
   * Endpoint: GET /api/v1/sessions/sync or /sessions/sync
   */
  connectSessionSync(
    onEvent: (event: SessionSyncEvent) => void,
    onError?: (error: Error) => void,
    onOpen?: () => void
  ): SyncConnection {
    const path = this.baseUrl.includes('/api/v1') ? '/sessions/sync' : '/api/v1/sessions/sync';
    const url = `${this.baseUrl}${path}`;

    const eventSource = new EventSource(url);
    let connected = false;

    eventSource.onopen = () => {
      connected = true;
      onOpen?.();
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SessionSyncEvent;
        onEvent(data);
      } catch (error) {
        console.error('[PlatformClient] Failed to parse session sync event:', error);
      }
    };

    eventSource.onerror = (error) => {
      connected = false;
      onError?.(new Error('Session sync connection error'));
      console.error('[PlatformClient] Session sync error:', error);
    };

    return {
      disconnect: () => {
        eventSource.close();
        connected = false;
      },
      isConnected: () => connected,
    };
  }

  /**
   * Create a raw EventSource for OpenClaw session sync.
   * Use connectSessionSync() instead for most cases.
   */
  createSessionSyncSource(): EventSource {
    const path = this.baseUrl.includes('/api/v1') ? '/sessions/sync' : '/api/v1/sessions/sync';
    const url = `${this.baseUrl}${path}`;
    return new EventSource(url);
  }

  // ========================================================================
  // Native Agent Session Sync
  // ========================================================================

  /**
   * Connect to native agent session sync SSE endpoint.
   * This is a platform-internal sync mechanism for native agents.
   *
   * Endpoint: GET /api/v1/agent-sessions/sync
   */
  connectAgentSessionSync(
    onEvent: (event: AgentSessionSyncEvent) => void,
    onError?: (error: Error) => void,
    onOpen?: () => void
  ): SyncConnection {
    const url = `${this.baseUrl}/api/v1/agent-sessions/sync`;

    const eventSource = new EventSource(url);
    let connected = false;

    eventSource.onopen = () => {
      connected = true;
      onOpen?.();
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as AgentSessionSyncEvent;
        onEvent(data);
      } catch (error) {
        console.error('[PlatformClient] Failed to parse agent session sync event:', error);
      }
    };

    eventSource.onerror = (error) => {
      connected = false;
      onError?.(new Error('Agent session sync connection error'));
      console.error('[PlatformClient] Agent session sync error:', error);
    };

    return {
      disconnect: () => {
        eventSource.close();
        connected = false;
      },
      isConnected: () => connected,
    };
  }

  /**
   * Create a raw EventSource for native agent session sync.
   * Use connectAgentSessionSync() instead for most cases.
   */
  createAgentSessionSyncSource(): EventSource {
    return new EventSource(`${this.baseUrl}/api/v1/agent-sessions/sync`);
  }

  // ========================================================================
  // Gateway Events
  // ========================================================================

  /**
   * Connect to gateway-level SSE endpoint.
   * This receives gateway-wide events, not Gizzi runtime session events.
   *
   * Endpoint: GET /v1/events-http
   */
  connectGatewayEvents(
    onEvent: (event: GatewayEvent) => void,
    onError?: (error: Error) => void,
    onOpen?: () => void
  ): SyncConnection {
    const url = `${this.baseUrl}/v1/events-http`;

    const eventSource = new EventSource(url);
    let connected = false;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      // EventSource handles reconnection internally, but we track state
    };

    eventSource.onopen = () => {
      connected = true;
      reconnectAttempts = 0;
      onOpen?.();
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as GatewayEvent;
        onEvent(data);
      } catch (error) {
        console.error('[PlatformClient] Failed to parse gateway event:', error);
      }
    };

    eventSource.onerror = (error) => {
      connected = false;
      onError?.(new Error('Gateway events connection error'));
      console.error('[PlatformClient] Gateway events error:', error);

      // Attempt reconnection
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);

        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          eventSource.close();
          connect();
        }, delay);
      }
    };

    return {
      disconnect: () => {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        eventSource.close();
        connected = false;
      },
      isConnected: () => connected,
    };
  }

  /**
   * Create a raw EventSource for gateway events.
   * Use connectGatewayEvents() instead for most cases.
   */
  createGatewayEventSource(): EventSource {
    return new EventSource(`${this.baseUrl}/v1/events-http`);
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const platformClient = new PlatformClient();

// ============================================================================
// React Hooks
// ============================================================================

import { useEffect, useRef, useState, useCallback } from 'react';

export function useSessionSync(
  enabled: boolean = true,
  onEvent?: (event: SessionSyncEvent) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const connectionRef = useRef<SyncConnection | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const connection = platformClient.connectSessionSync(
      (event) => {
        onEvent?.(event);
      },
      () => setIsConnected(false),
      () => setIsConnected(true)
    );

    connectionRef.current = connection;

    return () => {
      connection.disconnect();
      connectionRef.current = null;
    };
  }, [enabled, onEvent]);

  return {
    isConnected,
    disconnect: useCallback(() => connectionRef.current?.disconnect(), []),
  };
}

export function useAgentSessionSync(
  enabled: boolean = true,
  onEvent?: (event: AgentSessionSyncEvent) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const connectionRef = useRef<SyncConnection | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const connection = platformClient.connectAgentSessionSync(
      (event) => {
        onEvent?.(event);
      },
      () => setIsConnected(false),
      () => setIsConnected(true)
    );

    connectionRef.current = connection;

    return () => {
      connection.disconnect();
      connectionRef.current = null;
    };
  }, [enabled, onEvent]);

  return {
    isConnected,
    disconnect: useCallback(() => connectionRef.current?.disconnect(), []),
  };
}

export default platformClient;
