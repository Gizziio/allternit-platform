/**
 * OpenClaw Session API Client
 * 
 * Provides a typed interface to the native Rust session manager API.
 * Replaces direct WebSocket connections with REST API calls.
 */

const API_BASE = '/api/v1';

// Types
export interface Session {
  id: string;
  name?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  last_accessed: string;
  message_count: number;
  active: boolean;
  tags: string[];
}

export interface CreateSessionRequest {
  name?: string;
  description?: string;
}

export interface CreateSessionResponse {
  id: string;
  name?: string;
  description?: string;
  created_at: string;
  message_count: number;
  active: boolean;
}

export interface Message {
  id: string;
  role: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface SendMessageRequest {
  text: string;
  role?: string;
  metadata?: Record<string, unknown>;
}

export interface MessagesListResponse {
  messages: Message[];
  count: number;
}

export interface SessionListResponse {
  sessions: SessionSummary[];
  count: number;
}

export interface SessionSummary {
  id: string;
  name?: string;
  description?: string;
  message_count: number;
  created_at: string;
  updated_at: string;
  active: boolean;
}

export interface AbortRequest {
  run_id?: string;
  reason?: string;
}

export interface AbortResponse {
  success: boolean;
  message: string;
}

export interface StreamEvent {
  type: 'message' | 'aborted' | 'error' | 'connected';
  session_id?: string;
  message?: Message;
  error?: string;
}

// Error handling
class SessionApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'SessionApiError';
  }
}

// Helper to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new SessionApiError(
      errorData.error || `HTTP ${response.status}`,
      response.status,
      errorData
    );
  }
  return response.json();
}

// Session API Client
export const sessionApi = {
  /**
   * Create a new session
   */
  async createSession(request: CreateSessionRequest): Promise<CreateSessionResponse> {
    const response = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    return handleResponse<CreateSessionResponse>(response);
  },

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<Session> {
    const response = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}`);
    return handleResponse<Session>(response);
  },

  /**
   * List all sessions
   */
  async listSessions(): Promise<SessionListResponse> {
    const response = await fetch(`${API_BASE}/sessions`);
    return handleResponse<SessionListResponse>(response);
  },

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      await handleResponse(response);
    }
  },

  /**
   * Send a message to a session
   */
  async sendMessage(sessionId: string, request: SendMessageRequest): Promise<Message> {
    const response = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    return handleResponse<Message>(response);
  },

  /**
   * Get messages from a session
   */
  async getMessages(sessionId: string, fromIndex?: number): Promise<MessagesListResponse> {
    const params = fromIndex !== undefined ? `?from_index=${fromIndex}` : '';
    const response = await fetch(
      `${API_BASE}/sessions/${encodeURIComponent(sessionId)}/messages${params}`
    );
    return handleResponse<MessagesListResponse>(response);
  },

  /**
   * Abort session execution
   */
  async abortSession(sessionId: string, request: AbortRequest = {}): Promise<AbortResponse> {
    const response = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/abort`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    return handleResponse<AbortResponse>(response);
  },

  /**
   * Patch/update session fields
   */
  async patchSession(
    sessionId: string,
    patch: Partial<Omit<Session, 'id' | 'created_at'>>
  ): Promise<Session> {
    const response = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/patch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patch),
    });
    return handleResponse<Session>(response);
  },

  /**
   * Stream messages from a session (Server-Sent Events)
   * Returns an EventSource that can be listened to for real-time updates
   */
  streamMessages(sessionId: string): EventSource {
    const url = `${API_BASE}/sessions/${encodeURIComponent(sessionId)}/messages/stream`;
    return new EventSource(url);
  },
};

// React hook for session streaming
export function createMessageStream(
  sessionId: string,
  onEvent: (event: StreamEvent) => void
): { close: () => void; abort: () => Promise<void> } {
  const eventSource = sessionApi.streamMessages(sessionId);

  eventSource.onopen = () => {
    onEvent({ type: 'connected', session_id: sessionId });
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onEvent(data as StreamEvent);
    } catch (error) {
      onEvent({
        type: 'error',
        error: `Failed to parse event: ${error}`,
        session_id: sessionId,
      });
    }
  };

  eventSource.onerror = (error) => {
    onEvent({
      type: 'error',
      error: 'EventSource error',
      session_id: sessionId,
    });
  };

  return {
    close: () => {
      eventSource.close();
    },
    abort: async () => {
      eventSource.close();
      await sessionApi.abortSession(sessionId);
    },
  };
}

// Utility to convert API messages to chat view format
export function apiMessageToChatView(message: Message): {
  id: string;
  role: string;
  text: string;
  timestamp: number;
} {
  return {
    id: message.id,
    role: message.role,
    text: message.content,
    timestamp: new Date(message.timestamp).getTime(),
  };
}

export default sessionApi;
