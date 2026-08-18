/**
 * Bot Workspace Store
 *
 * In-memory canonical workspace store with revision hashes, compare-and-swap
 * conflict detection, audit history, and rollback. A production backend will
 * replace this with transactional file/ledger storage; the contract and safety
 * semantics are the same.
 *
 * @module bot-workspace-store
 */

import { createModuleLogger } from '@/lib/logger';
import {
  BOT_WORKSPACE_FILES,
  BOT_WORKSPACE_SCHEMA_VERSION,
  BOT_WORKSPACE_GENERATOR_VERSION,
  BotWorkspaceAuditEntrySchema,
  BotWorkspaceSnapshotSchema,
  BotWorkspaceConflictError,
  BotWorkspaceNotFoundError,
  type BotWorkspaceAuditAction,
  type BotWorkspaceAuditEntry,
  type BotWorkspaceSnapshot,
} from './bot-workspace-contracts';
import {
  buildWorkspaceManifest,
  computeWorkspaceRevision,
  deserializeBotWorkspace,
  invalidateBotWorkspaceCache,
  serializeBotWorkspace,
  type WorkspaceFileMap,
} from './bot-workspace-serializer';
import type { Bot } from './orpc-contracts';

const logger = createModuleLogger('BotWorkspaceStore');

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ============================================================================
// Store interface
// ============================================================================

export interface BotWorkspaceStore {
  /** Load the latest workspace snapshot for a bot, or null if none exists. */
  loadWorkspace(botId: string): Promise<BotWorkspaceSnapshot | null>;

  /**
   * Write a workspace file map.
   *
   * If `expectedRevision` is provided and the current revision does not match,
   * a `BotWorkspaceConflictError` is thrown.
   */
  writeWorkspace(
    botId: string,
    files: WorkspaceFileMap,
    actorId?: string,
    expectedRevision?: string,
  ): Promise<BotWorkspaceSnapshot>;

  /**
   * Roll a bot's workspace back to a previous revision.
   */
  rollbackWorkspace(
    botId: string,
    targetRevision: string,
    actorId?: string,
  ): Promise<BotWorkspaceSnapshot>;

  /**
   * Return the audit history for a bot, newest first.
   */
  getAuditHistory(botId: string): BotWorkspaceAuditEntry[];

  /**
   * Read the canonical `Bot` representation from the latest workspace.
   */
  loadBot(botId: string): Promise<Bot | null>;
}

// ============================================================================
// In-memory implementation
// ============================================================================

export interface CreateBotWorkspaceStoreOptions {
  /** Optional hook called after a workspace is successfully accepted. */
  onChange?: (botId: string, snapshot: BotWorkspaceSnapshot) => void;
}

/**
 * Create an in-memory bot workspace store.
 *
 * Snapshots and audit logs are kept in memory. This is suitable for tests and
 * for the client-side canonical contract; persistence is provided by the
 * caller or by a future backend adapter.
 */
