/**
 * Bot Workspace Contracts
 *
 * Versioned canonical workspace contract for packaged bots. A bot's durable
 * identity and policy are represented as a set of workspace files that can be
 * serialized, deserialized, imported, exported, diffed, and rolled back.
 *
 * @module bot-workspace-contracts
 */

import { z } from 'zod';

// ============================================================================
// Schema version
// ============================================================================

export const BOT_WORKSPACE_SCHEMA_VERSION = 1;
export const BOT_WORKSPACE_GENERATOR_VERSION = '1.0.0';

// ============================================================================
// Canonical file paths
// ============================================================================

/**
 * Canonical workspace files for a packaged bot.
 *
 * These map to the architecture-required artifacts:
 * - AGENTS.md / role document   → purpose and operating instructions
 * - SOUL.md                     → personality and voice
 * - USER.md                     → human relationship and preferences
 * - GOVERNANCE.md               → hard bans, trust, escalation
 * - TOOLS.md                    → tool guidance
 * - SKILLS.json                 → skills manifest
 * - HEARTBEAT.md                → scheduled behavior intent
 * - MEMORY.md                   → long-term learned facts
 */
export const BOT_WORKSPACE_FILES = {
  manifest: '.allternit/bot/manifest.json',
  agents: '.allternit/bot/AGENTS.md',
  soul: '.allternit/bot/SOUL.md',
  user: '.allternit/bot/USER.md',
  governance: '.allternit/bot/GOVERNANCE.md',
  tools: '.allternit/bot/TOOLS.md',
  skills: '.allternit/bot/SKILLS.json',
  heartbeat: '.allternit/bot/HEARTBEAT.md',
  memory: '.allternit/bot/MEMORY.md',
} as const;

export type BotWorkspaceFilePath = (typeof BOT_WORKSPACE_FILES)[keyof typeof BOT_WORKSPACE_FILES];

// ============================================================================
// Workspace file
// ============================================================================

export const BotWorkspaceFileSchema = z.object({
  /** Workspace-relative path (e.g. `.allternit/bot/SOUL.md`). */
  path: z.string(),
  /** File content in UTF-8. */
  content: z.string(),
  /** ISO timestamp of the last known file modification. */
  lastModified: z.string().optional(),
});

export type BotWorkspaceFile = z.infer<typeof BotWorkspaceFileSchema>;

// ============================================================================
// Workspace snapshot
// ============================================================================

export const BotWorkspaceSnapshotSchema = z.object({
  botId: z.string(),
  /** Deterministic content hash of the workspace files. */
  revision: z.string(),
  /** Schema version of the workspace contract. */
  schemaVersion: z.number().int().nonnegative(),
  /** Version of the serializer that produced the snapshot. */
  generatorVersion: z.string(),
  /** Canonical files that make up the workspace. */
  files: z.array(BotWorkspaceFileSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type BotWorkspaceSnapshot = z.infer<typeof BotWorkspaceSnapshotSchema>;

// ============================================================================
// Audit log
// ============================================================================

export const BotWorkspaceAuditActionSchema = z.enum([
  'write',
  'rollback',
  'import',
  'export',
  'clone',
  'delete',
]);

export type BotWorkspaceAuditAction = z.infer<typeof BotWorkspaceAuditActionSchema>;

export const BotWorkspaceAuditEntrySchema = z.object({
  id: z.string(),
  botId: z.string(),
  action: BotWorkspaceAuditActionSchema,
  previousRevision: z.string().nullable(),
  newRevision: z.string(),
  actorId: z.string().optional(),
  occurredAt: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export type BotWorkspaceAuditEntry = z.infer<typeof BotWorkspaceAuditEntrySchema>;

// ============================================================================
// Manifest payload
// ============================================================================

export const BotWorkspaceManifestSchema = z.object({
  schemaVersion: z.number().int().nonnegative(),
  generatorVersion: z.string(),
  revision: z.string(),
  botId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  files: z.array(z.string()),
});

export type BotWorkspaceManifest = z.infer<typeof BotWorkspaceManifestSchema>;

// ============================================================================
// Frontmatter content
// ============================================================================

/**
 * Structured front matter stored in `AGENTS.md`.
 */
export const BotAgentsFrontmatterSchema = z.object({
  name: z.string(),
  description: z.string().default(''),
  type: z.enum(['orchestrator', 'sub-agent', 'worker', 'specialist', 'reviewer']).default('specialist'),
  model: z.string().default('default'),
  provider: z.enum(['openai', 'anthropic', 'google', 'local', 'custom']).default('custom'),
});

export type BotAgentsFrontmatter = z.infer<typeof BotAgentsFrontmatterSchema>;

/**
 * Structured front matter stored in `SOUL.md`.
 */
export const BotSoulFrontmatterSchema = z.object({
  displayName: z.string(),
  handle: z.string().optional(),
  version: z.string().optional(),
  botCategory: z.enum(['research', 'code', 'writing', 'data', 'sales', 'design', 'ops', 'custom']).optional(),
  lifecycle: z.enum(['draft', 'active', 'archived', 'deprecated']).default('draft'),
  accentColor: z.string().optional(),
  groupChatEnabled: z.boolean().default(false),
  defaultPresetId: z.string().optional(),
});

export type BotSoulFrontmatter = z.infer<typeof BotSoulFrontmatterSchema>;

// ============================================================================
// Errors
// ============================================================================

export class BotWorkspaceConflictError extends Error {
  constructor(
    message: string,
    public readonly botId: string,
    public readonly expectedRevision: string,
    public readonly actualRevision: string | null,
  ) {
    super(message);
    this.name = 'BotWorkspaceConflictError';
  }
}

export class BotWorkspaceNotFoundError extends Error {
  constructor(
    message: string,
    public readonly botId: string,
  ) {
    super(message);
    this.name = 'BotWorkspaceNotFoundError';
  }
}
