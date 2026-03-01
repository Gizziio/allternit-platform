/**
 * ConversationStore - Pure state management for conversation ↔ brain session linking
 *
 * This store bridges the gap between:
 * - ChatStorage (manages chat sessions)
 * - BrainContext (manages brain sessions)
 * - App.tsx navigation state (uses chatSessionId)
 *
 * IMPORTANT: This store must remain PURE (no React hooks inside).
 * Wire runtime dependencies (ChatStorage, BrainContext) in components.
 */

import { chatStorage, type ChatSession } from './ChatStorage';

// Internal conversation type (separate from ChatSession)
export interface Conversation {
  id: string;                    // Internal conversation ID
  chatSessionId: string;         // What App.tsx/ChatSessions use for navigation
  title: string;
  mode: 'brain' | 'api';
  linkedBrainSessionId?: string; // Optional brain session linkage
  createdAt: number;
  updatedAt: number;
}

// Navigation target for deep linking
export type NavTarget =
  | { kind: 'tab'; tabId: 'chats' | 'console' | 'uiTars' }
  | { kind: 'chatSession'; chatSessionId: string }
  | { kind: 'brainSession'; sessionId: string };

interface ConversationStoreState {
  conversations: Map<string, Conversation>;
  activeConversationId: string | null;

  // Get chatSessionId for a conversation (for navigation)
  getChatSessionId(conversationId: string): string | undefined;

  // Create a new conversation with a ChatSession
  createConversation(opts: {
    source: 'voice' | 'text' | 'uiTars';
    title?: string;
  }): Promise<{ conversationId: string; chatSessionId: string }>;

  // Link a brain session to an existing conversation
  linkBrainSession(conversationId: string, brainSessionId: string): void;

  // Get conversation by chatSessionId
  getByChatSessionId(chatSessionId: string): Conversation | undefined;

  // Update conversation title
  updateTitle(conversationId: string, title: string): void;

  // Clear all conversations (for testing/reset)
  clear(): void;

  // Dev-only: validate invariants
  validateInvariants(): boolean;
}

class ConversationStoreImpl implements ConversationStoreState {
  conversations: Map<string, Conversation> = new Map();
  activeConversationId: string | null = null;

  getChatSessionId(conversationId: string): string | undefined {
    const conv = this.conversations.get(conversationId);
    return conv?.chatSessionId;
  }

  getByChatSessionId(chatSessionId: string): Conversation | undefined {
    for (const conv of this.conversations.values()) {
      if (conv.chatSessionId === chatSessionId) {
        return conv;
      }
    }
    return undefined;
  }

  async createConversation(opts: {
    source: 'voice' | 'text' | 'uiTars';
    title?: string;
  }): Promise<{ conversationId: string; chatSessionId: string }> {
    const now = Date.now();

    // Generate internal conversation ID
    const conversationId = `conv_${now}_${Math.random().toString(36).substr(2, 9)}`;

    // Create title if not provided
    const title = opts.title || `${opts.source.charAt(0).toUpperCase() + opts.source.slice(1)} Chat`;

    // Create chat session via ChatStorage (this is what App.tsx understands)
    const chatSession = await chatStorage.createSession(title, '');

    // Create internal conversation record
    const conversation: Conversation = {
      id: conversationId,
      chatSessionId: chatSession.id,
      title,
      mode: 'brain', // Default to brain mode, may be 'api' if brain unavailable
      createdAt: now,
      updatedAt: now,
    };

    this.conversations.set(conversationId, conversation);
    this.activeConversationId = conversationId;

    console.log('[ConversationStore] Created conversation:', {
      conversationId,
      chatSessionId: chatSession.id,
      source: opts.source,
    });

    return {
      conversationId,
      chatSessionId: chatSession.id,
    };
  }

  linkBrainSession(conversationId: string, brainSessionId: string): void {
    const conv = this.conversations.get(conversationId);
    if (!conv) {
      console.warn('[ConversationStore] Cannot link: conversation not found:', conversationId);
      return;
    }

    conv.linkedBrainSessionId = brainSessionId;
    conv.updatedAt = Date.now();
    this.conversations.set(conversationId, conv);

    console.log('[ConversationStore] Linked brain session:', {
      conversationId,
      brainSessionId,
    });
  }

  updateTitle(conversationId: string, title: string): void {
    const conv = this.conversations.get(conversationId);
    if (!conv) return;

    conv.title = title;
    conv.updatedAt = Date.now();
    this.conversations.set(conversationId, conv);

    // Dev-only invariant checks
    if (process.env.NODE_ENV === 'development') {
      // Verify the chat session still exists in ChatStorage
      chatStorage.getSession(conv.chatSessionId).then((session) => {
        if (!session) {
          console.warn('[ConversationStore] Invariant violation: chatSessionId does not exist in ChatStorage:', conv.chatSessionId);
        }
      });
    }
  }

  clear(): void {
    this.conversations.clear();
    this.activeConversationId = null;
  }

  // Dev-only invariant check: verify all conversations map to valid chat sessions
  validateInvariants(): boolean {
    if (process.env.NODE_ENV !== 'development') return true;

    let valid = true;
    for (const conv of this.conversations.values()) {
      if (!conv.chatSessionId || typeof conv.chatSessionId !== 'string') {
        console.warn('[ConversationStore] Invariant violation: invalid chatSessionId:', conv.chatSessionId);
        valid = false;
      }
      if (conv.chatSessionId && conv.chatSessionId.trim() === '') {
        console.warn('[ConversationStore] Invariant violation: empty chatSessionId for conversation:', conv.id);
        valid = false;
      }
    }
    return valid;
  }
}

// Export singleton instance
export const conversationStore = new ConversationStoreImpl();

// Also export class for testing
export { ConversationStoreImpl };
