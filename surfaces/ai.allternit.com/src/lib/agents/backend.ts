/**
 * Backend selector for session stores.
 *
 * Each mode store (chat, code, cowork, design) injects its own backend
 * client via StoreConfig. There is NO global mutable state — mode
 * isolation is enforced at construction time.
 */

import {
  sessionApi as nativeSessionApi,
  chatApi as nativeChatApi,
  type BackendSession,
  type BackendMessage,
  type AgentContext,
  type ChatStreamCallbacks,
} from './native-agent-api';

export type { BackendSession, BackendMessage, AgentContext, ChatStreamCallbacks };

export type BackendType = 'native';

/** Session API contract — implemented by both native and Allternit AI backends. */
export interface SessionApi {
  listSessions(): Promise<any[]>;
  getSession(sessionId: string): Promise<any>;
  createSession(options: any): Promise<any>;
  updateSession(sessionId: string, updates: any): Promise<any>;
  deleteSession(sessionId: string): Promise<void>;
  listMessages(sessionId: string): Promise<any[]>;
  sendMessage(sessionId: string, msg: { text: string; role?: string }): Promise<any>;
}

/** Chat API contract — implemented by both native and Allternit AI backends. */
export interface ChatApi {
  streamChat(
    sessionId: string,
    message: string,
    modelId: string | undefined,
    callbacks: ChatStreamCallbacks,
    signal?: AbortSignal,
    agentContext?: AgentContext,
  ): Promise<void>;
  abortGeneration(sessionId: string): Promise<void>;
}

// Export concrete implementations so stores can inject their own backend
export { nativeSessionApi, nativeChatApi };
