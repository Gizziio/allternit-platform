/**
 * Allternit AI Session API Client
 * Drop-in replacement for native-agent-api that talks to the forked
 * Allternit AI backend (Open WebUI-derived FastAPI service).
 */

const ALLTERNIT_AI_URL = process.env.NEXT_PUBLIC_ALLTERNIT_AI_URL || 'http://localhost:8080';
const ALLTERNIT_AI_KEY = process.env.NEXT_PUBLIC_ALLTERNIT_AI_KEY || '';

// ============================================================================
// Types
// ============================================================================

export interface AllternitAiSession {
  id: string;
  name?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  active?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface AllternitAiMessage {
  id: string;
  role: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface CreateAllternitAiSessionRequest {
  name?: string;
  description?: string;
  origin_surface?: string;
  session_mode?: 'regular' | 'agent';
  agentId?: string;
  agentName?: string;
  project_id?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// HTTP helper
// ============================================================================

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (ALLTERNIT_AI_KEY) {
    headers['Authorization'] = `Bearer ${ALLTERNIT_AI_KEY}`;
  }

  const res = await fetch(`${ALLTERNIT_AI_URL}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> || {}) },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Allternit AI API error: ${res.status} ${res.statusText} — ${text}`);
  }

  return (await res.json()) as T;
}

// ============================================================================
// Message adapters: OWUI <-> Allternit
// ============================================================================

interface OwuiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  parentId?: string | null;
  timestamp: number;
  model?: string;
  metadata?: Record<string, unknown>;
}

interface OwuiChat {
  id: string;
  title: string;
  chat: {
    history: {
      messages: Record<string, OwuiMessage>;
      currentId: string;
    };
  };
  created_at: number;
  updated_at: number;
  archived?: boolean;
  pinned?: boolean;
  meta?: Record<string, unknown>;
}

function owuiToAllternitMessage(msg: OwuiMessage): AllternitAiMessage {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: new Date(msg.timestamp * 1000).toISOString(),
    metadata: {
      model: msg.model,
      ...msg.metadata,
    },
  };
}

function allternitToOwuiMessage(msg: AllternitAiMessage): OwuiMessage {
  return {
    id: msg.id,
    role: msg.role as 'user' | 'assistant' | 'system',
    content: msg.content,
    timestamp: Math.floor(new Date(msg.timestamp).getTime() / 1000),
    metadata: msg.metadata,
  };
}

function flattenOwuiMessages(messagesDict: Record<string, OwuiMessage>): AllternitAiMessage[] {
  return Object.values(messagesDict)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(owuiToAllternitMessage);
}

function buildOwuiChatHistory(messages: AllternitAiMessage[]) {
  const messagesDict: Record<string, OwuiMessage> = {};
  let prevId: string | null = null;

  for (const msg of messages) {
    const owuiMsg = allternitToOwuiMessage(msg);
    if (prevId) {
      owuiMsg.parentId = prevId;
    }
    messagesDict[owuiMsg.id] = owuiMsg;
    prevId = owuiMsg.id;
  }

  return {
    messages: messagesDict,
    currentId: prevId || '',
  };
}

// ============================================================================
// Session API
// ============================================================================

