/**
 * Bot Profile Utilities
 *
 * Helper functions for working with packaged bot agents.
 * Bots are Agents with `isBot: true` and a `botProfile` extension
 * that provides UX-specific metadata.
 *
 * @module bot-profile
 */

import type { Agent, BotProfile, BotCategory, AvatarConfig } from '../agents/agent.types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('BotProfile');

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if an agent is a packaged bot.
 */
export function isBot(agent: Agent): boolean {
  return agent.isBot === true && agent.botProfile !== undefined;
}

/**
 * Filter agents to only return bots.
 */
export function getBots(agents: Agent[]): Agent[] {
  return agents.filter(isBot);
}

/**
 * Filter bots by category.
 */
export function getBotsByCategory(agents: Agent[], category: BotCategory): Agent[] {
  return getBots(agents).filter(
    (agent) => agent.botProfile?.botCategory === category
  );
}

/**
 * Search bots by name, description, or tags.
 */
export function searchBots(agents: Agent[], query: string): Agent[] {
  const q = query.trim().toLowerCase();
  if (!q) return getBots(agents);

  return getBots(agents).filter((agent) => {
    const profile = agent.botProfile;
    const name = (profile?.displayName ?? agent.name).toLowerCase();
    const description = agent.description.toLowerCase();
    const tagline = (profile?.tagline ?? '').toLowerCase();
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
 * Slug used as a @mention handle when botProfile.handle is unset.
 * Must stay identical to the fallback in startBotGroupChat — group rounds
 * @mention members by this handle.
 */
export function slugBotHandle(displayName: string, fallbackId?: string): string {
  const slug = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (slug) return slug;
  return (fallbackId ?? 'bot').slice(0, 8);
}

/**
 * Get the @mention handle for a bot. Prefers an explicit botProfile.handle,
 * otherwise slugifies the display name the same way group-chat membership does.
 */
export function getBotHandle(agent: Agent): string {
  const explicit = agent.botProfile?.handle?.trim();
  if (explicit) return explicit;
  return slugBotHandle(getBotDisplayName(agent), agent.id);
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

/**
 * Resolve a displayable avatar URL for an agent/bot.
 * Checks the canonical avatar config, legacy string avatar, teammate profile,
 * and config avatar in that order.
 */
export function getProviderLabel(providerId: string): string {
  switch (providerId) {
    case 'hermes':
      return 'Hermes';
    case 'openclaw':
      return 'OpenClaw';
    case 'kimi':
      return 'Kimi';
    default:
      return providerId;
export function getBotAvatarUrl(agent: Agent | null | undefined): string | undefined {
  if (!agent) return undefined;

  const typedAvatar = agent.avatar as AvatarConfig | undefined;
  if (typedAvatar?.type === 'image' && typedAvatar.uri) {
    return typedAvatar.uri;
  }
  if (typeof agent.avatar === 'string' && agent.avatar) {
    return agent.avatar;
  }
  if (agent.teammateProfile?.avatar) {
    return agent.teammateProfile.avatar;
  }

  const configAvatar = agent.config?.avatar as AvatarConfig | string | undefined;
  if (typeof configAvatar === 'object' && configAvatar?.type === 'image' && configAvatar.uri) {
    return configAvatar.uri;
  }
  if (typeof configAvatar === 'string' && configAvatar) {
    return configAvatar;
  }

  return undefined;
}

// ============================================================================
// Bot Creation Helpers
// ============================================================================

const VALID_BOT_TYPES: AgentBot['type'][] = [
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
export function agentToBot(agent: Agent): CanonicalBot {
  const botType = VALID_BOT_TYPES.includes(agent.type as AgentBot['type'])
    ? (agent.type as AgentBot['type'])
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
 * Convert an Agent into a CreateAgentInput draft suitable for duplication or
 * templated creation. Runtime-only fields (id, status, timestamps, runs,
 * ratings, etc.) are stripped, and secret values are redacted so the draft is
 * safe to seed the creation wizard.
 *
 * Share-auth / duplicate inheritance rule (Hermes): a duplicated bot keeps
 * only indirect secret references — `value: undefined` — never plaintext. The
 * new bot therefore inherits the shared secretRef resolution path (the ref is
 * re-resolved against the store at runtime) instead of copying the parent's
 * concrete value. Operational history (runs, assigned tasks, checkpoints,
 * mail) is never inherited: a duplicate starts with a clean identity.
 */
export function agentToCreateAgentInput(agent: Agent): Partial<CreateAgentInput> {
  const redactedSecrets = (agent.secretRefs ?? []).map((ref) => ({
    ...ref,
    value: undefined,
  }));

  return {
    name: agent.name,
    description: agent.description,
    type: VALID_BOT_TYPES.includes(agent.type as AgentBot['type'])
      ? (agent.type as AgentBot['type'])
      : 'specialist',
    model: agent.model,
    provider: agent.provider,
    capabilities: agent.capabilities,
    systemPrompt: agent.systemPrompt,
    tools: agent.tools,
    maxIterations: agent.maxIterations,
    temperature: agent.temperature,
    voice: agent.voice,
    config: agent.config,
    avatar: agent.avatar,
    source: agent.source,
    characterLayer: agent.characterLayer,
    trustTier: agent.trustTier,
    harness: agent.harness,
    allowedSurfaces: agent.allowedSurfaces,
    allowedSkills: agent.allowedSkills,
    allowedTools: agent.allowedTools,
    category: agent.category,
    tags: agent.tags,
    dataClassification: agent.dataClassification,
    writeScope: agent.writeScope,
    isBot: agent.isBot,
    botProfile: agent.botProfile,
    connectorBindings: agent.connectorBindings,
    secretRefs: redactedSecrets,
    messagingConfig: agent.messagingConfig,
    identityChannels: agent.identityChannels,
    vmOperator: agent.vmOperator,
  };
}

/**
 * Create a bot agent from a base agent configuration.
 * This is a factory function that adds bot-specific fields.
 */
export function createBotAgent(
  baseAgent: Omit<Agent, 'isBot' | 'botProfile'>,
  botProfile: BotProfile
): Agent {
  return {
    ...baseAgent,
    isBot: true,
    botProfile,
    // Ensure bot has sensible defaults
    type: baseAgent.type ?? 'specialist',
    status: baseAgent.status ?? 'idle',
    tools: baseAgent.tools ?? [],
    capabilities: baseAgent.capabilities ?? [],
  };
}

/**
 * Update a bot's profile while preserving the agent.
 */
export function updateBotProfile(
  agent: Agent,
  updates: Partial<BotProfile>
): Agent {
  if (!agent.isBot) {
    logger.warn({ agentId: agent.id }, 'updateBotProfile called on non-bot agent');
    return agent;
  }

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
    errors.push('Accent color must be a valid hex color (e.g., #B08D6E)');
  }

  if (profile.starterPrompts && profile.starterPrompts.length > 5) {
    errors.push('Maximum 5 starter prompts allowed');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