export function createBotWorkspaceStore(options: CreateBotWorkspaceStoreOptions = {}): BotWorkspaceStore {
  /** Latest snapshot per bot. */
  const snapshots = new Map<string, BotWorkspaceSnapshot>();
  /** All retained snapshots per bot, keyed by revision. */
  const revisions = new Map<string, Map<string, BotWorkspaceSnapshot>>();
  const history = new Map<string, BotWorkspaceAuditEntry[]>();

  function record(
    botId: string,
    action: BotWorkspaceAuditAction,
    previousRevision: string | null,
    newRevision: string,
    actorId?: string,
    metadata?: Record<string, unknown>,
  ): void {
    const entry: BotWorkspaceAuditEntry = BotWorkspaceAuditEntrySchema.parse({
      id: generateId('audit'),
      botId,
      action,
      previousRevision,
      newRevision,
      actorId,
      occurredAt: new Date().toISOString(),
      metadata,
    });

    const list = history.get(botId) ?? [];
    list.unshift(entry);
    history.set(botId, list);
  }

  async function buildSnapshot(botId: string, files: WorkspaceFileMap): Promise<BotWorkspaceSnapshot> {
    const revision = await computeWorkspaceRevision(files);
    const now = new Date().toISOString();

    const allFiles = { ...files };
    const { manifest } = await buildWorkspaceManifest(botId, allFiles);
    allFiles[BOT_WORKSPACE_FILES.manifest] = manifest;

    const finalRevision = await computeWorkspaceRevision(allFiles);

    return BotWorkspaceSnapshotSchema.parse({
      botId,
      revision: finalRevision,
      schemaVersion: BOT_WORKSPACE_SCHEMA_VERSION,
      generatorVersion: BOT_WORKSPACE_GENERATOR_VERSION,
      files: Object.entries(allFiles).map(([path, content]) => ({ path, content })),
      createdAt: now,
      updatedAt: now,
    });
  }

  return {
    async loadWorkspace(botId) {
      return snapshots.get(botId) ?? null;
    },

    async writeWorkspace(botId, files, actorId, expectedRevision) {
      const current = snapshots.get(botId) ?? null;

      if (expectedRevision !== undefined) {
        const actual = current?.revision ?? null;
        if (actual !== expectedRevision) {
          throw new BotWorkspaceConflictError(
            `Workspace conflict for ${botId}: expected revision ${expectedRevision}, found ${actual}`,
            botId,
            expectedRevision,
            actual,
          );
        }
      }

      const snapshot = await buildSnapshot(botId, files);
      snapshots.set(botId, snapshot);

      const botRevisions = revisions.get(botId) ?? new Map<string, BotWorkspaceSnapshot>();
      botRevisions.set(snapshot.revision, snapshot);
      revisions.set(botId, botRevisions);

      record(
        botId,
        'write',
        current?.revision ?? null,
        snapshot.revision,
        actorId,
        { fileCount: snapshot.files.length },
      );

      invalidateBotWorkspaceCache(botId);
      options.onChange?.(botId, snapshot);

      logger.info(
        { botId, revision: snapshot.revision, actorId },
        'Bot workspace written',
      );

      return snapshot;
    },

    async rollbackWorkspace(botId, targetRevision, actorId) {
      const current = snapshots.get(botId) ?? null;
      if (!current) {
        throw new BotWorkspaceNotFoundError(`No workspace for bot ${botId}`, botId);
      }

      if (current.revision === targetRevision) {
        return current;
      }

      const audit = history.get(botId) ?? [];
      const targetEntry = audit.find((e) => e.newRevision === targetRevision);
      if (!targetEntry) {
        throw new BotWorkspaceNotFoundError(
          `Revision ${targetRevision} not found in audit history for bot ${botId}`,
          botId,
        );
      }

      const botRevisions = revisions.get(botId);
      const targetSnapshot = botRevisions?.get(targetRevision);
      if (!targetSnapshot) {
        throw new BotWorkspaceNotFoundError(
          `Snapshot for revision ${targetRevision} is no longer available for bot ${botId}`,
          botId,
        );
      }

      snapshots.set(botId, targetSnapshot);
      record(
        botId,
        'rollback',
        current.revision,
        targetSnapshot.revision,
        actorId,
        { fileCount: targetSnapshot.files.length },
      );

      invalidateBotWorkspaceCache(botId);
      options.onChange?.(botId, targetSnapshot);

      logger.info(
        { botId, fromRevision: current.revision, toRevision: targetSnapshot.revision, actorId },
        'Bot workspace rolled back',
      );

      return targetSnapshot;
    },

    getAuditHistory(botId) {
      return [...(history.get(botId) ?? [])];
    },

    async loadBot(botId) {
      const snapshot = snapshots.get(botId);
      if (!snapshot) {
        return null;
      }

      const files: WorkspaceFileMap = {};
      for (const file of snapshot.files) {
        files[file.path] = file.content;
      }

      return deserializeBotWorkspace(files);
    },
  };
}
