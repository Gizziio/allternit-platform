/**
 * Tests for the teammates membership rule (lib/bots/bot-teammates-selection.ts).
 */

import { describe, it, expect } from 'vitest';
import { selectTeammates, TEAMMATES_CAP, type TeammateCandidate } from './bot-teammates-selection';
import type { BotPresenceState } from './bot-presence';
import type { Bot } from '../agents/agent.types';

function makeBot(id: string): Bot {
  return { id, name: id, isBot: true, botProfile: { displayName: id } } as unknown as Bot;
}

function presence(p: BotPresenceState['presence'], lastActivityAt = 0): BotPresenceState {
  return { presence: p, lastActivityAt };
}

function candidate(overrides: Partial<TeammateCandidate> & { bot: Bot }): TeammateCandidate {
  return {
    presence: presence('idle'),
    unreadCount: 0,
    ...overrides,
  };
}

describe('selectTeammates — membership rule', () => {
  it('excludes bots that are idle with no unread and no attention', () => {
    const result = selectTeammates([
      candidate({ bot: makeBot('quiet') }),
      candidate({ bot: makeBot('active-bot'), presence: presence('active', 1_000) }),
    ]);
    expect(result.visible.map((e) => e.bot.id)).toEqual(['active-bot']);
    expect(result.overflowCount).toBe(0);
  });

  it('includes an idle bot when it has unread mail', () => {
    const result = selectTeammates([candidate({ bot: makeBot('mail'), unreadCount: 2 })]);
    expect(result.visible.map((e) => e.bot.id)).toEqual(['mail']);
  });

  it('includes an idle bot when it has an attention entry', () => {
    const result = selectTeammates([
      candidate({ bot: makeBot('attention'), attentionEntry: { reason: 'missing_config' } }),
    ]);
    expect(result.visible.map((e) => e.bot.id)).toEqual(['attention']);
  });

  it('unread and attention do not suppress a presence-based entry', () => {
    const result = selectTeammates([
      candidate({
        bot: makeBot('busy'),
        presence: presence('working', 500),
        unreadCount: 1,
        attentionEntry: { reason: 'provider_quota_limit' },
      }),
    ]);
    expect(result.visible).toHaveLength(1);
    expect(result.visible[0].presence.presence).toBe('working');
  });
});

describe('selectTeammates — ordering', () => {
  it('ranks working above active above idle-recruits', () => {
    const result = selectTeammates([
      candidate({ bot: makeBot('idle-unread'), unreadCount: 1 }),
      candidate({ bot: makeBot('active'), presence: presence('active', 900) }),
      candidate({ bot: makeBot('working'), presence: presence('working', 100) }),
    ]);
    expect(result.visible.map((e) => e.bot.id)).toEqual(['working', 'active', 'idle-unread']);
  });

  it('breaks ties by lastActivityAt descending', () => {
    const result = selectTeammates([
      candidate({ bot: makeBot('older'), presence: presence('active', 500) }),
      candidate({ bot: makeBot('newer'), presence: presence('active', 5_000) }),
    ]);
    expect(result.visible.map((e) => e.bot.id)).toEqual(['newer', 'older']);
  });
});

describe('selectTeammates — cap', () => {
  it(`caps the rail at ${TEAMMATES_CAP} rows and reports the overflow`, () => {
    const candidates = Array.from({ length: TEAMMATES_CAP + 3 }, (_, i) =>
      candidate({
        bot: makeBot(`bot-${i}`),
        presence: presence('active', i * 1_000),
      }),
    );
    const result = selectTeammates(candidates);
    expect(result.visible).toHaveLength(TEAMMATES_CAP);
    expect(result.overflowCount).toBe(3);
    // Newest activity first: bot-(cap+2) down to bot-3.
    expect(result.visible[0].bot.id).toBe(`bot-${TEAMMATES_CAP + 2}`);
    expect(result.visible[TEAMMATES_CAP - 1].bot.id).toBe('bot-3');
  });

  it('reports zero overflow when everything fits', () => {
    const result = selectTeammates([
      candidate({ bot: makeBot('a'), presence: presence('working') }),
      candidate({ bot: makeBot('b'), unreadCount: 1 }),
    ]);
    expect(result.visible).toHaveLength(2);
    expect(result.overflowCount).toBe(0);
  });

  it('returns an empty rail when nobody qualifies', () => {
    expect(selectTeammates([candidate({ bot: makeBot('quiet') })])).toEqual({
      visible: [],
      overflowCount: 0,
    });
  });
});
