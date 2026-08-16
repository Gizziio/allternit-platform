/**
 * Bot Contract
 *
 * Defines the canonical schema and runtime contract that separates an Agent
 * from a packaged Bot in the Allternit platform.
 *
 * Terms:
 * - Agent: a runtime configuration (model, prompts, tools, harness, trust) that
 *   can execute tasks. Agents are the underlying primitive.
 * - Bot: an Agent that has been packaged for end-user consumption with a curated
 *   identity (displayName, category, welcome message, starter prompts, accent
 *   color) and optional autonomous primitives (connectors, secrets, messaging,
 *   identity channels). Every Bot is an Agent; not every Agent is a Bot.
 *
 * This module is the source of truth for:
 * - Validating whether an Agent record satisfies the Bot contract
 * - Packaging an existing Agent as a Bot
 * - Enumerating the autonomous primitives a Bot may declare
 */

import { z } from 'zod';
import type { Agent, Bot, BotProfile } from '@/lib/agents/agent.types';
import {
  harnessConfigSchema,
  agentConnectorBindingSchema,
  agentSecretRefSchema,
  agentMessagingConfigSchema,
  agentIdentityChannelsSchema,
  agentVMOperatorConfigSchema,
} from '@/lib/agents/agent.types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('BotContract');

// ============================================================================
// Bot profile contract
// ============================================================================

export const botCategorySchema = z.enum([
  'research',
  'code',
  'writing',
  'data',
  'sales',
  'design',
  'ops',
  'custom',
]);

export type BotCategory = z.infer<typeof botCategorySchema>;

export const botProfileSchema = z.object({
  /** Display name shown in the bot hub, composer pill, and session header */
  displayName: z.string().min(1).max(120),
  /** Short tagline shown on the bot card */
  tagline: z.string().max(240).optional(),
  /** Welcome message surfaced when a new bot session starts */
  welcomeMessage: z.string().max(2000).optional(),
  /** Clickable starter prompts in the bot home and new-session screen */
  starterPrompts: z.array(z.string().min(1).max(500)).max(12).optional(),
  /** Accent color for the bot's UI chrome (hex, rgb, or hsl) */
  accentColor: z
    .string()
    .regex(/^(#[0-9A-Fa-f]{3,8}|rgb\(.*\)|hsl\(.*\))$/, {
      message: 'accentColor must be a hex, rgb, or hsl color string',
    })
    .optional(),
  /** Whether this bot can be added to group conversations */
  groupChatEnabled: z.boolean().optional(),
  /** Default workspace preset ID for sessions started with this bot */
  defaultPresetId: z.string().optional(),
  /** Category used for filtering and discovery in the bot hub */
  botCategory: botCategorySchema.optional(),
});

// ============================================================================
// Autonomous primitives contract
// ============================================================================

export const botConnectorBindingSchema = agentConnectorBindingSchema;
export const botSecretRefSchema = agentSecretRefSchema;
export const botMessagingConfigSchema = agentMessagingConfigSchema;
export const botIdentityChannelsSchema = agentIdentityChannelsSchema;
export const botVMOperatorSchema = agentVMOperatorConfigSchema;

// ============================================================================
// Bot package contract
// ============================================================================

/**
 * A BotPackage is the minimal, validatable shape of a packaged bot.
 * It intentionally mirrors Agent so that validation can run against raw
 * Agent records coming from the API or local store.
 */
export const botPackageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(2000),
  type: z.enum(['orchestrator', 'sub-agent', 'worker', 'specialist', 'reviewer']),
  model: z.string().min(1),
  provider: z.enum(['openai', 'anthropic', 'google', 'local', 'custom']),
  capabilities: z.array(z.string()),
  systemPrompt: z.string().max(50000).optional(),
  tools: z.array(z.string()),
  maxIterations: z.number().int().min(1).max(100),
  temperature: z.number().min(0).max(2),
  status: z.enum(['idle', 'running', 'paused', 'error']),
  createdAt: z.string(),
  updatedAt: z.string(),

  // Required bot marker
  isBot: z.literal(true),
  botProfile: botProfileSchema,

  // Optional presentation metadata
  category: z.enum(['engineering', 'design', 'marketing', 'product', 'research', 'operations', 'creative', 'general']).optional(),
  tags: z.array(z.string()).optional(),
  config: z.record(z.unknown()).optional(),

  // Optional autonomous primitives
  harness: harnessConfigSchema.optional(),
  connectorBindings: z.array(botConnectorBindingSchema).optional(),
  secretRefs: z.array(botSecretRefSchema).optional(),
  messagingConfig: botMessagingConfigSchema.optional(),
  identityChannels: botIdentityChannelsSchema.optional(),
  vmOperator: botVMOperatorSchema.optional(),
});

