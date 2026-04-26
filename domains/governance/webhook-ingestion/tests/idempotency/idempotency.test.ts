/**
 * Idempotency Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateIdempotencyKey,
  validateIdempotencyKey,
  parseIdempotencyKey,
} from '../src/idempotency/key-generator.js';
import {
  createDeduplicationStore,
  MemoryDeduplicationStore,
} from '../src/idempotency/deduplication-store.js';
import type { WebhookPayload } from '../src/types/webhook.types.js';

describe('Key Generator', () => {
  const basePayload: WebhookPayload = {
    id: 'wh_123',
    source: 'github',
    eventType: 'pull_request.opened',
    timestamp: '2026-03-08T12:00:00.000Z',
    rawPayload: {},
    repository: {
      fullName: 'allternit/platform',
      name: 'platform',
      owner: 'allternit',
      url: 'https://github.com/allternit/platform',
      private: false,
    },
    sender: {
      login: 'alice',
      id: 12345,
      type: 'User',
    },
    pullRequest: {
      number: 42,
      title: 'Add feature',
      state: 'open',
      url: 'https://github.com/allternit/platform/pull/42',
      author: 'alice',
      body: 'PR body',
      labels: ['enhancement'],
    },
  };

  describe('generateIdempotencyKey', () => {
    it('should generate consistent keys for same payload', () => {
      const key1 = generateIdempotencyKey(basePayload);
      const key2 = generateIdempotencyKey(basePayload);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different sources', () => {
      const payload1: WebhookPayload = { ...basePayload, source: 'github' };
      const payload2: WebhookPayload = { ...basePayload, source: 'discord' as any };

      const key1 = generateIdempotencyKey(payload1);
      const key2 = generateIdempotencyKey(payload2);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different event types', () => {
      const payload1: WebhookPayload = { ...basePayload, eventType: 'pull_request.opened' };
      const payload2: WebhookPayload = { ...basePayload, eventType: 'pull_request.closed' };

      const key1 = generateIdempotencyKey(payload1);
      const key2 = generateIdempotencyKey(payload2);

      expect(key1).not.toBe(key2);
    });

    it('should include source prefix', () => {
      const key = generateIdempotencyKey(basePayload);

      expect(key).toMatch(/^gh_[a-f0-9]{16}$/);
    });

    it('should respect custom options', () => {
      const key = generateIdempotencyKey(basePayload, {
        includeSource: false,
        includeActor: false,
      });

      // Key should still be valid but different
      expect(key).toMatch(/^[a-z]{2}_[a-f0-9]{16}$/);
    });
  });

  describe('validateIdempotencyKey', () => {
    it('should validate correct format', () => {
      expect(validateIdempotencyKey('gh_abc123def456')).toBe(true);
      expect(validateIdempotencyKey('dc_1234567890abcdef')).toBe(true);
    });

    it('should reject invalid format', () => {
      expect(validateIdempotencyKey('invalid')).toBe(false);
      expect(validateIdempotencyKey('gh_')).toBe(false);
      expect(validateIdempotencyKey('_abc123')).toBe(false);
    });
  });

  describe('parseIdempotencyKey', () => {
    it('should parse valid key', () => {
      const result = parseIdempotencyKey('gh_abc123def456');

      expect(result).toEqual({
        prefix: 'gh',
        hash: 'abc123def456',
      });
    });

    it('should return null for invalid key', () => {
      const result = parseIdempotencyKey('invalid');

      expect(result).toBeNull();
    });
  });
});

describe('Deduplication Store', () => {
  let store: MemoryDeduplicationStore;

  beforeEach(() => {
    store = new MemoryDeduplicationStore({
      backend: 'memory',
      defaultTtlSeconds: 3600,
      cleanupIntervalSeconds: 300,
    });
  });

  describe('check', () => {
    it('should return not duplicate for unknown key', async () => {
      const result = await store.check('unknown-key');

      expect(result.isDuplicate).toBe(false);
      expect(result.recommendation).toBe('process');
    });

    it('should return duplicate for existing key', async () => {
      await store.record({
        idempotencyKey: 'test-key',
        source: 'github',
        eventType: 'pull_request.opened',
      });

      const result = await store.check('test-key');

      expect(result.isDuplicate).toBe(true);
      expect(result.entry).toBeDefined();
    });

    it('should mark as not duplicate if expired', async () => {
      const expiresAt = new Date(Date.now() - 1000).toISOString(); // Expired 1 second ago

      await store.record({
        idempotencyKey: 'expired-key',
        source: 'github',
        eventType: 'pull_request.opened',
      });

      // Manually expire
      const entry = await store.get('expired-key');
      if (entry) {
        await store.update('expired-key', { expiresAt, status: 'expired' });
      }

      const result = await store.check('expired-key');

      expect(result.isDuplicate).toBe(false);
      expect(result.recommendation).toBe('process');
    });
  });

  describe('record', () => {
    it('should record new entry', async () => {
      await store.record({
        idempotencyKey: 'new-key',
        source: 'github',
        eventType: 'pull_request.opened',
      });

      const entry = await store.get('new-key');

      expect(entry).toBeDefined();
      expect(entry?.status).toBe('pending');
      expect(entry?.occurrenceCount).toBe(1);
    });
  });

  describe('markProcessed', () => {
    it('should mark entry as processed', async () => {
      await store.record({
        idempotencyKey: 'process-key',
        source: 'github',
        eventType: 'pull_request.opened',
      });

      await store.markProcessed('process-key', 'evt_123');

      const entry = await store.get('process-key');

      expect(entry?.status).toBe('processed');
      expect(entry?.eventId).toBe('evt_123');
    });
  });

  describe('getBySource', () => {
    it('should return entries for source', async () => {
      await store.record({
        idempotencyKey: 'key-1',
        source: 'github',
        eventType: 'pull_request.opened',
      });

      await store.record({
        idempotencyKey: 'key-2',
        source: 'github',
        eventType: 'issues.opened',
      });

      await store.record({
        idempotencyKey: 'key-3',
        source: 'discord',
        eventType: 'message.create',
      });

      const entries = await store.getBySource('github');

      expect(entries).toHaveLength(2);
      expect(entries.map(e => e.idempotencyKey)).toEqual(
        expect.arrayContaining(['key-1', 'key-2'])
      );
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      await store.record({
        idempotencyKey: 'key-1',
        source: 'github',
        eventType: 'pull_request.opened',
      });

      await store.record({
        idempotencyKey: 'key-2',
        source: 'discord',
        eventType: 'message.create',
      });

      const stats = await store.getStats();

      expect(stats.total).toBe(2);
      expect(stats.byStatus.pending).toBe(2);
      expect(stats.bySource.github).toBe(1);
      expect(stats.bySource.discord).toBe(1);
    });
  });

  describe('cleanupExpired', () => {
    it('should remove expired entries', async () => {
      const expiresAt = new Date(Date.now() - 1000).toISOString();

      await store.record({
        idempotencyKey: 'expired-key',
        source: 'github',
        eventType: 'pull_request.opened',
      });

      // Manually expire
      await store.update('expired-key', { expiresAt });

      const removed = await store.cleanupExpired();

      expect(removed).toBe(1);

      const entry = await store.get('expired-key');
      expect(entry).toBeNull();
    });
  });
});

describe('createDeduplicationStore', () => {
  it('should create memory store', () => {
    const store = createDeduplicationStore({
      backend: 'memory',
      defaultTtlSeconds: 3600,
      cleanupIntervalSeconds: 300,
    });

    expect(store).toBeInstanceOf(MemoryDeduplicationStore);
  });

  it('should throw for unsupported backend', () => {
    expect(() => {
      createDeduplicationStore({
        backend: 'redis' as any,
        defaultTtlSeconds: 3600,
        cleanupIntervalSeconds: 300,
      });
    }).toThrow('not yet implemented');
  });
});
