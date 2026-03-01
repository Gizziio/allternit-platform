// ============================================================================
// A2UI API Client - Enterprise Architecture Compliant
// ============================================================================
// Follows UI → Gateway → API → Services pattern
// All A2UI backend communication goes through this client
// ============================================================================

import { api, A2RApiError } from './api-client';
import type { A2UIPayload } from '@/capsules/a2ui/a2ui.types';

// ============================================================================
// A2UI Types
// ============================================================================

export interface A2UISession {
  id: string;
  chatId: string;
  messageId?: string;
  agentId?: string;
  payload: A2UIPayload;
  dataModel: Record<string, unknown>;
  status: 'active' | 'completed' | 'error';
  createdAt: string;
  updatedAt: string;
}

export interface A2UIActionRequest {
  sessionId: string;
  actionId: string;
  payload?: Record<string, unknown>;
  dataModel?: Record<string, unknown>;
  context?: {
    chatId?: string;
    messageId?: string;
    userId?: string;
  };
}

export interface A2UIActionResponse {
  success: boolean;
  sessionId: string;
  // Updated payload (if agent returns new UI)
  payload?: A2UIPayload;
  // Partial data model updates
  dataModelUpdates?: Record<string, unknown>;
  // Message to display to user
  message?: string;
  // Error details
  error?: {
    code: string;
    message: string;
  };
}

export interface A2UIEvent {
  type: 'dataModel.update' | 'payload.update' | 'action.complete' | 'error';
  sessionId: string;
  data?: unknown;
  timestamp: string;
}

export interface CapsuleManifest {
  id: string;
  version: string;
  name: string;
  description?: string;
  author?: string;
  entry: {
    type: 'a2ui' | 'html' | 'component';
    src: string;
  };
  capabilities?: string[];
}

// ============================================================================
// A2UI API Client
// ============================================================================

class A2UIApiClient {
  // ========================================================================
  // Session Management
  // ========================================================================

  /**
   * Create a new A2UI session
   * Called when agent generates A2UI payload
   */
  async createSession(
    chatId: string,
    payload: A2UIPayload,
    options?: {
      messageId?: string;
      agentId?: string;
      source?: string;
    }
  ): Promise<A2UISession> {
    return api.post<A2UISession>('/api/v1/a2ui/sessions', {
      chat_id: chatId,
      payload,
      message_id: options?.messageId,
      agent_id: options?.agentId,
      source: options?.source,
    });
  }

  /**
   * Get A2UI session by ID
   */
  async getSession(sessionId: string): Promise<A2UISession> {
    return api.get<A2UISession>(`/api/v1/a2ui/sessions/${sessionId}`);
  }

  /**
   * List A2UI sessions for a chat
   */
  async listSessions(chatId: string): Promise<{ sessions: A2UISession[] }> {
    return api.get(`/api/v1/a2ui/sessions?chat_id=${chatId}`);
  }

  /**
   * Update session data model
   */
  async updateDataModel(
    sessionId: string,
    dataModel: Record<string, unknown>
  ): Promise<A2UISession> {
    return api.patch<A2UISession>(`/api/v1/a2ui/sessions/${sessionId}/data`, {
      data_model: dataModel,
    });
  }

  /**
   * Delete A2UI session
   */
  async deleteSession(sessionId: string): Promise<void> {
    return api.delete(`/api/v1/a2ui/sessions/${sessionId}`);
  }

  // ========================================================================
  // Action Handling
  // ========================================================================

  /**
   * Execute an A2UI action
   * This sends the action to the agent/backend for processing
   */
  async executeAction(request: A2UIActionRequest): Promise<A2UIActionResponse> {
    return api.post<A2UIActionResponse>('/api/v1/a2ui/actions', {
      session_id: request.sessionId,
      action_id: request.actionId,
      payload: request.payload,
      data_model: request.dataModel,
      context: request.context,
    });
  }

  /**
   * Execute action with streaming response
   * For long-running actions that return progressive updates
   */
  async executeActionStream(
    request: A2UIActionRequest,
    onEvent: (event: A2UIEvent) => void,
    onError?: (error: Error) => void
  ): Promise<() => void> {
    const eventSource = new EventSource(
      `${api['baseUrl']}/api/v1/a2ui/actions/stream?` +
        new URLSearchParams({
          session_id: request.sessionId,
          action_id: request.actionId,
        })
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as A2UIEvent;
        onEvent(data);
      } catch (err) {
        console.error('[A2UI] Failed to parse event:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[A2UI] EventSource error:', error);
      onError?.(new Error('EventSource connection failed'));
    };

    // Return cleanup function
    return () => {
      eventSource.close();
    };
  }

  // ========================================================================
  // Capsule Registry
  // ========================================================================

  /**
   * List available capsules/miniapps
   */
  async listCapsules(): Promise<{ capsules: CapsuleManifest[] }> {
    return api.get('/api/v1/a2ui/capsules');
  }

  /**
   * Get capsule manifest
   */
  async getCapsule(capsuleId: string): Promise<CapsuleManifest> {
    return api.get<CapsuleManifest>(`/api/v1/a2ui/capsules/${capsuleId}`);
  }

  /**
   * Install/Register a capsule
   */
  async installCapsule(manifest: CapsuleManifest): Promise<CapsuleManifest> {
    return api.post<CapsuleManifest>('/api/v1/a2ui/capsules', manifest);
  }

  /**
   * Launch a capsule (creates A2UI session from capsule)
   */
  async launchCapsule(
    capsuleId: string,
    context?: Record<string, unknown>
  ): Promise<A2UISession> {
    return api.post<A2UISession>(`/api/v1/a2ui/capsules/${capsuleId}/launch`, {
      context,
    });
  }

  // ========================================================================
  // Agent A2UI Generation
  // ========================================================================

  /**
   * Request agent to generate A2UI payload
   * Called when agent decides to render UI instead of text
   */
  async requestA2UIGeneration(
    chatId: string,
    prompt: string,
    context?: {
      currentPayload?: A2UIPayload;
      dataModel?: Record<string, unknown>;
    }
  ): Promise<{ payload: A2UIPayload; sessionId: string }> {
    return api.post('/api/v1/a2ui/generate', {
      chat_id: chatId,
      prompt,
      context,
    });
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const a2uiApi = new A2UIApiClient();

// ============================================================================
// React Hooks
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

export function useA2UIApi() {
  return a2uiApi;
}

export function useA2UISession(sessionId: string | null) {
  const [session, setSession] = useState<A2UISession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<A2RApiError | null>(null);

  const fetchSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await a2uiApi.getSession(sessionId);
      setSession(data);
    } catch (err) {
      setError(err instanceof A2RApiError ? err : new A2RApiError('Unknown error', 500));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  return { session, loading, error, refresh: fetchSession };
}

export function useA2UIAction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<A2RApiError | null>(null);

  const executeAction = useCallback(async (request: A2UIActionRequest) => {
    try {
      setLoading(true);
      setError(null);
      const result = await a2uiApi.executeAction(request);
      return result;
    } catch (err) {
      const apiError = err instanceof A2RApiError ? err : new A2RApiError('Action failed', 500);
      setError(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
  }, []);

  return { executeAction, loading, error };
}