export type BotPackage = z.infer<typeof botPackageSchema>;

// ============================================================================
// Validation
// ============================================================================

export interface BotValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate that an Agent record satisfies the Bot contract.
 * Returns a list of human-readable errors if it does not.
 */
export function validateBot(agent: unknown): BotValidationResult {
  const parseResult = botPackageSchema.safeParse(agent);
  if (parseResult.success) {
    return { valid: true, errors: [] };
  }

  const errors = parseResult.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
    return `${path}: ${issue.message}`;
  });

  logger.debug({ errors }, 'Bot contract validation failed');
  return { valid: false, errors };
}

/**
 * Type guard: returns true when the agent is a valid packaged Bot.
 */
export function isValidBot(agent: unknown): agent is BotPackage {
  return validateBot(agent).valid;
}

// ============================================================================
// Packaging
// ============================================================================

export interface PackageAgentAsBotInput {
  /** Existing agent to package */
  agent: Agent;
  /** Bot UX profile */
  botProfile: BotProfile;
  /** Optional autonomous primitives */
  connectorBindings?: Agent['connectorBindings'];
  secretRefs?: Agent['secretRefs'];
  messagingConfig?: Agent['messagingConfig'];
  identityChannels?: Agent['identityChannels'];
  vmOperator?: Agent['vmOperator'];
}

/**
 * Package an existing Agent as a Bot.
 * Returns a new object that satisfies the Bot contract.
 */
export function packageAgentAsBot(input: PackageAgentAsBotInput): Bot {
  const { agent, botProfile, connectorBindings, secretRefs, messagingConfig, identityChannels, vmOperator } = input;

  const packaged: Bot = {
    ...agent,
    isBot: true,
    botProfile,
    connectorBindings: connectorBindings ?? agent.connectorBindings,
    secretRefs: secretRefs ?? agent.secretRefs,
    messagingConfig: messagingConfig ?? agent.messagingConfig,
    identityChannels: identityChannels ?? agent.identityChannels,
    vmOperator: vmOperator ?? agent.vmOperator,
  };

  const validation = validateBot(packaged);
  if (!validation.valid) {
    throw new Error(`Failed to package agent as bot: ${validation.errors.join('; ')}`);
  }

  return packaged;
}

// ============================================================================
// Contract documentation helpers
// ============================================================================

/**
 * List the autonomous primitives declared on a Bot.
 * Useful for the bot home runtime tab and setup wizard.
 */
export function listBotPrimitives(agent: Agent): {
  hasConnectors: boolean;
  hasSecrets: boolean;
  hasMessaging: boolean;
  hasIdentityChannels: boolean;
  hasVMOperator: boolean;
  missingRequiredSecrets: string[];
} {
  const secretRefs = agent.secretRefs ?? [];
  const missingRequiredSecrets = secretRefs
    .filter((s) => s.required && !s.vaultRef)
    .map((s) => s.key);

  return {
    hasConnectors: (agent.connectorBindings?.length ?? 0) > 0,
    hasSecrets: secretRefs.length > 0,
    hasMessaging: agent.messagingConfig?.photonEnabled === true || agent.messagingConfig?.crossSurfaceEnabled === true,
    hasIdentityChannels:
      Boolean(agent.identityChannels?.email) ||
      Boolean(agent.identityChannels?.phone) ||
      Boolean(agent.identityChannels?.wallet),
    hasVMOperator: agent.vmOperator?.enabled === true,
    missingRequiredSecrets,
  };
}

/**
 * Return a display summary for the bot contract.
 */
export function describeBotContract(): string {
  return [
    'Bot Contract (Allternit Platform)',
    '',
    'A Bot is an Agent that has been packaged for end-user consumption.',
    'Required fields:',
    '  - isBot: true',
    '  - botProfile.displayName',
    '',
    'Optional autonomous primitives:',
    '  - connectorBindings: external service permissions',
    '  - secretRefs: vault-backed runtime secrets',
    '  - messagingConfig: Photon / cross-surface orchestration',
    '  - identityChannels: email, phone, wallet (incl. etrid)',
    '  - vmOperator: sandboxed virtual computer / computer-use primitive',
  ].join('\n');
}
