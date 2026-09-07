/**
 * Teammates Selection (spec Phase 1 rail rule, extracted pure)
 *
 * Membership rule for the TEAMMATES rail section: a bot qualifies when its
 * presence is not idle OR it has unread mail OR it has an attention entry.
 * Ordering: working first, then active, then idle-recruits, each by recency
 * (lastActivityAt desc). Display is capped (Hermes' lean rail) with the
 * remainder folded into the "All teammates" overflow.
 *
 * This module is the pure mirror of the rule that renders the rail section;
 * keeping it store-free makes the policy testable without mounting the rail.
 *
 * @module bot-teammates-selection
 */

import type { Bot } from '../agents/agent.types';
import type { BotPresenceState } from './bot-presence';

/** Hermes rail cap: at most this many teammate rows render. */
export const TEAMMATES_CAP = 6;

export interface TeammateCandidate {
  bot: Bot;
  presence: BotPresenceState;
  /** Attention entry, when the bot has a persistent failure badge. */
  attentionEntry?: unknown;
  /** Unread mail count for the bot. */
  unreadCount: number;
}

export interface TeammateEntry {
  bot: Bot;
  presence: BotPresenceState;
  attentionEntry?: unknown;
  unreadCount: number;
}

export interface TeammatesSelection {
  /** Qualifying entries in display order, capped at TEAMMATES_CAP. */
  visible: TeammateEntry[];
  /** Number of qualifying entries hidden by the cap (≥ 0). */
  overflowCount: number;
}

const PRESENCE_RANK: Record<BotPresenceState['presence'], number> = {
  working: 0,
  active: 1,
  idle: 2,
};

/**
 * Apply the membership rule, rank, and cap. Pure: same inputs → same output.
 */
export function selectTeammates(candidates: TeammateCandidate[]): TeammatesSelection {
  const qualifying = candidates
    .filter(
      (c) =>
        c.presence.presence !== 'idle' ||
        c.unreadCount > 0 ||
        c.attentionEntry != null,
    )
    .map((c) => ({
      bot: c.bot,
      presence: c.presence,
      attentionEntry: c.attentionEntry,
      unreadCount: c.unreadCount,
    }));

  qualifying.sort(
    (a, b) =>
      PRESENCE_RANK[a.presence.presence] - PRESENCE_RANK[b.presence.presence] ||
      b.presence.lastActivityAt - a.presence.lastActivityAt,
  );

  const visible = qualifying.slice(0, TEAMMATES_CAP);
  return { visible, overflowCount: qualifying.length - visible.length };
}
