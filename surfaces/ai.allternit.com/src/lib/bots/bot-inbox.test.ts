/**
 * Tests for the unified Inbox badge aggregation (spec Phase 2):
 * unread mail + visible attention + new-activity watermarks.
 */

import { describe, it, expect } from 'vitest';
import {
  countUnreadBotMail,
  selectVisibleBotAttention,
  countNewActivityBots,
  computeInboxBadge,
} from './bot-inbox';
import type { AgentMailMessage } from '@/lib/agents/agent.types';
import type { Agent } from '@/lib/agents/agent.types';
import type { BotAttentionEntry } from '@/lib/agents/agent.store';

function mail(overrides: Partial<AgentMailMessage>): AgentMailMessage {
  return {
    id: 'm1',
    threadId: 't1',
    fromAgentId: 'bot-2',
    toAgentId: 'bot-1',
    subject: 'S',
    body: 'B',
    status: 'unread',
    priority: 'normal',
    timestamp: '2026-09-07T08:00:00Z',
    ...overrides,
  };
}

function bot(id: string, overrides: Partial<Agent> = {}): Agent {
  return {
    id,
    name: id,
    isBot: true,
    botProfile: { displayName: id },
    ...overrides,
  } as Agent;
}

describe('countUnreadBotMail', () => {
  it('counts unread + ack-required mail addressed to bots only', () => {
    const messages = [
      mail({ id: 'm1' }),                                     // unread to bot-1 ✓
      mail({ id: 'm2', status: 'read' }),                     // read ✗
      mail({ id: 'm3', status: 'read', requiresAck: true }),  // ack-required ✓
      mail({ id: 'm4', toAgentId: 'human-1' }),               // not a bot ✗
      mail({ id: 'm5', toAgentId: undefined }),               // unknown ✗
    ];
    expect(countUnreadBotMail(messages, new Set(['bot-1', 'bot-2']))).toBe(2);
  });
});

describe('selectVisibleBotAttention', () => {
  const entry: BotAttentionEntry = { reason: 'missing_config', hint: 'Missing API key', notedAt: 1_000 };

  it('keeps attention for visible bots and filters archived/hidden', () => {
    const agents = [
      bot('bot-1'),
      bot('bot-2', { botProfile: { displayName: 'b2', lifecycle: 'archived' } } as Partial<Agent>),
      { id: 'human-1', name: 'human' } as Agent,
    ];
    const attention: Record<string, BotAttentionEntry> = {
      'bot-1': entry,
      'bot-2': entry,
      'human-1': entry,
    };
    const items = selectVisibleBotAttention(attention, agents);
    expect(items).toHaveLength(1);
    expect(items[0].bot.id).toBe('bot-1');
  });
});

describe('countNewActivityBots', () => {
  const bots = [bot('bot-1'), bot('bot-2')];
  const canonical = { 'bot-1': 'chat-1', 'bot-2': 'chat-2' };

  it('counts bots whose activity is newer than their watermark', () => {
    expect(
      countNewActivityBots(
        bots,
        { 'bot-1': 2_000, 'bot-2': 1_000 },
        { 'bot-1': 1_500, 'bot-2': 1_000 },
        null,
        canonical,
      ),
    ).toBe(1);
  });

  it('excludes the focused session and handles missing watermarks', () => {
    expect(
      countNewActivityBots(bots, { 'bot-1': 2_000, 'bot-2': 3_000 }, {}, 'chat-1', canonical),
    ).toBe(1); // only bot-2 counts (bot-1 is focused)
  });
});

describe('computeInboxBadge', () => {
  it('sums mail + attention + new activity', () => {
    const agents = [bot('bot-1')];
    const badge = computeInboxBadge({
      messages: [mail({ id: 'm1' }), mail({ id: 'm2' })],
      bots: agents,
      attention: { 'bot-1': { reason: 'agent_blocked', hint: 'h', notedAt: 1 } },
      agents,
      activityByBot: { 'bot-1': 5_000 },
      watermarks: {},
      focusedSessionId: null,
      canonicalChatIds: { 'bot-1': 'chat-1' },
    });
    // 2 unread mail + 1 attention + 1 new activity
    expect(badge).toBe(4);
  });
});
