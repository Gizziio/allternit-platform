/**
 * In-memory store for the Replies Runtime.
 * Phase 1 — no persistence. Replace with Postgres in Phase 2 (#39).
 */

import type { Reply, ReplyEvent } from "@allternit/replies-contract";
import {
  createConversationReplyState,
  reduceReplyEvent,
} from "@allternit/replies-reducer";
import type { ConversationReplyState } from "@allternit/replies-contract";

// ---------------------------------------------------------------------------
// Conversation
// ---------------------------------------------------------------------------

export interface Conversation {
  id: string;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Run (execution record)
// ---------------------------------------------------------------------------

export interface Run {
  id: string;
  replyId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  provider: string;
  startedAt: number;
  completedAt?: number;
  error?: string;
}

export interface RunEvent {
  id: number;
  runId: string;
  seq: number;
  type: string;
  payload: ReplyEvent;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// SSE subscriber
// ---------------------------------------------------------------------------

export type SseSubscriber = (event: ReplyEvent) => void;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface Store {
  conversations: Map<string, Conversation>;
  replies: Map<string, Reply>;
  replyIdsByConversation: Map<string, string[]>;
  runs: Map<string, Run>;
  runEvents: Map<string, RunEvent[]>;
  runIdByReply: Map<string, string>;
  conversationState: Map<string, ConversationReplyState>;
  subscribers: Map<string, Set<SseSubscriber>>;
  runEventSeq: Map<string, number>;
}

const store: Store = {
  conversations: new Map(),
  replies: new Map(),
  replyIdsByConversation: new Map(),
  runs: new Map(),
  runEvents: new Map(),
  runIdByReply: new Map(),
  conversationState: new Map(),
  subscribers: new Map(),
  runEventSeq: new Map(),
};

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export function createConversation(id: string): Conversation {
  const c: Conversation = { id, createdAt: Date.now() };
  store.conversations.set(id, c);
  return c;
}

export function getConversation(id: string): Conversation | undefined {
  return store.conversations.get(id);
}

export function getRepliesForConversation(conversationId: string): Reply[] {
  const ids = store.replyIdsByConversation.get(conversationId) ?? [];
  return ids.flatMap((id) => {
    const r = store.replies.get(id);
    return r ? [r] : [];
  });
}

// ---------------------------------------------------------------------------
// Replies
// ---------------------------------------------------------------------------

export function createReply(reply: Reply): void {
  store.replies.set(reply.id, reply);
  if (reply.conversationId) {
    const existing = store.replyIdsByConversation.get(reply.conversationId) ?? [];
    store.replyIdsByConversation.set(reply.conversationId, [...existing, reply.id]);

    // Init conversation state
    if (!store.conversationState.has(reply.conversationId)) {
      store.conversationState.set(reply.conversationId, createConversationReplyState());
    }
  }
}

export function getReply(id: string): Reply | undefined {
  return store.replies.get(id);
}

export function updateReply(id: string, updates: Partial<Reply>): Reply | undefined {
  const existing = store.replies.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates };
  store.replies.set(id, updated);
  return updated;
}

// ---------------------------------------------------------------------------
// SSE — dispatch a ReplyEvent to all subscribers + reduce into state
// ---------------------------------------------------------------------------

export function dispatchEvent(replyId: string, event: ReplyEvent): void {
  const reply = store.replies.get(replyId);
  const conversationId = reply?.conversationId ?? replyId;

  // Reduce into canonical state
  const current = store.conversationState.get(conversationId) ?? createConversationReplyState();
  store.conversationState.set(conversationId, reduceReplyEvent(current, event));

  // Persist to run events
  const runId = store.runIdByReply.get(replyId);
  if (runId) {
    const seq = (store.runEventSeq.get(runId) ?? 0) + 1;
    store.runEventSeq.set(runId, seq);
    const events = store.runEvents.get(runId) ?? [];
    events.push({ id: events.length + 1, runId, seq, type: event.type, payload: event, createdAt: Date.now() });
    store.runEvents.set(runId, events);
  }

  // Fan out to SSE subscribers
  const subs = store.subscribers.get(replyId);
  if (subs) {
    for (const sub of subs) {
      sub(event);
    }
  }
}

export function subscribe(replyId: string, sub: SseSubscriber): () => void {
  if (!store.subscribers.has(replyId)) {
    store.subscribers.set(replyId, new Set());
  }
  store.subscribers.get(replyId)!.add(sub);
  return () => {
    store.subscribers.get(replyId)?.delete(sub);
  };
}

export function getConversationState(conversationId: string): ConversationReplyState | undefined {
  return store.conversationState.get(conversationId);
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export function createRun(run: Run): void {
  store.runs.set(run.id, run);
  store.runIdByReply.set(run.replyId, run.id);
  store.runEvents.set(run.id, []);
  store.runEventSeq.set(run.id, 0);
}

export function getRun(id: string): Run | undefined {
  return store.runs.get(id);
}

export function updateRun(id: string, updates: Partial<Run>): Run | undefined {
  const existing = store.runs.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates };
  store.runs.set(id, updated);
  return updated;
}

export function getRunEvents(runId: string): RunEvent[] {
  return store.runEvents.get(runId) ?? [];
}
