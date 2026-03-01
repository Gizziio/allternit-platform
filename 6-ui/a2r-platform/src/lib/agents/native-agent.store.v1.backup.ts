/**
 * N20 Native OpenClaw Agent Store
 * 
 * Zustand store for native agent sessions with:
 * - Session management (CRUD)
 * - SSE streaming for chat
 * - Tool execution
 * - Canvas state management
 * - Streaming status tracking
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { API_BASE_URL } from './api-config';

// ============================================================================
// Types
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface NativeMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
  error?: string;
}

export interface NativeSession {
  id: string;
  name?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
  messageCount: number;
  isActive: boolean;
  tags: string[];
  metadata?: Record<string, unknown>;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  isEnabled: boolean;
  category?: string;
}

export interface Canvas {
  id: string;
  sessionId: string;
  content: string;
  type: 'code' | 'markdown' | 'json' | 'text';
  language?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export type StreamEventType = 
  | 'message_start'
  | 'message_delta'
  | 'message_complete'
  | 'tool_call'
  | 'tool_result'
  | 'tool_error'
  | 'canvas_update'
  | 'error'
  | 'done';

export interface StreamEvent {
  type: StreamEventType;
  sessionId?: string;
  messageId?: string;
  delta?: {
    content?: string;
    reasoning?: string;
  };
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  canvas?: Canvas;
  error?: string;
  timestamp: string;
}

export interface StreamingState {
  isStreaming: boolean;
  currentMessageId: string | null;
  abortController: AbortController | null;
  error: string | null;
  streamBuffer: string;
}

// ============================================================================
// API Client
// ============================================================================

const AGENT_API_BASE = `${API_BASE_URL}/agent`;

class NativeAgentApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'NativeAgentApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new NativeAgentApiError(
      errorData.error || `HTTP ${response.status}`,
      response.status,
      errorData
    );
  }
  return response.json();
}

// ============================================================================
// Store State & Actions
// ============================================================================

interface NativeAgentState {
  // Data
  sessions: NativeSession[];
  activeSessionId: string | null;
  messages: Record<string, NativeMessage[]>; // keyed by sessionId
  tools: Tool[];
  canvases: Record<string, Canvas>; // keyed by canvasId
  sessionCanvases: Record<string, string[]>; // sessionId -> canvasIds
  
  // Streaming state
  streaming: StreamingState;
  
  // UI State
  isLoadingSessions: boolean;
  isLoadingMessages: boolean;
  isLoadingTools: boolean;
  isExecutingTool: boolean;
  error: string | null;
  
  // EventSource for SSE
  eventSource: EventSource | null;
}

interface NativeAgentActions {
  // Session CRUD
  fetchSessions: () => Promise<void>;
  createSession: (name?: string, description?: string) => Promise<NativeSession>;
  updateSession: (sessionId: string, updates: Partial<Omit<NativeSession, 'id' | 'createdAt'>>) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  setActiveSession: (sessionId: string | null) => void;
  
  // Messages
  fetchMessages: (sessionId: string) => Promise<void>;
  sendMessage: (sessionId: string, content: string, role?: MessageRole) => Promise<void>;
  
  // Streaming chat
  sendMessageStream: (
    sessionId: string,
    content: string,
    onEvent?: (event: StreamEvent) => void
  ) => Promise<void>;
  abortGeneration: (sessionId?: string) => Promise<void>;
  
  // Tools
  fetchTools: () => Promise<void>;
  executeTool: (
    sessionId: string,
    toolName: string,
    parameters: Record<string, unknown>
  ) => Promise<ToolResult>;
  
  // Canvas
  createCanvas: (
    sessionId: string,
    content: string,
    type: Canvas['type'],
    language?: string
  ) => Promise<Canvas>;
  updateCanvas: (canvasId: string, updates: Partial<Omit<Canvas, 'id' | 'createdAt'>>) => Promise<void>;
  deleteCanvas: (canvasId: string) => Promise<void>;
  fetchSessionCanvases: (sessionId: string) => Promise<void>;
  
  // Event handling
  connectStream: (sessionId: string, onEvent?: (event: StreamEvent) => void) => () => void;
  disconnectStream: () => void;
  
  // UI actions
  clearError: () => void;
  clearMessages: (sessionId: string) => void;
  resetStreaming: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useNativeAgentStore = create<NativeAgentState & NativeAgentActions>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        sessions: [],
        activeSessionId: null,
        messages: {},
        tools: [],
        canvases: {},
        sessionCanvases: {},
        streaming: {
          isStreaming: false,
          currentMessageId: null,
          abortController: null,
          error: null,
          streamBuffer: '',
        },
        isLoadingSessions: false,
        isLoadingMessages: false,
        isLoadingTools: false,
        isExecutingTool: false,
        error: null,
        eventSource: null,

        // ----------------------------------------------------------------------
        // Session CRUD
        // ----------------------------------------------------------------------

        fetchSessions: async () => {
          set({ isLoadingSessions: true, error: null });
          try {
            const response = await fetch(`${AGENT_API_BASE}/sessions`);
            const data = await handleResponse<{ sessions: NativeSession[] }>(response);
            set({ sessions: data.sessions, isLoadingSessions: false });
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to fetch sessions';
            set({ 
              error: errorMsg,
              isLoadingSessions: false,
              sessions: []
            });
          }
        },

        createSession: async (name, description) => {
          set({ error: null });
          try {
            const response = await fetch(`${AGENT_API_BASE}/sessions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, description }),
            });
            const session = await handleResponse<NativeSession>(response);
            set(state => ({
              sessions: [session, ...state.sessions],
              activeSessionId: session.id,
            }));
            return session;
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to create session';
            set({ error: errorMsg });
            throw err;
          }
        },

        updateSession: async (sessionId, updates) => {
          set({ error: null });
          try {
            const response = await fetch(`${AGENT_API_BASE}/sessions/${encodeURIComponent(sessionId)}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updates),
            });
            const updated = await handleResponse<NativeSession>(response);
            set(state => ({
              sessions: state.sessions.map(s => s.id === sessionId ? updated : s),
            }));
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to update session';
            set({ error: errorMsg });
            throw err;
          }
        },

        deleteSession: async (sessionId) => {
          set({ error: null });
          try {
            await fetch(`${AGENT_API_BASE}/sessions/${encodeURIComponent(sessionId)}`, {
              method: 'DELETE',
            });
            set(state => {
              const newMessages = { ...state.messages };
              delete newMessages[sessionId];
              const newSessionCanvases = { ...state.sessionCanvases };
              delete newSessionCanvases[sessionId];
              
              return {
                sessions: state.sessions.filter(s => s.id !== sessionId),
                messages: newMessages,
                sessionCanvases: newSessionCanvases,
                activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
              };
            });
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to delete session';
            set({ error: errorMsg });
            throw err;
          }
        },

        setActiveSession: (sessionId) => {
          set({ activeSessionId: sessionId });
          if (sessionId) {
            get().fetchMessages(sessionId);
            get().fetchSessionCanvases(sessionId);
          }
        },

        // ----------------------------------------------------------------------
        // Messages
        // ----------------------------------------------------------------------

        fetchMessages: async (sessionId) => {
          set({ isLoadingMessages: true, error: null });
          try {
            const response = await fetch(
              `${AGENT_API_BASE}/sessions/${encodeURIComponent(sessionId)}/messages`
            );
            const data = await handleResponse<{ messages: NativeMessage[] }>(response);
            set(state => ({
              messages: { ...state.messages, [sessionId]: data.messages },
              isLoadingMessages: false,
            }));
          } catch (err) {
            set({ isLoadingMessages: false });
          }
        },

        sendMessage: async (sessionId, content, role = 'user') => {
          set({ error: null });
          try {
            // Optimistically add message to UI
            const optimisticMessage: NativeMessage = {
              id: `temp-${Date.now()}`,
              role,
              content,
              timestamp: new Date().toISOString(),
            };
            
            set(state => ({
              messages: {
                ...state.messages,
                [sessionId]: [...(state.messages[sessionId] || []), optimisticMessage],
              },
            }));

            const response = await fetch(
              `${AGENT_API_BASE}/sessions/${encodeURIComponent(sessionId)}/messages`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, role }),
              }
            );
            const message = await handleResponse<NativeMessage>(response);
            
            // Replace optimistic message with actual
            set(state => ({
              messages: {
                ...state.messages,
                [sessionId]: state.messages[sessionId].map(m =>
                  m.id === optimisticMessage.id ? message : m
                ),
              },
            }));
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to send message';
            set({ error: errorMsg });
            throw err;
          }
        },

        // ----------------------------------------------------------------------
        // Streaming Chat
        // ----------------------------------------------------------------------

        sendMessageStream: async (sessionId, content, onEvent) => {
          const { isStreaming } = get().streaming;
          if (isStreaming) {
            throw new Error('Already streaming');
          }

          set({
            error: null,
            streaming: {
              isStreaming: true,
              currentMessageId: null,
              abortController: new AbortController(),
              error: null,
              streamBuffer: '',
            },
          });

          // Add user message
          const userMessage: NativeMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content,
            timestamp: new Date().toISOString(),
          };
          
          set(state => ({
            messages: {
              ...state.messages,
              [sessionId]: [...(state.messages[sessionId] || []), userMessage],
            },
          }));

          try {
            const abortController = get().streaming.abortController;
            if (!abortController) throw new Error('No abort controller');

            const response = await fetch(
              `${AGENT_API_BASE}/sessions/${encodeURIComponent(sessionId)}/chat/stream`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
                signal: abortController.signal,
              }
            );

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
              throw new Error('No response body available');
            }

            const decoder = new TextDecoder();
            let buffer = '';
            let assistantMessageId: string | null = null;
            const assistantParts: string[] = [];

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() ?? '';

              for (const line of lines) {
                if (!line.trim() || !line.startsWith('data: ')) continue;

                const data = line.slice(6);
                if (data === '[DONE]') {
                  set(state => ({
                    streaming: { ...state.streaming, isStreaming: false },
                  }));
                  continue;
                }

                try {
                  const event: StreamEvent = JSON.parse(data);
                  
                  // Update streaming state based on event
                  if (event.messageId && !assistantMessageId) {
                    assistantMessageId = event.messageId;
                    set(state => ({
                      streaming: { ...state.streaming, currentMessageId: event.messageId ?? null },
                    }));
                  }

                  // Handle different event types
                  switch (event.type) {
                    case 'message_start': {
                      const newMessage: NativeMessage = {
                        id: event.messageId || `assistant-${Date.now()}`,
                        role: 'assistant',
                        content: '',
                        timestamp: event.timestamp,
                      };
                      assistantMessageId = newMessage.id;
                      set(state => ({
                        messages: {
                          ...state.messages,
                          [sessionId]: [...(state.messages[sessionId] || []), newMessage],
                        },
                        streaming: { ...state.streaming, currentMessageId: newMessage.id },
                      }));
                      break;
                    }

                    case 'message_delta': {
                      if (event.delta?.content && assistantMessageId) {
                        assistantParts.push(event.delta.content);
                        const fullContent = assistantParts.join('');
                        set(state => ({
                          messages: {
                            ...state.messages,
                            [sessionId]: state.messages[sessionId].map(m =>
                              m.id === assistantMessageId
                                ? { ...m, content: fullContent }
                                : m
                            ),
                          },
                          streaming: {
                            ...state.streaming,
                            streamBuffer: fullContent,
                          },
                        }));
                      }
                      break;
                    }

                    case 'tool_call': {
                      if (event.toolCall && assistantMessageId) {
                        set(state => ({
                          messages: {
                            ...state.messages,
                            [sessionId]: state.messages[sessionId].map(m =>
                              m.id === assistantMessageId
                                ? { ...m, toolCalls: [...(m.toolCalls || []), event.toolCall!] }
                                : m
                            ),
                          },
                        }));
                      }
                      break;
                    }

                    case 'tool_result': {
                      if (event.toolResult) {
                        const toolResultMsg: NativeMessage = {
                          id: `tool-result-${Date.now()}`,
                          role: 'tool',
                          content: JSON.stringify(event.toolResult.result),
                          timestamp: event.timestamp,
                          toolCallId: event.toolResult.toolCallId,
                        };
                        set(state => ({
                          messages: {
                            ...state.messages,
                            [sessionId]: [...(state.messages[sessionId] || []), toolResultMsg],
                          },
                        }));
                      }
                      break;
                    }

                    case 'error': {
                      set(state => ({
                        error: event.error || 'Stream error',
                        streaming: {
                          ...state.streaming,
                          error: event.error || 'Stream error',
                          isStreaming: false,
                        },
                      }));
                      break;
                    }

                    case 'done': {
                      set(state => ({
                        streaming: {
                          ...state.streaming,
                          isStreaming: false,
                          currentMessageId: null,
                        },
                      }));
                      break;
                    }
                  }

                  // Call external handler if provided
                  onEvent?.(event);
                } catch (parseError) {
                  console.error('Failed to parse SSE event:', data, parseError);
                }
              }
            }
          } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
              // User aborted - not an error
              set(state => ({
                streaming: {
                  ...state.streaming,
                  isStreaming: false,
                },
              }));
            } else {
              const errorMsg = err instanceof Error ? err.message : 'Stream failed';
              set(state => ({
                error: errorMsg,
                streaming: {
                  ...state.streaming,
                  error: errorMsg,
                  isStreaming: false,
                },
              }));
            }
          }
        },

        abortGeneration: async (sessionId) => {
          const { streaming } = get();
          const targetSessionId = sessionId || get().activeSessionId;
          
          // Abort local stream
          if (streaming.abortController) {
            streaming.abortController.abort();
          }

          set(state => ({
            streaming: {
              ...state.streaming,
              isStreaming: false,
              abortController: null,
            },
          }));

          // Notify server
          if (targetSessionId) {
            try {
              await fetch(
                `${AGENT_API_BASE}/sessions/${encodeURIComponent(targetSessionId)}/abort`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                }
              );
            } catch (err) {
              console.warn('Failed to abort on server:', err);
            }
          }
        },

        resetStreaming: () => {
          const { streaming } = get();
          if (streaming.abortController) {
            streaming.abortController.abort();
          }
          set({
            streaming: {
              isStreaming: false,
              currentMessageId: null,
              abortController: null,
              error: null,
              streamBuffer: '',
            },
          });
        },

        // ----------------------------------------------------------------------
        // Tools
        // ----------------------------------------------------------------------

        fetchTools: async () => {
          set({ isLoadingTools: true, error: null });
          try {
            const response = await fetch(`${AGENT_API_BASE}/tools`);
            const data = await handleResponse<{ tools: Tool[] }>(response);
            set({ tools: data.tools, isLoadingTools: false });
          } catch (err) {
            set({ isLoadingTools: false });
          }
        },

        executeTool: async (sessionId, toolName, parameters) => {
          set({ isExecutingTool: true, error: null });
          try {
            const response = await fetch(
              `${AGENT_API_BASE}/sessions/${encodeURIComponent(sessionId)}/tools/execute`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tool: toolName, parameters }),
              }
            );
            const result = await handleResponse<ToolResult>(response);
            set({ isExecutingTool: false });
            return result;
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Tool execution failed';
            set({ error: errorMsg, isExecutingTool: false });
            throw err;
          }
        },

        // ----------------------------------------------------------------------
        // Canvas
        // ----------------------------------------------------------------------

        createCanvas: async (sessionId, content, type, language) => {
          set({ error: null });
          try {
            const response = await fetch(`${AGENT_API_BASE}/canvas`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId, content, type, language }),
            });
            const canvas = await handleResponse<Canvas>(response);
            set(state => ({
              canvases: { ...state.canvases, [canvas.id]: canvas },
              sessionCanvases: {
                ...state.sessionCanvases,
                [sessionId]: [...(state.sessionCanvases[sessionId] || []), canvas.id],
              },
            }));
            return canvas;
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to create canvas';
            set({ error: errorMsg });
            throw err;
          }
        },

        updateCanvas: async (canvasId, updates) => {
          set({ error: null });
          try {
            const response = await fetch(
              `${AGENT_API_BASE}/canvas/${encodeURIComponent(canvasId)}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
              }
            );
            const updated = await handleResponse<Canvas>(response);
            set(state => ({
              canvases: { ...state.canvases, [canvasId]: updated },
            }));
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to update canvas';
            set({ error: errorMsg });
            throw err;
          }
        },

        deleteCanvas: async (canvasId) => {
          set({ error: null });
          try {
            await fetch(`${AGENT_API_BASE}/canvas/${encodeURIComponent(canvasId)}`, {
              method: 'DELETE',
            });
            set(state => {
              const newCanvases = { ...state.canvases };
              const canvas = newCanvases[canvasId];
              delete newCanvases[canvasId];
              
              // Remove from session canvases
              const newSessionCanvases = { ...state.sessionCanvases };
              if (canvas?.sessionId) {
                newSessionCanvases[canvas.sessionId] = 
                  (newSessionCanvases[canvas.sessionId] || []).filter(id => id !== canvasId);
              }
              
              return { canvases: newCanvases, sessionCanvases: newSessionCanvases };
            });
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to delete canvas';
            set({ error: errorMsg });
            throw err;
          }
        },

        fetchSessionCanvases: async (sessionId) => {
          try {
            const response = await fetch(
              `${AGENT_API_BASE}/canvas?sessionId=${encodeURIComponent(sessionId)}`
            );
            const data = await handleResponse<{ canvases: Canvas[] }>(response);
            const canvasIds = data.canvases.map(c => c.id);
            const canvasesMap = data.canvases.reduce((acc, canvas) => {
              acc[canvas.id] = canvas;
              return acc;
            }, {} as Record<string, Canvas>);
            
            set(state => ({
              canvases: { ...state.canvases, ...canvasesMap },
              sessionCanvases: { ...state.sessionCanvases, [sessionId]: canvasIds },
            }));
          } catch (err) {
            console.warn('Failed to fetch canvases:', err);
          }
        },

        // ----------------------------------------------------------------------
        // Event Handling (SSE via EventSource)
        // ----------------------------------------------------------------------

        connectStream: (sessionId, onEvent) => {
          // Disconnect existing stream
          get().disconnectStream();

          const url = `${AGENT_API_BASE}/sessions/${encodeURIComponent(sessionId)}/chat/stream`;
          const eventSource = new EventSource(url);

          eventSource.onopen = () => {
            console.log(`[NativeAgentStore] SSE connected for session ${sessionId}`);
          };

          eventSource.onmessage = (event) => {
            try {
              const data: StreamEvent = JSON.parse(event.data);
              
              // Update messages based on stream event
              switch (data.type) {
                case 'message_delta':
                  if (data.delta?.content) {
                    set(state => {
                      const messages = state.messages[sessionId] || [];
                      const lastMessage = messages[messages.length - 1];
                      if (lastMessage?.role === 'assistant') {
                        return {
                          messages: {
                            ...state.messages,
                            [sessionId]: messages.map((m, i) =>
                              i === messages.length - 1
                                ? { ...m, content: m.content + data.delta!.content! }
                                : m
                            ),
                          },
                        };
                      }
                      return state;
                    });
                  }
                  break;

                case 'canvas_update':
                  if (data.canvas) {
                    set(state => ({
                      canvases: { ...state.canvases, [data.canvas!.id]: data.canvas! },
                    }));
                  }
                  break;

                case 'error':
                  set({ error: data.error || 'Stream error' });
                  break;
              }

              onEvent?.(data);
            } catch (parseError) {
              console.error('[NativeAgentStore] Failed to parse SSE event:', event.data);
            }
          };

          eventSource.onerror = (error) => {
            console.error('[NativeAgentStore] SSE error:', error);
            set({ error: 'EventSource error' });
          };

          set({ eventSource });

          // Return cleanup function
          return () => {
            eventSource.close();
            set({ eventSource: null });
          };
        },

        disconnectStream: () => {
          const { eventSource } = get();
          if (eventSource) {
            eventSource.close();
            set({ eventSource: null });
          }
        },

        // ----------------------------------------------------------------------
        // UI Actions
        // ----------------------------------------------------------------------

        clearError: () => set({ error: null }),

        clearMessages: (sessionId) => {
          set(state => {
            const newMessages = { ...state.messages };
            delete newMessages[sessionId];
            return { messages: newMessages };
          });
        },
      }),
      {
        name: 'native-agent-storage-v1',
        partialize: (state) => ({
          sessions: state.sessions,
          activeSessionId: state.activeSessionId,
          messages: state.messages,
          canvases: state.canvases,
          sessionCanvases: state.sessionCanvases,
        }),
      }
    ),
    { name: 'native-agent-store' }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectActiveSession = (state: NativeAgentState & NativeAgentActions): NativeSession | null => {
  const { sessions, activeSessionId } = state;
  return sessions.find(s => s.id === activeSessionId) || null;
};

export const selectActiveMessages = (state: NativeAgentState & NativeAgentActions): NativeMessage[] => {
  const { messages, activeSessionId } = state;
  return activeSessionId ? messages[activeSessionId] || [] : [];
};

export const selectSessionCanvases = (state: NativeAgentState & NativeAgentActions, sessionId: string): Canvas[] => {
  const { canvases, sessionCanvases } = state;
  const canvasIds = sessionCanvases[sessionId] || [];
  return canvasIds.map(id => canvases[id]).filter(Boolean);
};

export const selectIsStreaming = (state: NativeAgentState & NativeAgentActions): boolean => {
  return state.streaming.isStreaming;
};

export const selectStreamingError = (state: NativeAgentState & NativeAgentActions): string | null => {
  return state.streaming.error;
};

// ============================================================================
// Hooks
// ============================================================================

export function useActiveSession(): NativeSession | null {
  return useNativeAgentStore(selectActiveSession);
}

export function useActiveMessages(): NativeMessage[] {
  return useNativeAgentStore(selectActiveMessages);
}

export function useSessionCanvases(sessionId: string): Canvas[] {
  return useNativeAgentStore(state => selectSessionCanvases(state, sessionId));
}

export function useStreamingState(): { isStreaming: boolean; error: string | null; buffer: string } {
  return useNativeAgentStore(state => ({
    isStreaming: state.streaming.isStreaming,
    error: state.streaming.error,
    buffer: state.streaming.streamBuffer,
  }));
}

export default useNativeAgentStore;
