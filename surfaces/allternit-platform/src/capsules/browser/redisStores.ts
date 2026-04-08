/**
 * Redis-backed store implementations for browser capsule services.
 *
 * Implements the same interfaces as InMemoryEnvironmentStore,
 * InMemoryPolicyStore, and InMemoryReceiptStore so the singleton
 * factories can swap them in transparently.
 *
 * Key layout:
 *   browser:env:target:{id}          → JSON EnvironmentTarget
 *   browser:env:targets              → Set  of target IDs
 *   browser:env:config               → JSON EnvironmentConfig
 *
 *   browser:policy:allow:{id}        → JSON HostAllowlistEntry
 *   browser:policy:allowlist         → Set  of entry IDs
 *   browser:policy:config            → JSON PolicyConfig
 *
 *   browser:receipt:{runId}:{actId}  → JSON BrowserReceipt   TTL 30d
 *   browser:receipt:run:{runId}      → Set  of actionIds      TTL 30d
 *   browser:receipt:wih:{wihId}      → Set  of "runId:actId"  TTL 30d
 */

import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import type {
  EnvironmentStore,
  EnvironmentTarget,
  EnvironmentConfig,
  EnvironmentStatus,
} from './environmentService';
import type {
  PolicyStore,
  HostAllowlistEntry,
  PolicyConfig,
} from './policyService';
import type { ReceiptStore, ReceiptQueryParams, ReceiptQueryResult } from './receiptService';
import type { BrowserReceipt } from './browserAgent.types';

const RECEIPT_TTL = 30 * 86_400; // 30 days

// ─── Environment ──────────────────────────────────────────────────────────────

export class RedisEnvironmentStore implements EnvironmentStore {
  constructor(private r: Redis) {}

  async getTargets(): Promise<EnvironmentTarget[]> {
    const ids = await this.r.smembers('browser:env:targets');
    if (!ids.length) return [];
    const raws = await Promise.all(ids.map((id) => this.r.get(`browser:env:target:${id}`)));
    return raws.flatMap((raw) => {
      if (!raw) return [];
      try { return [JSON.parse(raw) as EnvironmentTarget]; } catch { return []; }
    });
  }

  async getTarget(id: string): Promise<EnvironmentTarget | null> {
    const raw = await this.r.get(`browser:env:target:${id}`);
    if (!raw) return null;
    try { return JSON.parse(raw) as EnvironmentTarget; } catch { return null; }
  }

  async addTarget(target: Omit<EnvironmentTarget, 'id' | 'createdAt' | 'updatedAt'>): Promise<EnvironmentTarget> {
    const t: EnvironmentTarget = {
      ...target,
      id: 'env_' + uuidv4().slice(0, 8),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await Promise.all([
      this.r.set(`browser:env:target:${t.id}`, JSON.stringify(t)),
      this.r.sadd('browser:env:targets', t.id),
    ]);
    return t;
  }

  async updateTarget(id: string, updates: Partial<EnvironmentTarget>): Promise<void> {
    const existing = await this.getTarget(id);
    if (!existing) throw new Error(`Target ${id} not found`);
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await this.r.set(`browser:env:target:${id}`, JSON.stringify(updated));
  }

  async removeTarget(id: string): Promise<void> {
    await Promise.all([
      this.r.del(`browser:env:target:${id}`),
      this.r.srem('browser:env:targets', id),
    ]);
  }

  async getConfig(): Promise<EnvironmentConfig> {
    const raw = await this.r.get('browser:env:config');
    if (raw) { try { return JSON.parse(raw) as EnvironmentConfig; } catch { /* fall through */ } }
    return { currentEnvironment: 'cloud', autoSwitch: false, fallbackEnvironment: 'cloud' };
  }

  async setConfig(config: EnvironmentConfig): Promise<void> {
    await this.r.set('browser:env:config', JSON.stringify(config));
  }

  async updateStatus(id: string, status: EnvironmentStatus, metrics?: { cpuUsage?: number; memoryUsage?: number }): Promise<void> {
    await this.updateTarget(id, {
      status,
      ...(metrics?.cpuUsage !== undefined && { cpuUsage: metrics.cpuUsage }),
      ...(metrics?.memoryUsage !== undefined && { memoryUsage: metrics.memoryUsage }),
    });
  }
}

// ─── Policy ───────────────────────────────────────────────────────────────────

const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  defaultRiskTierLimit: 2,
  requireConfirmationForTier3: true,
  requireConfirmationForTier4: true,
  secondaryConfirmationForTier4: true,
};

export class RedisPolicyStore implements PolicyStore {
  constructor(private r: Redis) {}

  async getAllowlist(): Promise<HostAllowlistEntry[]> {
    const ids = await this.r.smembers('browser:policy:allowlist');
    if (!ids.length) return [];
    const raws = await Promise.all(ids.map((id) => this.r.get(`browser:policy:allow:${id}`)));
    return raws.flatMap((raw) => {
      if (!raw) return [];
      try { return [JSON.parse(raw) as HostAllowlistEntry]; } catch { return []; }
    });
  }

