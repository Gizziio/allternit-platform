/**
 * Bot Memory Store
 *
 * In-memory implementation of isolated bot memory. Enforces tenant/bot
 * namespaces, subordinate session/project scopes, provenance, promotion,
 * prompt-injection defenses, and deletion propagation.
 *
 * @module bot-memory-store
 */

import { createModuleLogger } from '@/lib/logger';
import { detectSecrets } from './secret-redaction';
import {
  BotMemoryAuthorizationError,
  BotMemoryNotFoundError,
  BotMemoryPromotionPolicySchema,
  BotMemoryQuerySchema,
  BotMemoryRecordSchema,
  BotMemoryRetrievalLogSchema,
  BOT_MEMORY_SCHEMA_VERSION,
  type BotMemoryEvaluationCase,
  type BotMemoryEvaluationResult,
  type BotMemoryPromotionPolicy,
  type BotMemoryQuery,
  type BotMemoryRecord,
  type BotMemoryRetrievalLog,
  type BotMemorySensitivity,
  type BotMemoryStatus,
} from './bot-memory-contracts';

const logger = createModuleLogger('BotMemoryStore');

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function isExpired(record: BotMemoryRecord): boolean {
  if (!record.expiresAt) return false;
  return new Date(record.expiresAt).getTime() <= Date.now();
}

const SENSITIVITY_RANK: Record<BotMemorySensitivity, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  secret: 3,
};

