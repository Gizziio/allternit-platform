/**
 * CommRails Mail Store
 *
 * Single source of truth for agent/bot mail inside the CommRails surface.
 * Talks directly to the Rails mail backend. No localStorage fallback.
 */

import { createWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import { railsApi, type MailMessage } from '@/lib/agents/rails.service';
import { createModuleLogger } from '@/lib/logger';
import type { AgentMailMessage, AgentMailThread, SendMailInput } from '@/lib/agents/agent.types';

const logger = createModuleLogger('CommRailsMail');

interface CommRailsMailState {
  messages: AgentMailMessage[];
  threads: AgentMailThread[];
  isLoading: boolean;
  error: string | null;
  lastLoadedAt: number;
}

export interface CreateGroupThreadInput {
  name: string;
  memberIds: string[];
}

export interface SendGroupMailInput {
  threadId: string;
  body: string;
  subject?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  requiresAck?: boolean;
}

interface CommRailsMailActions {
  loadInbox: (agentId: string, limit?: number) => Promise<void>;
  loadThreads: (agentId: string) => Promise<void>;
  refreshInbox: (agentId: string, limit?: number) => Promise<void>;
  sendMail: (
    fromAgentId: string,
    input: SendMailInput,
  ) => Promise<{ sent: boolean; messageId?: string }>;
  createGroupThread: (
    fromAgentId: string,
    input: CreateGroupThreadInput,
  ) => Promise<{ created: boolean; threadId?: string }>;
  sendGroupMail: (
    fromAgentId: string,
    input: SendGroupMailInput,
  ) => Promise<{ sent: boolean; messageId?: string }>;
  acknowledgeMail: (agentId: string, messageId: string) => Promise<void>;
  getUnreadCount: (agentId: string) => number;
  reset: () => void;
}

const initialState: CommRailsMailState = {
  messages: [],
  threads: [],
  isLoading: false,
  error: null,
  lastLoadedAt: 0,
};

export const useCommRailsMailStore = createWithEqualityFn<CommRailsMailState & CommRailsMailActions>()(
  (set, get) => ({
    ...initialState,

    loadInbox: async (agentId: string, limit = 50) => {
      set({ isLoading: true, error: null });
      try {
        const response = await railsApi.mail.inbox({ agent_id: agentId, limit });
        const messages = (response.messages || []).map(transformRailsMessage);
        set({ messages, isLoading: false, lastLoadedAt: Date.now() });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load inbox';
        logger.error({ agentId, err }, message);
        set({ error: message, isLoading: false });
      }
    },

    loadThreads: async (agentId: string) => {
      set({ isLoading: true, error: null });
      try {
        const response = await railsApi.mail.threads();
        const threads = (response.threads || [])
          .filter((t) => t.messages > 0)
          .map((t) => transformRailsThreadSummary(t, get().messages, agentId));
        set({ threads, isLoading: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load threads';
        logger.error({ agentId, err }, message);
        set({ error: message, isLoading: false });
      }
    },

    refreshInbox: async (agentId: string, limit = 50) => {
      await get().loadInbox(agentId, limit);
      await get().loadThreads(agentId);
    },

    sendMail: async (fromAgentId: string, input: SendMailInput) => {
      try {
        const participants = [fromAgentId, input.toAgentId].filter(Boolean) as string[];
        const thread = await railsApi.mail.ensureThread(input.subject, participants);
        const result = await railsApi.mail.send({
          thread_id: thread.thread_id,
          body: input.body,
          from_agent: fromAgentId,
          to_agents: [input.toAgentId],
          subject: input.subject,
          priority: input.priority,
          requires_ack: input.requiresAck,
          attachments: input.attachments?.map((a) => a.ref),
        });
        return { sent: result.sent, messageId: result.message_id };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send mail';
        logger.error({ from: fromAgentId, to: input.toAgentId, err }, message);
        set({ error: message });
        return { sent: false };
      }
    },

    createGroupThread: async (fromAgentId: string, input: CreateGroupThreadInput) => {
      try {
        const participants = Array.from(new Set([fromAgentId, ...input.memberIds]));
        const thread = await railsApi.mail.ensureThread(input.name, participants);
        return { created: true, threadId: thread.thread_id };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create group thread';
        logger.error({ from: fromAgentId, members: input.memberIds, err }, message);
        set({ error: message });
        return { created: false };
      }
    },

    sendGroupMail: async (fromAgentId: string, input: SendGroupMailInput) => {
      try {
        const result = await railsApi.mail.send({
          thread_id: input.threadId,
          body: input.body,
          from_agent: fromAgentId,
          subject: input.subject || 'Group message',
          priority: input.priority,
          requires_ack: input.requiresAck,
        });
        return { sent: result.sent, messageId: result.message_id };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send group mail';
        logger.error({ from: fromAgentId, threadId: input.threadId, err }, message);
        set({ error: message });
        return { sent: false };
      }
    },

    acknowledgeMail: async (_agentId: string, messageId: string) => {
      try {
        const message = get().messages.find((m) => m.id === messageId);
        const threadId = message?.threadId || 'default';
        await railsApi.mail.ack(threadId, messageId);
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === messageId
              ? { ...m, status: 'acknowledged' as const, requiresAck: false, ackedAt: new Date().toISOString() }
              : m,
          ),
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to acknowledge mail';
        logger.error({ messageId, err }, message);
        set({ error: message });
      }
    },

    getUnreadCount: (agentId: string) => {
      return get().messages.filter(
        (m) => m.toAgentId === agentId && (m.status === 'unread' || m.requiresAck),
      ).length;
    },

    reset: () => set(initialState),
  }),
  shallow,
);

function transformRailsMessage(m: MailMessage): AgentMailMessage {
  const toAgents = Array.isArray(m.to_agents) ? m.to_agents : [];
  const requiresAck = Boolean(m.ack_required);
  const isAcknowledged = m.acknowledged === true;
  return {
    id: String(m.message_id || m.timestamp),
    threadId: String(m.thread_id || 'default'),
    fromAgentId: String(m.from_agent || ''),
    fromAgentName: undefined,
    toAgentId: toAgents[0] || (typeof m.to_agent === 'string' ? m.to_agent : undefined),
    subject: typeof m.subject === 'string' ? m.subject : 'Message',
    body: String(m.body || ''),
    bodyRef: typeof m.body_ref === 'string' ? m.body_ref : undefined,
    status: isAcknowledged ? 'read' : 'unread',
    priority: mapRailsPriority(m.priority ?? m.importance),
    timestamp: String(m.timestamp || new Date().toISOString()),
    requiresAck,
  };
}

function mapRailsPriority(value: unknown): AgentMailMessage['priority'] {
  if (typeof value !== 'string') return 'normal';
  switch (value.toLowerCase()) {
    case 'low': return 'low';
    case 'high':
    case 'urgent': return 'high';
    default: return 'normal';
  }
}

function transformRailsThreadSummary(
  t: { thread_id: string; messages: number; last_ts: string },
  messages: AgentMailMessage[],
  agentId: string,
): AgentMailThread {
  const threadMessages = messages.filter((m) => m.threadId === t.thread_id);
  const participants = Array.from(
    new Set(
      threadMessages.flatMap((m) => [m.fromAgentId, m.toAgentId]).filter((p): p is string => typeof p === 'string'),
    ),
  );
  const unreadCount = threadMessages.filter((m) => m.toAgentId === agentId && m.status === 'unread').length;

  return {
    id: t.thread_id,
    subject: threadMessages[0]?.subject || 'Message',
    participants,
    messageCount: t.messages,
    lastMessageAt: t.last_ts,
    unreadCount,
  };
}

/**
 * React hook for a single agent's unread CommRails mail count.
 */
export function useCommRailsUnreadCount(agentId: string): number {
  return useCommRailsMailStore((state) =>
    state.messages.filter((m) => m.toAgentId === agentId && (m.status === 'unread' || m.requiresAck)).length,
  );
}