  async addToAllowlist(entry: Omit<HostAllowlistEntry, 'id' | 'addedAt'>): Promise<HostAllowlistEntry> {
    const e: HostAllowlistEntry = {
      ...entry,
      id: 'allow_' + uuidv4().slice(0, 8),
      addedAt: new Date().toISOString(),
    };
    await Promise.all([
      this.r.set(`browser:policy:allow:${e.id}`, JSON.stringify(e)),
      this.r.sadd('browser:policy:allowlist', e.id),
    ]);
    return e;
  }

  async removeFromAllowlist(id: string): Promise<void> {
    await Promise.all([
      this.r.del(`browser:policy:allow:${id}`),
      this.r.srem('browser:policy:allowlist', id),
    ]);
  }

  async getConfig(): Promise<PolicyConfig> {
    const raw = await this.r.get('browser:policy:config');
    if (raw) { try { return JSON.parse(raw) as PolicyConfig; } catch { /* fall through */ } }
    return { ...DEFAULT_POLICY_CONFIG };
  }

  async updateConfig(config: Partial<PolicyConfig>): Promise<void> {
    const current = await this.getConfig();
    await this.r.set('browser:policy:config', JSON.stringify({ ...current, ...config }));
  }
}

// ─── Receipt ──────────────────────────────────────────────────────────────────

export class RedisReceiptStore implements ReceiptStore {
  constructor(private r: Redis) {}

  private key(receipt: BrowserReceipt) {
    return `browser:receipt:${receipt.runId}:${receipt.actionId}`;
  }

  async saveReceipt(receipt: BrowserReceipt): Promise<void> {
    const k = this.key(receipt);
    await Promise.all([
      this.r.set(k, JSON.stringify(receipt), 'EX', RECEIPT_TTL),
      this.r.sadd(`browser:receipt:run:${receipt.runId}`, receipt.actionId),
      this.r.expire(`browser:receipt:run:${receipt.runId}`, RECEIPT_TTL),
      // Index by wihId if present in trace
      ...receipt.trace
        .filter((e) => e.data?.wihId)
        .map((e) => this.r.sadd(`browser:receipt:wih:${e.data!.wihId}`, `${receipt.runId}:${receipt.actionId}`)),
    ]);
  }

  async getReceiptById(receiptId: string): Promise<BrowserReceipt | null> {
    const raw = await this.r.get(`browser:receipt:${receiptId}`);
    if (!raw) return null;
    try { return JSON.parse(raw) as BrowserReceipt; } catch { return null; }
  }

  async getReceiptsByRunId(runId: string): Promise<BrowserReceipt[]> {
    return this._fetchByRunId(runId);
  }

  async getReceiptsByWihId(wihId: string): Promise<BrowserReceipt[]> {
    const keys = await this.r.smembers(`browser:receipt:wih:${wihId}`);
    return this._fetchMany(keys.map((k) => `browser:receipt:${k}`));
  }

  async getReceiptsByKind(kind: string): Promise<BrowserReceipt[]> {
    // No kind index — requires filtering fetched receipts
    // This is an infrequent/debug query; callers should pass runId when possible
    return [];
  }

  async getReceiptsByCorrelationId(correlationId: string): Promise<BrowserReceipt[]> {
    return [];
  }

  async queryReceipts(params: ReceiptQueryParams): Promise<ReceiptQueryResult> {
    let receipts: BrowserReceipt[] = [];

    if (params.runId) {
      receipts = await this._fetchByRunId(params.runId);
    } else if (params.wihId) {
      receipts = await this.getReceiptsByWihId(params.wihId);
    }

    // Client-side filters
    if (params.status) receipts = receipts.filter((r) => r.status === params.status);
    if (params.type) receipts = receipts.filter((r) => r.trace.some((e) => e.type === params.type));
    if (params.correlationId) receipts = receipts.filter((r) => r.trace.some((e) => e.data?.correlationId === params.correlationId));
    if (params.startTime) receipts = receipts.filter((r) => r.startedAt >= params.startTime!);
    if (params.endTime) receipts = receipts.filter((r) => r.endedAt <= params.endTime!);

    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    const start = (page - 1) * pageSize;
    const paginated = receipts.slice(start, start + pageSize);

    return { receipts: paginated, total: receipts.length, page, pageSize, hasMore: start + pageSize < receipts.length };
  }

  async clear(): Promise<void> {
    // No-op for Redis (keys expire naturally)
  }

  private async _fetchByRunId(runId: string): Promise<BrowserReceipt[]> {
    const actionIds = await this.r.smembers(`browser:receipt:run:${runId}`);
    return this._fetchMany(actionIds.map((aid) => `browser:receipt:${runId}:${aid}`));
  }

  private async _fetchMany(keys: string[]): Promise<BrowserReceipt[]> {
    if (!keys.length) return [];
    const raws = await Promise.all(keys.map((k) => this.r.get(k)));
    return raws.flatMap((raw) => {
      if (!raw) return [];
      try { return [JSON.parse(raw) as BrowserReceipt]; } catch { return []; }
    });
  }
}