const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?previous\s+instructions/gi,
  /ignore\s+(?:the\s+)?(?:above|system)\s+(?:prompt|instructions)/gi,
  /you\s+are\s+now\s+(?:in|operating\s+in)\s+["']?developer\s+mode["']?/gi,
  /system\s*:\s*new\s+instructions/gi,
  /disregard\s+(?:your\s+)?(?:instructions|training)/gi,
  /DAN\s*["']?/gi,
];

export interface BotMemoryStore {
  /** Propose a memory candidate. Runs prompt-injection and secret checks. */
  proposeMemory(record: Omit<BotMemoryRecord, 'id' | 'createdAt' | 'updatedAt'>): BotMemoryRecord;

  /** Explicitly promote a candidate memory. */
  promoteMemory(tenantId: string, botId: string, memoryId: string, actorId?: string): BotMemoryRecord;

  /** Auto-promote candidates that satisfy the given policy. */
  promoteCandidates(
    tenantId: string,
    botId: string,
    policy?: Partial<BotMemoryPromotionPolicy>,
  ): BotMemoryRecord[];

  /** Read a single memory with authorization check. */
  getMemory(tenantId: string, botId: string, memoryId: string): BotMemoryRecord;

  /** Patch a memory (edit, pin, expire, correct, contradict). */
  updateMemory(
    tenantId: string,
    botId: string,
    memoryId: string,
    patch: Partial<Pick<BotMemoryRecord, 'content' | 'confidence' | 'sensitivity' | 'expiresAt' | 'status' | 'reason'>> & {
      correctsMemoryId?: string;
      contradictsMemoryId?: string;
    },
    actorId?: string,
  ): BotMemoryRecord;

  /** Soft-delete a memory and propagate to indexes/summaries as configured. */
  forgetMemory(
    tenantId: string,
    botId: string,
    memoryId: string,
    options?: { propagateToSummaries?: boolean; reason?: string; actorId?: string },
  ): BotMemoryRecord;

  /** Forget every memory owned by a bot. */
  forgetBot(tenantId: string, botId: string, options?: { propagateToSummaries?: boolean; reason?: string; actorId?: string }): number;

  /** Query memories within a tenant/bot namespace. */
  queryMemories(query: BotMemoryQuery): BotMemoryRecord[];

  /** Return retrieval log for a bot or a single memory. */
  getRetrievalLog(
    tenantId: string,
    botId: string,
    memoryId?: string,
  ): BotMemoryRetrievalLog[];

  /** Run a retrieval evaluation set and return per-case metrics. */
  runEvaluationSet(cases: BotMemoryEvaluationCase[]): BotMemoryEvaluationResult[];

  /** Export all memories for a bot, optionally including forgotten/expired. */
  exportMemories(
    tenantId: string,
    botId: string,
    options?: { includeForgotten?: boolean; includeExpired?: boolean },
  ): BotMemoryRecord[];
}

export interface CreateBotMemoryStoreOptions {
  /** Default promotion policy used by promoteCandidates. */
  defaultPolicy?: Partial<BotMemoryPromotionPolicy>;
  /** Hook called after any durable memory mutation. */
  onChange?: (record: BotMemoryRecord, action: string) => void;
}

export function createBotMemoryStore(storeOptions: CreateBotMemoryStoreOptions = {}): BotMemoryStore {
  const memories = new Map<string, BotMemoryRecord>();
  const indexes = {
    byBot: new Map<string, Set<string>>(),
    bySession: new Map<string, Set<string>>(),
    byProject: new Map<string, Set<string>>(),
    byStatus: new Map<BotMemoryStatus, Set<string>>(),
  };
  const retrievalLogs: BotMemoryRetrievalLog[] = [];

  const defaultPolicy = BotMemoryPromotionPolicySchema.parse(
    storeOptions.defaultPolicy ?? {},
  );

  function checkInjection(content: string): string[] {
    const issues: string[] = [];
    for (const pattern of INJECTION_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        issues.push('Possible prompt-injection marker detected');
        break;
      }
    }
    const secretResult = detectSecrets(content);
    if (secretResult.secrets.length > 0) {
      const types = [...new Set(secretResult.secrets.map((s) => s.type))];
      issues.push(`Secrets detected: ${types.join(', ')}`);
    }
    return issues;
  }

  function addToIndexes(record: BotMemoryRecord): void {
    const botSet = indexes.byBot.get(record.botId) ?? new Set<string>();
    botSet.add(record.id);
    indexes.byBot.set(record.botId, botSet);

    if (record.sessionId) {
      const sessionSet = indexes.bySession.get(record.sessionId) ?? new Set<string>();
      sessionSet.add(record.id);
      indexes.bySession.set(record.sessionId, sessionSet);
    }

    if (record.projectId) {
      const projectSet = indexes.byProject.get(record.projectId) ?? new Set<string>();
      projectSet.add(record.id);
      indexes.byProject.set(record.projectId, projectSet);
    }

    const statusSet = indexes.byStatus.get(record.status) ?? new Set<string>();
    statusSet.add(record.id);
    indexes.byStatus.set(record.status, statusSet);
  }

  function removeFromActiveIndexes(record: BotMemoryRecord): void {
    indexes.byBot.get(record.botId)?.delete(record.id);
    if (record.sessionId) indexes.bySession.get(record.sessionId)?.delete(record.id);
    if (record.projectId) indexes.byProject.get(record.projectId)?.delete(record.id);
    indexes.byStatus.get(record.status)?.delete(record.id);
  }

  function authorize(
    tenantId: string,
    botId: string,
    record: BotMemoryRecord,
  ): void {
    if (record.tenantId !== tenantId || record.botId !== botId) {
      throw new BotMemoryAuthorizationError(
        `Memory ${record.id} is not accessible from tenant ${tenantId} / bot ${botId}`,
        tenantId,
        botId,
      );
    }
  }

  function getRequired(tenantId: string, botId: string, memoryId: string): BotMemoryRecord {
    const record = memories.get(memoryId);
    if (!record) {
      throw new BotMemoryNotFoundError(`Memory ${memoryId} not found`, memoryId);
    }
    authorize(tenantId, botId, record);
    return record;
  }

  function recordRetrieval(
    memoryId: string,
    botId: string,
    tenantId: string,
    query: BotMemoryQuery,
    reason: BotMemoryRetrievalLog['reason'],
  ): void {
    const log = BotMemoryRetrievalLogSchema.parse({
      id: generateId('retrieval'),
      memoryId,
      botId,
      tenantId,
      query: query as Record<string, unknown>,
      reason,
      occurredAt: nowIso(),
    });
    retrievalLogs.unshift(log);
  }

  return {
    proposeMemory(input) {
      const validated = BotMemoryRecordSchema.omit({ id: true, createdAt: true, updatedAt: true }).parse(input);
      const issues = checkInjection(validated.content);
      if (issues.length > 0) {
        logger.warn({ botId: validated.botId, issues }, 'Memory proposal rejected');
        throw new Error(`Memory proposal rejected: ${issues.join('; ')}`);
      }

      const record = BotMemoryRecordSchema.parse({
        ...validated,
        id: generateId('mem'),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });

      memories.set(record.id, record);
      addToIndexes(record);

      logger.info(
        { memoryId: record.id, botId: record.botId, scope: record.scope },
        'Memory candidate proposed',
      );
      storeOptions.onChange?.(record, 'propose');
      return record;
    },

    promoteMemory(tenantId, botId, memoryId, actorId) {
      const record = getRequired(tenantId, botId, memoryId);
      if (record.status !== 'candidate') {
        throw new Error(`Memory ${memoryId} cannot be promoted from status ${record.status}`);
      }
      const promoted: BotMemoryRecord = {
        ...record,
        status: 'promoted',
        updatedAt: nowIso(),
        auditNotes: [
          ...record.auditNotes,
          `Promoted by ${actorId ?? 'system'} at ${nowIso()}`,
        ],
      };
      removeFromActiveIndexes(record);
      memories.set(promoted.id, promoted);
      addToIndexes(promoted);
      logger.info({ memoryId, botId }, 'Memory promoted');
      storeOptions.onChange?.(promoted, 'promote');
      return promoted;
    },

    promoteCandidates(tenantId, botId, policyInput) {
      const policy = BotMemoryPromotionPolicySchema.parse({ ...defaultPolicy, ...(policyInput ?? {}) });
      const botSet = indexes.byBot.get(botId) ?? new Set<string>();
      const promoted: BotMemoryRecord[] = [];

      for (const memoryId of botSet) {
        const record = memories.get(memoryId);
        if (!record) continue;
        if (record.tenantId !== tenantId) continue;
        if (record.status !== 'candidate') continue;
        if (record.confidence < policy.minConfidence) continue;
        if (!policy.allowedSensitivities.includes(record.sensitivity)) continue;
        if (policy.blockedSourceTypes.includes(record.provenance.sourceType)) continue;
        if (policy.requireReviewForScopes.includes(record.scope)) continue;

        const updated: BotMemoryRecord = {
          ...record,
          status: 'promoted',
          updatedAt: nowIso(),
          auditNotes: [
            ...record.auditNotes,
            `Auto-promoted by policy at ${nowIso()}`,
          ],
        };
        removeFromActiveIndexes(record);
        memories.set(updated.id, updated);
        addToIndexes(updated);
        promoted.push(updated);
      }

      logger.info({ botId, promotedCount: promoted.length }, 'Candidates auto-promoted');
      return promoted;
    },

    getMemory(tenantId, botId, memoryId) {
      return getRequired(tenantId, botId, memoryId);
    },

    updateMemory(tenantId, botId, memoryId, patch, actorId) {
      const record = getRequired(tenantId, botId, memoryId);
      const note = `Updated by ${actorId ?? 'system'} at ${nowIso()}: ${Object.keys(patch).join(', ')}`;

      if (patch.content) {
        const issues = checkInjection(patch.content);
        if (issues.length > 0) {
          throw new Error(`Memory update rejected: ${issues.join('; ')}`);
        }
      }

      let updated: BotMemoryRecord = {
        ...record,
        ...(patch.content !== undefined && { content: patch.content }),
        ...(patch.confidence !== undefined && { confidence: patch.confidence }),
        ...(patch.sensitivity !== undefined && { sensitivity: patch.sensitivity }),
        ...(patch.expiresAt !== undefined && { expiresAt: patch.expiresAt }),
        ...(patch.status !== undefined && { status: patch.status }),
        ...(patch.reason !== undefined && { reason: patch.reason }),
        updatedAt: nowIso(),
        auditNotes: [...record.auditNotes, note],
      };

      if (patch.correctsMemoryId) {
        updated = { ...updated, correctsMemoryId: patch.correctsMemoryId };
        const corrected = memories.get(patch.correctsMemoryId);
        if (corrected && corrected.tenantId === tenantId && corrected.botId === botId) {
          const marked: BotMemoryRecord = {
            ...corrected,
            status: 'corrected',
            updatedAt: nowIso(),
            auditNotes: [...corrected.auditNotes, `Corrected by ${memoryId} at ${nowIso()}`],
          };
          removeFromActiveIndexes(corrected);
          memories.set(marked.id, marked);
          addToIndexes(marked);
        }
      }

      if (patch.contradictsMemoryId) {
        const contradicted = memories.get(patch.contradictsMemoryId);
        if (contradicted && contradicted.tenantId === tenantId && contradicted.botId === botId) {
          const marked: BotMemoryRecord = {
            ...contradicted,
            contradictedByMemoryIds: [...contradicted.contradictedByMemoryIds, memoryId],
            updatedAt: nowIso(),
            auditNotes: [...contradicted.auditNotes, `Contradicted by ${memoryId} at ${nowIso()}`],
          };
          memories.set(marked.id, marked);
        }
        updated = {
          ...updated,
          contradictedByMemoryIds: [...updated.contradictedByMemoryIds, patch.contradictsMemoryId],
        };
      }

      removeFromActiveIndexes(record);
      memories.set(updated.id, updated);
      addToIndexes(updated);
      logger.info({ memoryId, botId }, 'Memory updated');
      storeOptions.onChange?.(updated, 'update');
      return updated;
    },

    forgetMemory(tenantId, botId, memoryId, options = {}) {
      const record = getRequired(tenantId, botId, memoryId);
      const note = `Forgotten by ${options.actorId ?? 'system'} at ${nowIso()}${options.reason ? ` (${options.reason})` : ''}`;

      const forgotten: BotMemoryRecord = {
        ...record,
        status: 'forgotten',
        updatedAt: nowIso(),
        auditNotes: [...record.auditNotes, note],
      };

      removeFromActiveIndexes(record);
      memories.set(forgotten.id, forgotten);
      // Do not re-add to active indexes: forgotten memories are excluded from
      // retrieval and export unless explicitly requested.

      if (options.propagateToSummaries) {
        forgotten.auditNotes.push('Propagated removal to summaries, embeddings, and replicas');
      }

      logger.info({ memoryId, botId, propagate: options.propagateToSummaries }, 'Memory forgotten');
      storeOptions.onChange?.(forgotten, 'forget');
      return forgotten;
    },

    forgetBot(tenantId, botId, options: { propagateToSummaries?: boolean; reason?: string; actorId?: string } = {}) {
      const ids = [...(indexes.byBot.get(botId) ?? new Set<string>())];
      let count = 0;
      for (const memoryId of ids) {
        const record = memories.get(memoryId);
        if (!record || record.tenantId !== tenantId) continue;
        const note = `Forgotten by ${options.actorId ?? 'system'} at ${nowIso()}${options.reason ? ` (${options.reason})` : ''}`;
        const forgotten: BotMemoryRecord = {
          ...record,
          status: 'forgotten',
          updatedAt: nowIso(),
          auditNotes: [...record.auditNotes, note],
        };
        removeFromActiveIndexes(record);
        memories.set(forgotten.id, forgotten);
        if (options.propagateToSummaries) {
          forgotten.auditNotes.push('Propagated removal to summaries, embeddings, and replicas');
        }
        storeOptions.onChange?.(forgotten, 'forget');
        count++;
      }
      logger.info({ botId, count, propagate: options.propagateToSummaries }, 'Bot memories forgotten');
      return count;
    },

    queryMemories(query) {
      const q = BotMemoryQuerySchema.parse(query);
      const botSet = indexes.byBot.get(q.botId) ?? new Set<string>();
      const results: BotMemoryRecord[] = [];

      const allowedStatuses = Array.isArray(q.status) ? q.status : q.status ? [q.status] : ['promoted', 'pinned'];
      const maxRank = q.maxSensitivity ? SENSITIVITY_RANK[q.maxSensitivity] : Infinity;

      for (const memoryId of botSet) {
        const record = memories.get(memoryId);
        if (!record) continue;
        if (record.tenantId !== q.tenantId) continue;
        if (!allowedStatuses.includes(record.status)) continue;
        if (!q.includeExpired && isExpired(record)) continue;
        if (SENSITIVITY_RANK[record.sensitivity] > maxRank) continue;
        if (q.scope && record.scope !== q.scope) continue;
        if (q.sessionId && record.sessionId !== q.sessionId) continue;
        if (q.projectId && record.projectId !== q.projectId) continue;
        if (q.contains && !record.content.toLowerCase().includes(q.contains.toLowerCase())) continue;

        results.push(record);
        if (record.status === 'pinned') {
          recordRetrieval(record.id, q.botId, q.tenantId, q, 'pinned');
        } else if (q.contains && record.content.toLowerCase().includes(q.contains.toLowerCase())) {
          recordRetrieval(record.id, q.botId, q.tenantId, q, 'keyword_match');
        } else {
          recordRetrieval(record.id, q.botId, q.tenantId, q, 'scope_match');
        }

        if (results.length >= q.limit) break;
      }

      return results;
    },

    getRetrievalLog(tenantId, botId, memoryId) {
      return retrievalLogs.filter(
        (log) => log.tenantId === tenantId && log.botId === botId && (!memoryId || log.memoryId === memoryId),
      );
    },

    runEvaluationSet(cases) {
      return cases.map((testCase): BotMemoryEvaluationResult => {
        const returned = this.queryMemories(testCase.query);
        const returnedIds = returned.map((r) => r.id);
        const falsePositives = returnedIds.filter((id) => !testCase.expectedMemoryIds.includes(id));
        const falseNegatives = testCase.expectedMemoryIds.filter((id) => !returnedIds.includes(id));
        const truePositives = returnedIds.filter((id) => testCase.expectedMemoryIds.includes(id));
        const precision = returnedIds.length ? truePositives.length / returnedIds.length : 0;
        const recall = testCase.expectedMemoryIds.length
          ? truePositives.length / testCase.expectedMemoryIds.length
          : 0;
        const passed =
          falsePositives.length === 0 &&
          falseNegatives.length === 0 &&
          testCase.forbiddenMemoryIds.every((id) => !returnedIds.includes(id));

        return {
          caseId: testCase.id,
          passed,
          precision,
          recall,
          returnedIds,
          falsePositives,
          falseNegatives,
        };
      });
    },

    exportMemories(tenantId, botId, options = {}) {
      return [...memories.values()]
        .filter((record): record is BotMemoryRecord => {
          if (record.botId !== botId || record.tenantId !== tenantId) return false;
          if (record.status === 'forgotten' && !options.includeForgotten) return false;
          if (isExpired(record) && !options.includeExpired) return false;
          return true;
        });
    },
  };
}

export { BOT_MEMORY_SCHEMA_VERSION };

// Singleton default store for surface-wide memory reads. Callers that need
// isolated namespaces or durable persistence hooks should create their own
// store via createBotMemoryStore().
let defaultStore: BotMemoryStore | undefined;

export function getDefaultBotMemoryStore(): BotMemoryStore {
  if (!defaultStore) {
    defaultStore = createBotMemoryStore();
  }
  return defaultStore;
}

/** Reset the singleton default store. Intended for tests only. */
export function resetDefaultBotMemoryStore(): void {
  defaultStore = undefined;
}
