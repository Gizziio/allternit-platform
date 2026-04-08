/**
 * Capsule Client
 *
 * Client for MCP Apps / Capsules API.
 * This is a product-specific client for capsule lifecycle and event streaming,
 * separate from the Gizzi runtime SDK.
 *
 * @module capsule-client
 * @version 1.0.0
 * @see PLATFORM_EVENT_PLANE_CLASSIFICATION.md - Category D: Capsule
 */

import type { Capsule, CapsuleEvent, CreateCapsuleRequest } from '../store/slices/mcpAppsSlice';

const API_BASE = '/api/v1/mcp-apps';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface CapsuleStreamConnection {
  /** Disconnect from the event stream */
  disconnect: () => void;
  /** Check if connected */
  isConnected: () => boolean;
}

// ============================================================================
// Capsule Client
// ============================================================================

export class CapsuleClient {
  private baseUrl: string;
  private activeStreams = new Map<string, EventSource>();

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  // ========================================================================
  // Capsule CRUD
  // ========================================================================

  async listCapsules(): Promise<Capsule[]> {
    const response = await fetch(`${this.baseUrl}/capsules`);
    if (!response.ok) {
      throw new Error(`Failed to list capsules: ${response.status}`);
    }
    return response.json();
  }

  async getCapsule(id: string): Promise<Capsule> {
    const response = await fetch(`${this.baseUrl}/capsules/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to get capsule: ${response.status}`);
    }
    return response.json();
  }

  async createCapsule(request: CreateCapsuleRequest): Promise<Capsule> {
    const response = await fetch(`${this.baseUrl}/capsules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new Error(`Failed to create capsule: ${response.status}`);
    }
    return response.json();
  }

  async deleteCapsule(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/capsules/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to delete capsule: ${response.status}`);
    }
  }

  // ========================================================================
  // State Management
  // ========================================================================

  async updateCapsuleState(
    id: string,
    state: 'pending' | 'active' | 'error' | 'closed',
    error?: string
  ): Promise<Capsule> {
    const response = await fetch(`${this.baseUrl}/capsules/${id}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, error }),
    });
    if (!response.ok) {
      throw new Error(`Failed to update capsule state: ${response.status}`);
    }
    return response.json();
  }

  // ========================================================================
  // Events
  // ========================================================================

  async sendEvent(
    id: string,
    eventType: string,
    payload?: unknown,
    source = 'ui'
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/capsules/${id}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: eventType, payload, source }),
    });
    if (!response.ok) {
      throw new Error(`Failed to send event: ${response.status}`);
    }
  }

  /**
   * Create a raw EventSource for capsule events.
   * Consider using connectEventStream() instead for automatic cleanup.
   */
  createEventStream(id: string): EventSource {
    const eventSource = new EventSource(`${this.baseUrl}/capsules/${id}/stream`);
    this.activeStreams.set(id, eventSource);
    
    eventSource.onclose = () => {
      this.activeStreams.delete(id);
    };
    
    return eventSource;
  }

  /**
   * Connect to capsule event stream with managed lifecycle.
   * 
   * @param id - Capsule ID
   * @param onEvent - Callback for each event
   * @param onError - Optional error callback
   * @returns Connection handle with disconnect method
   */
  connectEventStream(
    id: string,
    onEvent: (event: CapsuleEvent) => void,
    onError?: (error: Error) => void
  ): CapsuleStreamConnection {
    const eventSource = new EventSource(`${this.baseUrl}/capsules/${id}/stream`);
    this.activeStreams.set(id, eventSource);
    let connected = true;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as CapsuleEvent;
        onEvent(data);
      } catch (error) {
        console.error('[CapsuleClient] Failed to parse event:', error);
      }
    };

    eventSource.onerror = (error) => {
      connected = false;
      onError?.(new Error('Capsule event stream error'));
      console.error('[CapsuleClient] Event stream error:', error);
    };

    eventSource.onopen = () => {
      connected = true;
    };

    return {
      disconnect: () => {
        eventSource.close();
        this.activeStreams.delete(id);
        connected = false;
      },
      isConnected: () => connected,
    };
  }

  /**
   * Disconnect all active streams for a capsule.
   */
  disconnectStream(id: string): void {
    const eventSource = this.activeStreams.get(id);
    if (eventSource) {
      eventSource.close();
      this.activeStreams.delete(id);
    }
  }

  /**
   * Disconnect all active streams.
   */
  disconnectAll(): void {
    this.activeStreams.forEach((eventSource, id) => {
      eventSource.close();
    });
    this.activeStreams.clear();
  }

  // ========================================================================
  // Tool Invocation
  // ========================================================================

  async invokeTool(id: string, tool: string, params: unknown): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/capsules/${id}/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, params }),
    });
    if (!response.ok) {
      throw new Error(`Failed to invoke tool: ${response.status}`);
    }
    return response.json();
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const capsuleClient = new CapsuleClient();

// ============================================================================
// React Hooks
// ============================================================================

import { useEffect, useRef, useState, useCallback } from 'react';

export function useCapsuleClient() {
  return capsuleClient;
}

export function useCapsuleEventStream(
  capsuleId: string | null,
  onEvent: (event: CapsuleEvent) => void,
  options: { autoConnect?: boolean; onError?: (error: Error) => void } = {}
) {
  const { autoConnect = true, onError } = options;
  const [isConnected, setIsConnected] = useState(false);
  const connectionRef = useRef<CapsuleStreamConnection | null>(null);

  const connect = useCallback(() => {
    if (!capsuleId) return;

    const connection = capsuleClient.connectEventStream(
      capsuleId,
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
  }, [capsuleId, onEvent, onError]);

  const disconnect = useCallback(() => {
    connectionRef.current?.disconnect();
    connectionRef.current = null;
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (autoConnect && capsuleId) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [autoConnect, capsuleId, connect, disconnect]);

  return {
    isConnected,
    connect,
    disconnect,
  };
}

export default CapsuleClient;
