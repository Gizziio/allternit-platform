/**
 * Bot Types — Deprecated in favor of Agent type with botProfile
 *
 * The PackagedBot interface has been superseded by the Agent type
 * with `isBot: true` and a `botProfile` extension. See:
 * - `../agents/agent.types.ts` for the Agent interface
 * - `./bot-profile.ts` for bot helper functions
 * - `./bots.manifest.ts` for BotTemplate factories
 *
 * @deprecated Use Agent with isBot and botProfile instead.
 */

import type { Icon } from '@phosphor-icons/react';

/**
 * @deprecated Use Agent with botProfile instead.
 */
export interface PackagedBot {
  id: string;
  name: string;
  description: string;
  icon: Icon;
  tags: string[];
  systemPrompt: string;
  defaultModel?: string;
  starterMessages?: string[];
}

/**
 * Migration helper: convert old PackagedBot to Agent-compatible shape.
 * Use this only for legacy code paths.
 */
export function migratePackagedBotToAgent(bot: PackagedBot) {
  const now = new Date().toISOString();
  return {
    id: `bot_${bot.id}`,
    name: bot.name,
    description: bot.description,
    type: 'specialist' as const,
    model: bot.defaultModel ?? 'default',
    provider: 'custom' as const,
    capabilities: [],
    systemPrompt: bot.systemPrompt,
    tools: [],
    maxIterations: 50,
    temperature: 0.7,
    config: {},
    status: 'idle' as const,
    createdAt: now,
    updatedAt: now,
    tags: bot.tags,
    isBot: true,
    botProfile: {
      displayName: bot.name,
      tagline: bot.description,
      starterPrompts: bot.starterMessages ?? [],
      groupChatEnabled: false,
    },
  };
}
