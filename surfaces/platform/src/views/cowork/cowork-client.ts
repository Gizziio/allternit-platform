/**
 * Cowork Client
 *
 * Client for collaborative session event streaming.
 * This is a product-specific client for cowork collaboration features,
 * separate from the Gizzi runtime SDK.
 *
 * @module cowork-client
 * @version 1.0.0
 * @see PLATFORM_EVENT_PLANE_CLASSIFICATION.md - Category G: Cowork
 */

import { GATEWAY_BASE_URL } from '../../integration/api-client';

// ============================================================================
// Types
// ============================================================================

export type CoworkSessionStatus = 'pending' | 'running' | 'paused' | 'error' | 'completed';

export type CoworkEventType = 
  | 'observation'
  | 'action'
  | 'approval_request'
  | 'approval_response'
  | 'status_change'
  | 'error'
  | 'message';

export interface CoworkEvent {
  type: CoworkEventType;
  sessionId: string;
  timestamp: string;
  data?: unknown;
}

export interface CoworkObservationEvent extends CoworkEvent {
  type: 'observation';
  data: {
    description: string;
    screenshot?: string;
    url?: string;
  };
}

export interface CoworkActionEvent extends CoworkEvent {
  type: 'action';
  data: {
    action: string;
    params?: Record<string, unknown>;
  };
}

export interface CoworkApprovalRequestEvent extends CoworkEvent {
  type: 'approval_request';
  data: {
    requestId: string;
    action: string;
    description: string;
  };
}

export interface CoworkControlAction {
  type: 'pause' | 'resume' | 'stop' | 'approve' | 'reject';
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface CoworkStreamConnection {
  sendControl: (action: CoworkControlAction) => Promise<void>;
  disconnect: () => void;
}

// ============================================================================
// Cowork Client
// ============================================================================

class CoworkClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = GATEWAY_BASE_URL;
  }

  /**
   * Connect to a Cowork session event stream.
   * 
   * Endpoint: GET /api/cowork/{sessionId}/stream
   * 
   * @param sessionId - The cowork session ID
   * @param onEvent - Callback for each event
   * @param onError - Error callback
   * @param onStatusChange - Optional status change callback
   * @returns Connection handle
   */
  connectStream(
    sessionId: string,
    onEvent: (event: CoworkEvent) => void,
    onError: (error: Error) => void,
    onStatusChange?: (status: CoworkSessionStatus) => void
  ): CoworkStreamConnection {
    const eventSource = new EventSource(`${this.baseUrl}/api/cowork/${sessionId}/stream`);
    
    eventSource.onopen = () => {
      console.log('[CoworkClient] Connected to session:', sessionId);
      onStatusChange?.('running');
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as CoworkEvent;
        onEvent(data);
        
        // Update status based on event type
        if (data.type === 'status_change' && onStatusChange) {
          onStatusChange((data as any).status as CoworkSessionStatus);
        }
      } catch (e) {
        console.error('[CoworkClient] Failed to parse event:', e);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('[CoworkClient] Connection error:', error);
      onError(new Error('Cowork stream connection failed'));
      onStatusChange?.('error');
    };
    
    return {
      sendControl: async (action: CoworkControlAction) => {
        try {
          const response = await fetch(`${this.baseUrl}/api/cowork/${sessionId}/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action)
          });

          if (!response.ok) {
            throw new Error(`Control action failed: ${response.status}`);
          }
        } catch (e) {
          console.error('[CoworkClient] Control action failed:', e);
          throw e;
        }
      },
      disconnect: () => {
        console.log('[CoworkClient] Disconnecting from session:', sessionId);
        eventSource.close();
        onStatusChange?.('paused');
      },
    };
  }

  /**
   * Create a raw EventSource for cowork events.
   * Consider using connectStream() instead for automatic cleanup.
   */
  createEventSource(sessionId: string): EventSource {
    return new EventSource(`${this.baseUrl}/api/cowork/${sessionId}/stream`);
  }

  /**
   * Send a control action to the cowork session.
   */
  async sendControl(sessionId: string, action: CoworkControlAction): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/cowork/${sessionId}/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action)
    });

    if (!response.ok) {
      throw new Error(`Control action failed: ${response.status}`);
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const coworkClient = new CoworkClient();

// ============================================================================
// React Hooks
// ============================================================================

import { useEffect, useRef, useState, useCallback } from 'react';

export function useCoworkClient() {
  return coworkClient;
}

export function useCoworkStream(
  sessionId: string | null,
  onEvent: (event: CoworkEvent) => void,
  options: {
    onError?: (error: Error) => void;
    onStatusChange?: (status: CoworkSessionStatus) => void;
    autoConnect?: boolean;
  } = {}
) {
  const { onError, onStatusChange, autoConnect = true } = options;
  const [status, setStatus] = useState<CoworkSessionStatus>('pending');
  const connectionRef = useRef<CoworkStreamConnection | null>(null);

  const connect = useCallback(() => {
    if (!sessionId) return;

    const connection = coworkClient.connectStream(
      sessionId,
      onEvent,
      (error) => {
        setStatus('error');
        onError?.(error);
      },
      (newStatus) => {
        setStatus(newStatus);
        onStatusChange?.(newStatus);
      }
    );

    connectionRef.current = connection;
  }, [sessionId, onEvent, onError, onStatusChange]);

  const disconnect = useCallback(() => {
    connectionRef.current?.disconnect();
    connectionRef.current = null;
    setStatus('paused');
  }, []);

  const sendControl = useCallback(async (action: CoworkControlAction) => {
    if (!connectionRef.current) {
      throw new Error('Not connected to cowork stream');
    }
    await connectionRef.current.sendControl(action);
  }, []);

  useEffect(() => {
    if (autoConnect && sessionId) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [autoConnect, sessionId, connect, disconnect]);

  return {
    status,
    connect,
    disconnect,
    sendControl,
  };
}

export default CoworkClient;
