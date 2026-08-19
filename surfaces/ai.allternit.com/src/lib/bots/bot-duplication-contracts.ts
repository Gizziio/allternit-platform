/**
 * Bot Duplication Contracts
 *
 * TypeScript/Zod contracts for safely duplicating a packaged bot. A duplicate
 * must copy canonical identity and runtime configuration while excluding active
 * runtime state, secrets, and unique identities unless explicitly and safely
 * re-provisioned.
 *
 * @module bot-duplication-contracts
 */

import { z } from 'zod';
import { BotSchema, type Bot } from './orpc-contracts';

// ============================================================================
// Clone options
// ============================================================================

export const BotCloneOptionsSchema = z.object({
  /** Human-readable reason for the clone (audit). */
  reason: z.string().optional(),

  // Scope toggles
  includeMemory: z.boolean().default(false),
  includeRoutines: z.boolean().default(false),
  includeWorkspaceDocs: z.boolean().default(true),
  includeComputerTemplate: z.boolean().default(false),
  includeChildTopology: z.boolean().default(false),

  /**
   * When true, connector bindings are carried forward as references that require
   * re-authorization before use. Raw credential values are never copied.
   */
  copyConnectorBindings: z.boolean().default(false),

  /**
   * When true, provision new unique identities (email, phone, wallet, handle).
   * If false, the clone receives no identities and the operator must assign them.
   */
  provisionNewIdentities: z.boolean().default(false),

  /** Optional explicit display name override for the clone. */
  displayName: z.string().optional(),

  /** Optional explicit handle override. Must be unique in the namespace. */
  handle: z.string().optional(),
});

export type BotCloneOptions = z.infer<typeof BotCloneOptionsSchema>;

// ============================================================================
// Identity provisioning
// ============================================================================

export const IdentityKindSchema = z.enum([
  'email',
  'phone',
  'wallet',
  'handle',
  'webauthn_credential',
  'oauth_connection',
]);

export type IdentityKind = z.infer<typeof IdentityKindSchema>;

export const ProvisionedIdentitySchema = z.object({
  kind: IdentityKindSchema,
  sourceId: z.string(),
  newId: z.string(),
  redacted: z.boolean().default(true),
  /** Whether the identity has been activated and ownership verified. */
  activated: z.boolean().default(false),
  /** Human-readable note about activation (e.g. verification email sent). */
  statusNote: z.string().optional(),
});

export type ProvisionedIdentity = z.infer<typeof ProvisionedIdentitySchema>;

// ============================================================================
// Child-bot graph preview
// ============================================================================

export const ChildBotGraphNodeSchema = z.object({
  sourceBotId: z.string(),
  sourceParentBotId: z.string().optional(),
  depth: z.number().int().nonnegative(),
  wouldCopy: z.boolean(),
  policyReauthorizationRequired: z.boolean().default(false),
});

export type ChildBotGraphNode = z.infer<typeof ChildBotGraphNodeSchema>;

export const ChildBotGraphPreviewSchema = z.object({
  rootBotId: z.string(),
  nodes: z.array(ChildBotGraphNodeSchema),
  edges: z.array(z.tuple([z.string(), z.string()])),
  depthLimit: z.number().int().nonnegative(),
  reachedDepthLimit: z.boolean(),
  hasCycle: z.boolean(),
  cyclePath: z.array(z.string()).optional(),
  totalNodes: z.number().int().nonnegative(),
  nodesToCopy: z.number().int().nonnegative(),
});

export type ChildBotGraphPreview = z.infer<typeof ChildBotGraphPreviewSchema>;

// ============================================================================
// Clone preview
// ============================================================================

export const BotClonePreviewSchema = z.object({
  sourceBotId: z.string(),
  newBotId: z.string(),
  newHandle: z.string().optional(),
  options: BotCloneOptionsSchema,
  identityProvisions: z.array(ProvisionedIdentitySchema).default([]),
  childGraph: ChildBotGraphPreviewSchema.optional(),
  warnings: z.array(z.string()).default([]),
});

export type BotClonePreview = z.infer<typeof BotClonePreviewSchema>;

// ============================================================================
// Redacted duplication receipt
// ============================================================================

export const DuplicationIdMappingSchema = z.object({
  sourceId: z.string(),
  newId: z.string(),
  entityType: z.enum(['bot', 'routine', 'memory', 'connector', 'computer', 'child_bot', 'session', 'receipt']),
  copied: z.boolean(),
  redacted: z.boolean().default(false),
  reauthorizationRequired: z.boolean().default(false),
});

export type DuplicationIdMapping = z.infer<typeof DuplicationIdMappingSchema>;

export const BotCloneReceiptSchema = z.object({
  id: z.string(),
  sourceBotId: z.string(),
  newBotId: z.string(),
  newHandle: z.string().optional(),
  createdAt: z.string(),
  createdBy: z.string().optional(),
  options: BotCloneOptionsSchema,
  idMappings: z.array(DuplicationIdMappingSchema),
  warnings: z.array(z.string()).default([]),
});

export type BotCloneReceipt = z.infer<typeof BotCloneReceiptSchema>;

// ============================================================================
// Validation
// ============================================================================

/**
 * Fields and entities that must never be duplicated under any option.
 */
export const NON_DUPLICATABLE_PATHS = [
  'id',
  'createdAt',
  'updatedAt',
  'sessions',
  'activeRuns',
  'activeLeases',
  'pendingApprovals',
  'runningJobs',
  'receiptIdentities',
  'runtimeIds',
  'apiKeys',
  'secrets',
  'tokens',
] as const;

export type NonDuplicatablePath = (typeof NON_DUPLICATABLE_PATHS)[number];

/**
 * Validate that a proposed clone options object is well-formed.
 */
export function validateCloneOptions(options: unknown): BotCloneOptions {
  return BotCloneOptionsSchema.parse(options);
}

/**
 * Create a redacted receipt mapping. Sensitive identifiers are masked.
 */
export function createRedactedMapping(
  sourceId: string,
  newId: string,
  entityType: DuplicationIdMapping['entityType'],
  copied: boolean,
  opts: { reauthorizationRequired?: boolean } = {},
): DuplicationIdMapping {
  return DuplicationIdMappingSchema.parse({
    sourceId,
    newId,
    entityType,
    copied,
    redacted: entityType === 'connector' || entityType === 'receipt',
    reauthorizationRequired: opts.reauthorizationRequired ?? false,
  });
}

// ============================================================================
// Default clone options
// ============================================================================

export function defaultCloneOptions(): BotCloneOptions {
  return BotCloneOptionsSchema.parse({});
}

// ============================================================================
// Child-graph clone options
// ============================================================================

export const BotCloneGraphOptionsSchema = z.object({
  /** Maximum recursion depth when following child-bot topology. */
  recursionLimit: z.number().int().nonnegative().default(3),
  /** When true, detected cycles abort the clone and trigger rollback. */
  abortOnCycle: z.boolean().default(true),
  /** When true, each cloned child must have its policies reauthorized. */
  requirePolicyReauthorization: z.boolean().default(true),
  /**
   * Child entities to copy. If empty, the graph preview still walks the topology
   * but records `wouldCopy: false` for every node.
   */
  includeChildTopology: z.boolean().default(false),
});

export type BotCloneGraphOptions = z.infer<typeof BotCloneGraphOptionsSchema>;

// ============================================================================
// Errors
// ============================================================================

export class BotCloneError extends Error {
  constructor(
    message: string,
    public readonly code: 'cycle_detected' | 'depth_exceeded' | 'identity_provisioning_failed' | 'rollback_failed' | 'invalid_source',
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'BotCloneError';
  }
}
