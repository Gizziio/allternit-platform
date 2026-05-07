/**
 * Operator Client
 *
 * Client for thin-client direct execution event streaming.
 * This is a product-specific client for operator execution,
 * separate from the Gizzi runtime SDK.
 *
 * @module operator-client
 * @version 1.0.0
 * @see PLATFORM_EVENT_PLANE_CLASSIFICATION.md - Category H: Operator
 */

import { GATEWAY_BASE_URL } from './api-client';

// ============================================================================
// Types
// ============================================================================

export interface OperatorExecuteOptions {
  requestId: string;
  intent: string;
  mode: 'plan_only' | 'plan_then_execute' | 'execute_direct';
  context: Record<string, unknown>;
  preferences: {
    prefer_connector: boolean;
    allow_browser_automation: boolean;
    allow_desktop_fallback: boolean;
  };
  policy: {
    require_private_model: boolean;
    allowed_tools?: string[];
    forbidden_tools?: string[];
  };
}

export interface OperatorExecuteResponse {
  success: boolean;
  requestId: string;
  status: string;
}

export interface OperatorEvent {
  type: 'progress' | 'complete' | 'error' | 'tool_call' | 'tool_result' | 'approval_request';
  requestId: string;
  timestamp: string;
  data?: unknown;
}

export interface OperatorStreamConnection {
  disconnect: () => void;
  isConnected: () => boolean;
}

// ============================================================================
// Operator Client
// ============================================================================

class OperatorClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = GATEWAY_BASE_URL;
  }

  /**
   * Submit operator task for direct execution.
   * 
   * Endpoint: POST /api/v1/operator/execute
   */
  async execute(options: OperatorExecuteOptions): Promise<OperatorExecuteResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/operator/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Operator execute failed: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Connect to operator event stream (SSE).
   * 
   * Endpoint: GET /api/v1/operator/events/{requestId}
   * 
   * @param requestId - The execution request ID
   * @param onEvent - Callback for each event
   * @param onError - Error callback
   * @returns Connection handle
   */
  connectEventStream(
    requestId: string,
    onEvent: (event: OperatorEvent) => void,
    onError?: (error: Error) => void
  ): OperatorStreamConnection {
    const url = `${this.baseUrl}/api/v1/operator/events/${requestId}`;
    const eventSource = new EventSource(url);
    let connected = false;

    eventSource.onopen = () => {
      connected = true;
      console.log('[OperatorClient] Connected to event stream:', requestId);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as OperatorEvent;
        onEvent(data);
      } catch (err) {
        console.error('[OperatorClient] Failed to parse event:', err);
      }
    };

    eventSource.onerror = (error) => {
      connected = false;
      console.error('[OperatorClient] EventSource error:', error);
      onError?.(new Error('Operator event stream connection failed'));
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
   * Create a raw EventSource for operator events.
   * Consider using connectEventStream() instead for automatic cleanup.
   */
  createEventSource(requestId: string): EventSource {
    return new EventSource(`${this.baseUrl}/api/v1/operator/events/${requestId}`);
  }

  /**
   * Get operator health status.
   * 
   * Endpoint: GET /api/v1/operator/health
   */
  async health(): Promise<{ status: string; type: string }> {
    const response = await fetch(`${this.baseUrl}/api/v1/operator/health`);
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Execute with streaming response.
   * Combines execute() and connectEventStream() for convenience.
   */
  async executeWithStream(
    options: OperatorExecuteOptions,
    onEvent: (event: OperatorEvent) => void,
    onError?: (error: Error) => void
  ): Promise<OperatorStreamConnection> {
    // First, submit the execution request
    const result = await this.execute(options);
    
    if (!result.success) {
      throw new Error(`Execution failed: ${result.status}`);
    }

    // Then connect to the event stream
    return this.connectEventStream(result.requestId, onEvent, onError);
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const operatorClient = new OperatorClient();

// ============================================================================
// React Hooks
// ============================================================================

import { useEffect, useRef, useState, useCallback } from 'react';

export function useOperatorClient() {
  return operatorClient;
}

export function useOperatorEventStream(
  requestId: string | null,
  onEvent: (event: OperatorEvent) => void,
  options: { onError?: (error: Error) => void; autoConnect?: boolean } = {}
) {
  const { onError, autoConnect = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const connectionRef = useRef<OperatorStreamConnection | null>(null);

  const connect = useCallback(() => {
    if (!requestId) return;

    const connection = operatorClient.connectEventStream(
      requestId,
      (event) => {
        onEvent(event);
      },
      (error) => {
        setIsConnected(false);
        onError?.(error);
      }
    );

    connectionRef.current = connection;
    setIsConnected(connection.isConnected());
  }, [requestId, onEvent, onError]);

  const disconnect = useCallback(() => {
    connectionRef.current?.disconnect();
    connectionRef.current = null;
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (autoConnect && requestId) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [autoConnect, requestId, connect, disconnect]);

  return {
    isConnected,
    connect,
    disconnect,
  };
}

export function useOperatorHealth() {
  const [health, setHealth] = useState<{ status: string; type: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await operatorClient.health();
      setHealth(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Health check failed');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return { health, loading, error, refetch: checkHealth };
}

export default OperatorClient;
