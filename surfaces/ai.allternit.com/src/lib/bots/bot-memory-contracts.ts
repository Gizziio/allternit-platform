/**
 * Bot Memory Contracts
 *
 * Isolated, durable memory for packaged bots. Every memory lives in a
 * bot-scoped namespace and may be further scoped to a session or project.
 * Memories carry provenance, confidence, sensitivity, expiry, and lifecycle
 * state so that retrieval, inspection, and deletion can be audited and
 * policy-driven.
 *
 * @module bot-memory-contracts
 */

import { z } from 'zod';

// ============================================================================
// Schema version
// ============================================================================

export const BOT_MEMORY_SCHEMA_VERSION = 1;

// ============================================================================
// Scopes and identity
// ============================================================================

export const BotMemoryScopeSchema = z.enum(['bot', 'session', 'project']);
export type BotMemoryScope = z.infer<typeof BotMemoryScopeSchema>;

// ============================================================================
// Lifecycle status
// ============================================================================

export const BotMemoryStatusSchema = z.enum([
  'candidate',
  'promoted',
  'pinned',
  'expired',
  'corrected',
  'contradicted',
  'forgotten',
]);
export type BotMemoryStatus = z.infer<typeof BotMemoryStatusSchema>;

// ============================================================================
// Sensitivity
// ============================================================================

export const BotMemorySensitivitySchema = z.enum([
  'public',
  'internal',
  'confidential',
  'secret',
]);
export type BotMemorySensitivity = z.infer<typeof BotMemorySensitivitySchema>;

// ============================================================================
// Provenance
// ============================================================================

export const BotMemorySourceTypeSchema = z.enum([
  'user',
  'assistant',
  'tool',
  'compaction',
  'policy',
  'manual',
  'import',
]);
export type BotMemorySourceType = z.infer<typeof BotMemorySourceTypeSchema>;

export const BotMemoryProvenanceSchema = z.object({
  /** What produced this memory candidate or record. */
  sourceType: BotMemorySourceTypeSchema,
  /** Human-readable description of the source (e.g. event id, message id). */
  sourceId: z.string().optional(),
  /** Event or message range that contributed the fact. */
  eventRange: z
    .object({
      fromEventId: z.string(),
      toEventId: z.string(),
    })
    .optional(),
  /** Model that generated or extracted the memory. */
  model: z.string().optional(),
  /** Version of the prompt/template used for extraction. */
  promptVersion: z.string().optional(),
  /** Original text snippet from which the memory was derived. */
  originalText: z.string().optional(),
});

export type BotMemoryProvenance = z.infer<typeof BotMemoryProvenanceSchema>;

// ============================================================================
// Memory record
// ============================================================================

export const BotMemoryRecordSchema = z.object({
  id: z.string(),
  /** Owning bot id. Namespace boundary. */
  botId: z.string(),
  /** Tenant / user boundary. Cross-tenant access is forbidden. */
  tenantId: z.string(),
  scope: BotMemoryScopeSchema,
  /** Required when scope is 'session'. */
  sessionId: z.string().optional(),
  /** Required when scope is 'project'. */
  projectId: z.string().optional(),
  /** Canonical fact or learned preference. */
  content: z.string().min(1),
  /** Where this memory came from. */
  provenance: BotMemoryProvenanceSchema,
  /** 0–1 confidence in the extracted fact. */
  confidence: z.number().min(0).max(1).default(0.8),
  sensitivity: BotMemorySensitivitySchema.default('internal'),
  status: BotMemoryStatusSchema.default('candidate'),
  /** ISO timestamp after which the memory should not be used. */
  expiresAt: z.string().optional(),
  /** Id of the memory this record corrects or supersedes. */
  correctsMemoryId: z.string().optional(),
  /** Ids of memories that contradict this record. */
  contradictedByMemoryIds: z.array(z.string()).default([]),
  /** Why the memory was remembered, edited, pinned, expired, or forgotten. */
  reason: z.string().optional(),
  /** Free-form audit notes for user inspection. */
  auditNotes: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type BotMemoryRecord = z.infer<typeof BotMemoryRecordSchema>;

// ============================================================================
// Promotion policy
// ============================================================================

export const BotMemoryPromotionPolicySchema = z.object({
  /** Minimum confidence for automatic promotion from candidate. */
  minConfidence: z.number().min(0).max(1).default(0.75),
  /** Sensitivity levels that may be auto-promoted. */
  allowedSensitivities: z
    .array(BotMemorySensitivitySchema)
    .default(['public', 'internal']),
  /** Never auto-promote memories whose source is in this list. */
  blockedSourceTypes: z.array(BotMemorySourceTypeSchema).default([]),
  /** Require explicit user review for these scopes. */
  requireReviewForScopes: z.array(BotMemoryScopeSchema).default([]),
});

export type BotMemoryPromotionPolicy = z.infer<
  typeof BotMemoryPromotionPolicySchema
>;

// ============================================================================
// Retrieval query
// ============================================================================

export const BotMemoryQuerySchema = z.object({
  tenantId: z.string(),
  botId: z.string(),
  /** Scope filter. Omit to query all bot-owned memories. */
  scope: BotMemoryScopeSchema.optional(),
  sessionId: z.string().optional(),
  projectId: z.string().optional(),
  /** Text substring match (case-insensitive). */
  contains: z.string().optional(),
  /** Status filter. Defaults to active promoted/pinned memories. */
  status: z.union([BotMemoryStatusSchema, z.array(BotMemoryStatusSchema)]).optional(),
  /** Maximum sensitivity to include. */
  maxSensitivity: BotMemorySensitivitySchema.optional(),
  /** Include expired memories. */
  includeExpired: z.boolean().default(false),
  /** Hard cap on returned memories. */
  limit: z.number().int().nonnegative().default(50),
});

export type BotMemoryQuery = z.infer<typeof BotMemoryQuerySchema>;

// ============================================================================
// Retrieval log (why remembered / why returned)
// ============================================================================

export const BotMemoryRetrievalLogSchema = z.object({
  id: z.string(),
  memoryId: z.string(),
  botId: z.string(),
  tenantId: z.string(),
  query: z.record(z.unknown()),
  /** Why this memory was included in the result set. */
  reason: z.enum(['scope_match', 'pinned', 'keyword_match', 'policy_rule']),
  occurredAt: z.string(),
});

export type BotMemoryRetrievalLog = z.infer<typeof BotMemoryRetrievalLogSchema>;

// ============================================================================
// Evaluation sets
// ============================================================================

export interface BotMemoryEvaluationCase {
  id: string;
  query: BotMemoryQuery;
  expectedMemoryIds: string[];
  forbiddenMemoryIds: string[];
  description: string;
}

export interface BotMemoryEvaluationResult {
  caseId: string;
  passed: boolean;
  precision: number;
  recall: number;
  returnedIds: string[];
  falsePositives: string[];
  falseNegatives: string[];
}

// ============================================================================
// Errors
// ============================================================================

export class BotMemoryNotFoundError extends Error {
  constructor(
    message: string,
    public readonly memoryId: string,
  ) {
    super(message);
    this.name = 'BotMemoryNotFoundError';
  }
}

export class BotMemoryAuthorizationError extends Error {
  constructor(
    message: string,
    public readonly tenantId: string,
    public readonly botId: string,
  ) {
    super(message);
    this.name = 'BotMemoryAuthorizationError';
  }
}

export class BotMemoryValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: string[],
  ) {
    super(message);
    this.name = 'BotMemoryValidationError';
  }
}
