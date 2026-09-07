/**
 * Async bot wake — Grok/Hermes handoff.
 *
 * Delivers a message into a bot's canonical chat and optionally waits for the
 * turn to finish. DMs are fire-and-forget; group rounds wait so the room can
 * serialize replies.
 *
 * Failures are classified with the typed failure taxonomy (spec AD-3): the
 * typed reason rides alongside the free-text error, transient classes get at
 * most one immediate retry (same target, same message), attention-class
 * failures badge the bot in the agent store, and the next successful turn
 * clears the badge.
 */

import { openBotCanonicalChat } from './bot-canonical-chat.service';
import { classifyFailure, classifyRetry, isAttentionReason } from './failure-reasons';
import { useAgentStore } from '@/lib/agents/agent.store';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { createModuleLogger } from '@/lib/logger';
import type { FailureReason } from './failure-reasons';

const logger = createModuleLogger('BotWake');

export interface WakeBotOptions {
  botId: string;
  botName: string;
  message: string;
  waitForReply?: boolean;
}

export interface WakeBotResult {
  /** Last assistant reply, when waited for and produced. */
  reply?: string;
  /** Typed failure reason, when the wake failed. */
  reason?: FailureReason;
  /** Free-text error message, when the wake failed. */
  error?: string;
}

function noteAttention(botId: string, reason: FailureReason, error?: string): void {
  if (!isAttentionReason(reason)) return;
  try {
    useAgentStore.getState().noteBotAttention(botId, reason);
  } catch (err) {
    logger.warn({ err, botId }, 'Failed to record bot attention');
  }
}

function clearAttention(botId: string): void {
  try {
    useAgentStore.getState().clearBotAttention(botId);
  } catch (err) {
    logger.warn({ err, botId }, 'Failed to clear bot attention');
  }
}

async function deliver(sessionId: string, message: string): Promise<void> {
  const store = useChatSessionStore.getState();
  const send = store.sendMessageStream
    ? store.sendMessageStream(sessionId, { text: message })
    : store.sendMessage(sessionId, { text: message });
  await send;
}

async function readReply(sessionId: string): Promise<string | undefined> {
  const session = useChatSessionStore.getState().sessions.find((s) => s.id === sessionId);
  const lastAssistant = [...(session?.messages ?? [])]
    .reverse()
    .find((m) => m.role === 'assistant');
  return typeof lastAssistant?.content === 'string' ? lastAssistant.content : undefined;
}

export async function wakeBot(options: WakeBotOptions): Promise<WakeBotResult> {
  const { botId, botName, message, waitForReply = false } = options;
  if (!message.trim()) return {};

  const sessionId = await openBotCanonicalChat({
    botId,
    botName,
    kickoff: '',
    setActive: false,
  });

  logger.info({ botId, sessionId, waitForReply }, 'Waking bot');

  if (!waitForReply) {
    // Fire-and-forget: record the typed reason on failure, never retry.
    void deliver(sessionId, message).catch((err) => {
      const reason = classifyFailure(err);
      logger.error({ err, botId, reason }, 'Fire-and-forget wake failed');
      noteAttention(botId, reason);
    });
    return {};
  }

  try {
    await deliver(sessionId, message);
  } catch (err) {
    const reason = classifyFailure(err);
    const error = err instanceof Error ? err.message : String(err);
    const policy = classifyRetry(reason);

    logger.error({ err, botId, reason, retry: policy.retry }, 'Wake failed');

    // One immediate retry for transient classes only (spec AD-3): same
    // target, same message. Auth/quota/config failures are never retried.
    if (policy.retry === 'once') {
      try {
        await deliver(sessionId, message);
        clearAttention(botId);
        return { reply: await readReply(sessionId) };
      } catch (retryErr) {
        const retryReason = classifyFailure(retryErr);
        const retryError = retryErr instanceof Error ? retryErr.message : String(retryErr);
        logger.error({ err: retryErr, botId, reason: retryReason }, 'Wake retry failed');
        noteAttention(botId, retryReason);
        return { reason: retryReason, error: retryError };
      }
    }

    noteAttention(botId, reason);
    return { reason, error };
  }

  // Successful turn: the next good turn clears any attention badge.
  clearAttention(botId);
  return { reply: await readReply(sessionId) };
}
