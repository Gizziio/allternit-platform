/**
 * Unified Bot Roster Hook
 *
 * Merges native Allternit bots (from the agent store) with stacked external
 * bots (Hermes, OpenClaw, etc.) into a single roster surface. Source-qualified
 * keys prevent duplicate React keys and disambiguate same-named bots across
 * connections, matching the Hermes Bot Mode multi-source roster pattern.
 *
 * @module use-unified-roster
 */

import { useMemo } from 'react';
import { useAgentStore } from '@/lib/agents/agent.store';
import { useAgentsWithSwarms } from '@/lib/agents';
import { isBot, getBotDisplayName } from './bot-profile';
import { useStackProviders } from './use-stack-providers';
import type { Agent } from '@/lib/agents/agent.types';
import type { StackedAgent } from './stacked-agent.service';

export type RosterBotSource = 'native' | 'stacked';

export interface UnifiedRosterBot {
  /** Unique roster key. Native bots use their agent id; stacked bots are prefixed with their provider id. */
  id: string;
  /** Human-readable display name. */
  displayName: string;
  /** Short handle used for @mentions. */
  handle: string;
  /** One-line description or tagline. */
  tagline: string;
  /** Accent color for UI chrome. */
  accentColor?: string;
  /** Canonical operational status. */
  status: Agent['status'];
  /** Where this bot came from. */
  source: RosterBotSource;
  /** For stacked bots, the provider id (e.g. 'hermes'). */
  providerId?: string;
  /** The underlying agent record. */
  agent: Agent;
  /** For stacked bots, the original stacked reference. */
  stacked?: StackedAgent;
  /** ISO timestamp of last update. */
  updatedAt: string;
}

function toUnifiedBot(agent: Agent, source: RosterBotSource, stacked?: StackedAgent): UnifiedRosterBot {
  const isNativeBot = isBot(agent);
  const handle = agent.botProfile?.handle ?? agent.name;
  const accentColor = isNativeBot ? agent.botProfile?.accentColor : undefined;

  return {
    id: source === 'stacked' && stacked ? `${stacked.external.providerId}:${agent.id}` : agent.id,
    displayName: getBotDisplayName(agent),
    handle,
    tagline: agent.botProfile?.tagline ?? agent.description,
    accentColor,
    status: agent.status,
    source,
    providerId: stacked?.external.providerId,
    agent,
    stacked,
    updatedAt: agent.updatedAt,
  };
}

/**
 * Merge native bots and stacked external bots into a single roster list.
 *
 * Native bots take precedence when ids collide; stacked bots are prefixed so
 * collisions are rare.
 */
export function useUnifiedRoster(): UnifiedRosterBot[] {
  const agents = useAgentsWithSwarms();
  const { stackedAgents } = useStackProviders();

  return useMemo(() => {
    const seen = new Set<string>();
    const results: UnifiedRosterBot[] = [];

    for (const agent of agents) {
      if (!isBot(agent)) continue;
      const bot = toUnifiedBot(agent, 'native');
      if (seen.has(bot.id)) continue;
      seen.add(bot.id);
      results.push(bot);
    }

    for (const stacked of stackedAgents) {
      const bot = toUnifiedBot(stacked.agent, 'stacked', stacked);
      if (seen.has(bot.id)) continue;
      seen.add(bot.id);
      results.push(bot);
    }

    return results;
  }, [agents, stackedAgents]);
}

/**
 * Resolve a roster bot by its handle or display name (case-insensitive).
 * Native bots are checked before stacked bots.
 */
export function resolveRosterBot(
  name: string,
  roster: UnifiedRosterBot[],
): UnifiedRosterBot | undefined {
  const lower = name.toLowerCase();
  return roster.find(
    (b) =>
      b.handle.toLowerCase() === lower ||
      b.displayName.toLowerCase() === lower ||
      b.agent.name.toLowerCase() === lower,
  );
}