export const allternitAiSessionApi = {
  async listSessions(): Promise<AllternitAiSession[]> {
    const chats = await request<OwuiChat[]>('/api/chats/');
    return chats.map((c) => ({
      id: c.id,
      name: c.title,
      created_at: new Date(c.created_at * 1000).toISOString(),
      updated_at: new Date(c.updated_at * 1000).toISOString(),
      message_count: Object.keys(c.chat?.history?.messages || {}).length,
      active: !c.archived,
      tags: [],
      metadata: c.meta,
    }));
  },

  async getSession(sessionId: string): Promise<AllternitAiSession> {
    const chat = await request<OwuiChat>(`/api/chats/${sessionId}`);
    return {
      id: chat.id,
      name: chat.title,
      created_at: new Date(chat.created_at * 1000).toISOString(),
      updated_at: new Date(chat.updated_at * 1000).toISOString(),
      message_count: Object.keys(chat.chat?.history?.messages || {}).length,
      active: !chat.archived,
      tags: [],
      metadata: chat.meta,
    };
  },

  async createSession(options: CreateAllternitAiSessionRequest): Promise<AllternitAiSession> {
    const chat = await request<OwuiChat>('/api/chats/new', {
      method: 'POST',
      body: JSON.stringify({
        title: options.name || 'New Session',
        chat: {
          history: { messages: {}, currentId: '' },
        },
        meta: {
          originSurface: options.origin_surface,
          sessionMode: options.session_mode,
          agentId: options.agentId,
          agentName: options.agentName,
          projectId: options.project_id,
          ...options.metadata,
        },
      }),
    });
    return {
      id: chat.id,
      name: chat.title,
      created_at: new Date(chat.created_at * 1000).toISOString(),
      updated_at: new Date(chat.updated_at * 1000).toISOString(),
      message_count: 0,
      active: true,
      tags: [],
      metadata: chat.meta,
    };
  },

  async updateSession(sessionId: string, updates: Partial<AllternitAiSession>): Promise<AllternitAiSession> {
    const chat = await request<OwuiChat>(`/api/chats/${sessionId}`, {
      method: 'POST',
      body: JSON.stringify({
        title: updates.name,
        meta: updates.metadata,
      }),
    });
    return {
      id: chat.id,
      name: chat.title,
      created_at: new Date(chat.created_at * 1000).toISOString(),
      updated_at: new Date(chat.updated_at * 1000).toISOString(),
      message_count: Object.keys(chat.chat?.history?.messages || {}).length,
      active: !chat.archived,
      tags: updates.tags || [],
      metadata: chat.meta,
    };
  },

  async deleteSession(sessionId: string): Promise<void> {
    await request<void>(`/api/chats/${sessionId}`, { method: 'DELETE' });
  },

  async listMessages(sessionId: string): Promise<AllternitAiMessage[]> {
    const chat = await request<OwuiChat>(`/api/chats/${sessionId}`);
    return flattenOwuiMessages(chat.chat?.history?.messages || {});
  },
};

// ============================================================================
// Chat streaming
// ============================================================================

export interface ChatStreamCallbacks {
  onChunk?: (chunk: { chunk: string }) => void;
  onThinkingChunk?: (thinking: string) => void;
  onToolCall?: (toolCall: unknown) => void;
  onToolResult?: (toolResult: unknown) => void;
  onToolError?: (toolError: unknown) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

export const allternitAiChatApi = {
  async streamChat(
    sessionId: string,
    message: string,
    modelId: string | undefined,
    callbacks: ChatStreamCallbacks,
    signal?: AbortSignal,
    _agentContext?: Record<string, unknown>,
  ): Promise<void> {
    // Fetch current chat to build full history
    const chat = await request<OwuiChat>(`/api/chats/${sessionId}`);
    const history = flattenOwuiMessages(chat.chat?.history?.messages || {});

    const messages = history.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Append new user message
    messages.push({ role: 'user', content: message });

    const body = {
      model: modelId || 'gpt-4o',
      messages,
      stream: true,
      metadata: {
        chat_id: sessionId,
        session_id: sessionId,
      },
    };

    try {
      const res = await fetch(`${ALLTERNIT_AI_URL}/api/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(ALLTERNIT_AI_KEY ? { Authorization: `Bearer ${ALLTERNIT_AI_KEY}` } : {}),
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Chat stream error: ${res.status} ${text}`);
      }

      if (!res.body) {
        throw new Error('No response body');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              assistantContent += delta.content;
              callbacks.onChunk?.({ chunk: delta.content });
            }
            if (delta?.reasoning_content) {
              callbacks.onThinkingChunk?.(delta.reasoning_content);
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      callbacks.onDone?.();
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      callbacks.onError?.(error as Error);
    }
  },

  async abortGeneration(_sessionId: string): Promise<void> {
    // Abort is handled by the AbortController passed to streamChat
  },
};
