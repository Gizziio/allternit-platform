/**
 * Session API Client — thin-client
 *
 * Wraps @a2r/sdk session methods so the rest of the UI has a stable interface.
 */

import { sdk } from './sdk';

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

export interface Message {
  id: string;
  role: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

class SessionApiError extends Error {
  constructor(message: string, public statusCode: number, public response?: unknown) {
    super(message);
    this.name = 'SessionApiError';
  }
}

function throwIfError(error: unknown, statusCode = 500): never {
  const msg = (error as any)?.message ?? String(error);
  throw new SessionApiError(msg, statusCode, error);
}

export const sessionApi = {
  /**
   * Create a new session and return its ID + name.
   */
  async createSession(name?: string): Promise<{ id: string; name?: string }> {
    const { data, error } = await sdk.session.create({
      body: { title: name ?? 'Thin Client Chat' } as any,
    });
    if (error || !data) throwIfError(error);
    return { id: (data as any).id ?? (data as any).sessionID, name };
  },

  /**
   * Send a prompt to a session.
   */
  async sendMessage(sessionId: string, text: string): Promise<Message> {
    const { data, error } = await sdk.session.prompt({
      path: { sessionID: sessionId },
      body: { parts: [{ type: 'text', text }] } as any,
    });
    if (error || !data) throwIfError(error);
    // Return a normalised Message shape from the response
    const d = data as any;
    return {
      id: d.id ?? d.messageID ?? sessionId + '-' + Date.now(),
      role: 'assistant',
      content: d.parts?.find((p: any) => p.type === 'text')?.text ?? '',
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Get all messages for a session.
   */
  async getMessages(sessionId: string): Promise<{ messages: Message[] }> {
    const { data, error } = await sdk.session.messages({
      path: { sessionID: sessionId },
    });
    if (error || !data) throwIfError(error);
    const raw: any[] = Array.isArray(data) ? data : (data as any).messages ?? [];
    const messages: Message[] = raw.map((m: any) => ({
      id: m.id ?? m.messageID ?? String(Math.random()),
      role: m.role ?? 'assistant',
      content:
        typeof m.content === 'string'
          ? m.content
          : m.parts?.find((p: any) => p.type === 'text')?.text ?? '',
      timestamp: m.created_at ?? m.createdAt ?? new Date().toISOString(),
      metadata: m.metadata,
    }));
    return { messages };
  },

  /**
   * Subscribe to global events (SSE).
   * Returns an unsubscribe function.
   */
  subscribeToEvents(
    onEvent: (payload: unknown) => void,
    signal?: AbortSignal,
  ): () => void {
    const abort = new AbortController();
    if (signal) {
      signal.addEventListener('abort', () => abort.abort());
    }

    (async () => {
      try {
        for await (const event of sdk.globalEvents({ signal: abort.signal })) {
          if (abort.signal.aborted) break;
          onEvent(event);
        }
      } catch {
        // stream ended or aborted — expected
      }
    })();

    return () => abort.abort();
  },
};

export default sessionApi;
