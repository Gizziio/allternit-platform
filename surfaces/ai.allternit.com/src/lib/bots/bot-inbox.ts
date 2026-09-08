/**
 * Bot Inbox Selectors
 *
 * Pure aggregation helpers for the unified Inbox rail row (spec Phase 2):
 * badge = unread CommRails mail across bots + visible attention count +
 * new-activity watermark count. Kept as pure functions so the badge math is
 * unit-testable without mounting the rail.
 *
 * @module bot-inbox
 */

import type { AgentMailMessage } from '@/lib/agents/agent.types';
import type { BotAttentionEntry } from '@/lib/agents/agent.store';
import { getVisibleAttention } from '@/lib/agents/agent.store';
import type { Agent } from '@/lib/agents/agent.types';
import { isBot } from '@/lib/bots/bot-profile';
import { computeHasNewActivity } from './bot-activity-watermark';

/** Unread + ack-required CommRails mail addressed to any of the given bots. */
export function countUnreadBotMail(messages: AgentMailMessage[], botIds: Set<string>): number {
  let count = 0;
  for (const m of messages) {
    if (!m.toAgentId || !botIds.has(m.toAgentId)) continue;
    if (m.status === 'unread' || m.requiresAck) count += 1;
  }
  return count;
}

/** Attention entries visible for bots (archived/hidden filtered by the selector). */
export function selectVisibleBotAttention(
  attention: Record<string, BotAttentionEntry>,
  agents: Agent[],
): Array<{ bot: Agent; entry: BotAttentionEntry }> {
  const visible = getVisibleAttention(attention, agents);
  const result: Array<{ bot: Agent; entry: BotAttentionEntry }> = [];
  for (const agent of agents) {
    if (!isBot(agent)) continue;
    const entry = visible[agent.id];
    if (entry) result.push({ bot: agent, entry });
  }
  return result;
}

/**
 * New-activity count across bots: canonical-chat activity newer than the
 * watermark, excluding the currently focused session.
 */
export function countNewActivityBots(
  bots: Agent[],
  activityByBot: Record<string, number>,
  watermarks: Record<string, number>,
  focusedSessionId: string | null,
  canonicalChatIds: Record<string, string>,
): number {
  let count = 0;
  for (const bot of bots) {
    if (focusedSessionId && canonicalChatIds[bot.id] === focusedSessionId) continue;
    if (computeHasNewActivity(activityByBot[bot.id] ?? 0, watermarks[bot.id])) count += 1;
  }
  return count;
}

/** Unified Inbox badge: mail unread + visible attention + new-activity watermarks. */
export function computeInboxBadge(input: {
  messages: AgentMailMessage[];
  bots: Agent[];
  attention: Record<string, BotAttentionEntry>;
  agents: Agent[];
  activityByBot: Record<string, number>;
  watermarks: Record<string, number>;
  focusedSessionId: string | null;
  canonicalChatIds: Record<string, string>;
}): number {
  const botIds = new Set(input.bots.map((b) => b.id));
  return (
    countUnreadBotMail(input.messages, botIds) +
    selectVisibleBotAttention(input.attention, input.agents).length +
    countNewActivityBots(
      input.bots,
      input.activityByBot,
      input.watermarks,
      input.focusedSessionId,
      input.canonicalChatIds,
    )
  );
}
