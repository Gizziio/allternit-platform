"use client";

/**
 * Conversations API Client
 *
 * Client-side API for conversation branching operations.
 * Communicates with /api/v1/conversations/* endpoints.
 */

import { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConversationRecord {
  id: string;
  object: "conversation";
  created_at: string;
  updated_at: string;
  title: string | null;
  parent_conversation_id: string | null;
  message_count: number;
  branch_count: number;
}

export interface ConversationMessageRecord {
  id: string;
  object: "conversation.message";
  created_at: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  parent_message_id: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ConversationListResponse {
  object: "list";
  data: ConversationRecord[];
  has_more: boolean;
}

export interface ConversationMessageListResponse {
  object: "list";
  conversation_id: string;
  data: ConversationMessageRecord[];
  has_more: boolean;
}

export interface ForkOptions {
  fromMessageId?: string;
  title?: string;
}

export interface ForkResponse {
  id: string;
  object: "conversation";
  created_at: string;
  updated_at: string;
  title: string | null;
  parent_conversation_id: string | null;
  forked_from_message_id: string | null;
  message_count: number;
}

export interface CreateConversationOptions {
  conversation_id?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface AddMessageOptions {
  role: "user" | "assistant" | "system";
  content: string;
  parentMessageId?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// ConversationsAPI class
// ---------------------------------------------------------------------------

export class ConversationsAPI {
  private readonly baseUrl: string;

  constructor(baseUrl = "/api/v1/conversations") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async request<T>(
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { "Content-Type": "application/json", ...init?.headers },
      ...init,
    });

    if (!res.ok) {
      let errBody: { message?: string; error?: string } = {};
      try {
        errBody = (await res.json()) as typeof errBody;
      } catch {
        // ignore parse errors
      }
      throw new Error(
        errBody.message ?? errBody.error ?? `Request failed: ${res.status} ${res.statusText}`,
      );
    }

    return res.json() as Promise<T>;
  }

  /** List all persisted conversations for the current user. */
  list(): Promise<ConversationListResponse> {
    return this.request<ConversationListResponse>("");
  }

  /** Fetch a single conversation by ID. */
  get(id: string): Promise<ConversationRecord> {
    return this.request<ConversationRecord>(`/${encodeURIComponent(id)}`);
  }

  /** Create a new conversation. */
  create(options: CreateConversationOptions = {}): Promise<ConversationRecord> {
    return this.request<ConversationRecord>("", {
      method: "POST",
      body: JSON.stringify(options),
    });
  }

  /**
   * Fork a conversation from a given message point.
   * Creates a new branch with parentConversationId set to `id`.
   */
  fork(id: string, options: ForkOptions = {}): Promise<ForkResponse> {
    return this.request<ForkResponse>(`/${encodeURIComponent(id)}/fork`, {
      method: "POST",
      body: JSON.stringify(options),
    });
  }

  /** List messages in a conversation. */
  listMessages(id: string): Promise<ConversationMessageListResponse> {
    return this.request<ConversationMessageListResponse>(
      `/${encodeURIComponent(id)}/messages`,
    );
  }

  /** Add a message to a conversation. */
  addMessage(
    id: string,
    options: AddMessageOptions,
  ): Promise<ConversationMessageRecord> {
    return this.request<ConversationMessageRecord>(
      `/${encodeURIComponent(id)}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          role: options.role,
          content: options.content,
          parentMessageId: options.parentMessageId,
          metadata: options.metadata,
        }),
      },
    );
  }

  /**
   * List child conversations (branches) forked from this conversation.
   */
  listBranches(id: string): Promise<ConversationListResponse> {
    return this.request<ConversationListResponse>(
      `/${encodeURIComponent(id)}/replies`,
    );
  }
}

/** Singleton instance of the conversations API client. */
export const conversationsApi = new ConversationsAPI();

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

interface UseConversationsState {
  conversations: ConversationRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  create: (options?: CreateConversationOptions) => Promise<ConversationRecord>;
  fork: (id: string, options?: ForkOptions) => Promise<ForkResponse>;
}

export function useConversations(): UseConversationsState {
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    conversationsApi
      .list()
      .then((res) => {
        if (!cancelled) {
          setConversations(res.data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load conversations");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  const create = useCallback(async (options: CreateConversationOptions = {}) => {
    const conversation = await conversationsApi.create(options);
    refresh();
    return conversation;
  }, [refresh]);

  const fork = useCallback(async (id: string, options: ForkOptions = {}) => {
    const forked = await conversationsApi.fork(id, options);
    refresh();
    return forked;
  }, [refresh]);

  return { conversations, loading, error, refresh, create, fork };
}
