/**
 * Bot Profile Utilities
 *
 * Helper functions for working with packaged bot agents.
 * Bots are Agents with `isBot: true` and a `botProfile` extension
 * that provides UX-specific metadata.
 *
 * @module bot-profile
 */

import type { Agent, BotProfile, BotCategory } from '../agents/agent.types';
import { BotSchema, type Bot } from './orpc-contracts';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('BotProfile');

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if an agent is a packaged bot.
 *
 * This is a strict type guard: when it returns true, TypeScript knows the
 * agent has `isBot: true` and a required `botProfile` with `displayName`.
 */
export function isBot(agent: Agent): agent is Bot {
  return agent.isBot === true && agent.botProfile !== undefined;
}

/**
 * Filter agents to only return bots.
 */
export function getBots(agents: Agent[]): Bot[] {
  return agents.filter(isBot);
}

/**
 * Filter bots by category.
 */
export function getBotsByCategory(agents: Agent[], category: BotCategory): Bot[] {
  return getBots(agents).filter(
    (agent) => agent.botProfile.botCategory === category
  );
}

/**
 * Search bots by name, description, or tags.
 */
export function searchBots(agents: Agent[], query: string): Bot[] {
  const q = query.trim().toLowerCase();
  if (!q) return getBots(agents);

  return getBots(agents).filter((agent) => {
    const profile = agent.botProfile;
    const name = profile.displayName.toLowerCase();
    const description = agent.description.toLowerCase();
    const tagline = (profile.tagline ?? '').toLowerCase();
    const tags = agent.tags ?? [];

    return (
      name.includes(q) ||
      description.includes(q) ||
      tagline.includes(q) ||
      tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });
}

// ============================================================================
// Display Helpers
// ============================================================================

/**
 * Get the display name for a bot (prefers botProfile.displayName).
 */
export function getBotDisplayName(agent: Agent): string {
  return agent.botProfile?.displayName ?? agent.name;
}

/**
 * Get the bot's tagline or description.
 */
export function getBotTagline(agent: Agent): string {
  return agent.botProfile?.tagline ?? agent.description;
}

/**
 * Get the bot's welcome message.
 */
export function getBotWelcomeMessage(agent: Agent): string | undefined {
  return agent.botProfile?.welcomeMessage;
}

/**
 * Get starter prompts for the bot.
 */
export function getBotStarterPrompts(agent: Agent): string[] {
  return agent.botProfile?.starterPrompts ?? [];
}

/**
 * Get the bot's accent color for UI theming.
 */
export function getBotAccentColor(agent: Agent): string | undefined {
  return agent.botProfile?.accentColor;
}

/**
 * Check if the bot supports group chat.
 */
export function isGroupChatEnabled(agent: Agent): boolean {
  return agent.botProfile?.groupChatEnabled ?? false;
}

/**
 * Get the bot's category.
 */
export function getBotCategory(agent: Agent): BotCategory | undefined {
  return agent.botProfile?.botCategory;
}

// ============================================================================
// Bot Creation Helpers
// ============================================================================

const VALID_BOT_TYPES: Bot['type'][] = [
  'orchestrator',
  'sub-agent',
  'worker',
  'specialist',
  'reviewer',
];

/**
 * Convert an Agent that represents a packaged bot into the canonical Bot
 * contract used by the duplication and roster services.
 *
 * Drops agent-only fields that are not part of the Bot contract.
 */
export function agentToBot(agent: Agent): Bot {
  const botType = VALID_BOT_TYPES.includes(agent.type as Bot['type'])
    ? (agent.type as Bot['type'])
    : 'specialist';

  return BotSchema.parse({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    type: botType,
    model: agent.model ?? 'default',
    provider: agent.provider ?? 'custom',
    avatar: undefined,
    isBot: true,
    botProfile: agent.botProfile,
    operationalState: undefined,
    parentBotId: undefined,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  });
}

/**
 * Create a bot agent from a base agent configuration.
 * This is a factory function that adds bot-specific fields.
 */
export function createBotAgent(
  baseAgent: Omit<Agent, 'isBot' | 'botProfile'>,
  botProfile: BotProfile
): Agent {
  const withDefaults: Agent = {
    ...baseAgent,
    type: baseAgent.type ?? 'specialist',
    status: baseAgent.status ?? 'idle',
    tools: baseAgent.tools ?? [],
    capabilities: baseAgent.capabilities ?? [],
  } as Agent;

  return packageAgentAsBot({ agent: withDefaults, botProfile });
}

/**
 * Update a bot's profile while preserving the agent.
 */
export function updateBotProfile(
  agent: Bot,
  updates: Partial<BotProfile>
): Bot {
  return {
    ...agent,
    botProfile: {
      ...agent.botProfile,
      ...updates,
    },
  };
}

// ============================================================================
// Bot Categories
// ============================================================================

export const BOT_CATEGORIES: Record<BotCategory, { label: string; description: string }> = {
  research: {
    label: 'Research',
    description: 'Information gathering and analysis',
  },
  code: {
    label: 'Code',
    description: 'Software development and engineering',
  },
  writing: {
    label: 'Writing',
    description: 'Content creation and editing',
  },
  data: {
    label: 'Data',
    description: 'Data analysis and visualization',
  },
  sales: {
    label: 'Sales',
    description: 'Outreach and lead generation',
  },
  design: {
    label: 'Design',
    description: 'UI/UX and visual design',
  },
  ops: {
    label: 'Operations',
    description: 'Process automation and workflows',
  },
  custom: {
    label: 'Custom',
    description: 'Specialized or user-defined bots',
  },
};

/**
 * Get all bot categories as an array.
 */
export function getBotCategories(): Array<{ id: BotCategory; label: string; description: string }> {
  return Object.entries(BOT_CATEGORIES).map(([id, config]) => ({
    id: id as BotCategory,
    ...config,
  }));
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate that a bot profile has required fields.
 */
export function validateBotProfile(profile: Partial<BotProfile>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!profile.displayName?.trim()) {
    errors.push('Bot must have a display name');
  }

  if (profile.accentColor && !/^#[0-9A-F]{6}$/i.test(profile.accentColor)) {
    errors.push('Accent color must be a valid hex color (e.g., #8b5cf6)');
  }

  if (profile.starterPrompts && profile.starterPrompts.length > 5) {
    errors.push('Maximum 5 starter prompts allowed');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
