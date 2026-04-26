import { describe, it, expect, beforeEach } from 'vitest';
import {
  prepareSessionInit,
  cleanupSession,
  getSessionContext,
  getActiveSessions,
  _clearActiveSessions,
} from '../src/adapters/session-adapter.js';
import { AllternitKernelImpl } from '@allternit/governor';
import { SessionInitError } from '../src/types.js';

// Mock storage
class MockStorage {
  private wihs = new Map();
  private receipts = new Map();

  async create(item: any) {
    this.wihs.set(item.id, item);
    return item;
  }

  async get(id: string) {
    return this.wihs.get(id) ?? null;
  }

  async update(id: string, updates: any) {
    const existing = this.wihs.get(id);
    if (!existing) throw new Error('Not found');
    const updated = { ...existing, ...updates };
    this.wihs.set(id, updated);
    return updated;
  }

  async list() {
    return Array.from(this.wihs.values());
  }

  async createReceipt(receipt: any) {
    this.receipts.set(receipt.id, receipt);
    return receipt;
  }

  async getReceipt(id: string) {
    return this.receipts.get(id) ?? null;
  }
}

describe('Session Adapter', () => {
  let storage: MockStorage;
  let kernel: AllternitKernelImpl;

  beforeEach(() => {
    storage = new MockStorage();
    kernel = new AllternitKernelImpl(storage);
    _clearActiveSessions();
  });

  describe('prepareSessionInit', () => {
    it('should require WIH when enforceWih is true', async () => {
      await expect(
        prepareSessionInit({
          allternitKernel: kernel,
          enforceWih: true,
        })
      ).rejects.toThrow(SessionInitError);
    });

    it('should create session without WIH when not enforced', async () => {
      const result = await prepareSessionInit({
        allternitKernel: kernel,
        enforceWih: false,
        workspaceRoot: '/test',
      });

      expect(result.success).toBe(true);
      expect(result.wihId).toBe('UNTRACKED');
      expect(result.sessionId).toBeDefined();
    });

    it('should validate WIH exists', async () => {
      await expect(
        prepareSessionInit({
          allternitKernel: kernel,
          enforceWih: true,
          wihId: 'NONEXISTENT-001',
          workspaceRoot: '/test',
        })
      ).rejects.toThrow('not found');
    });

    it('should reject blocked WIH', async () => {
      const wih = await kernel.createWih({
        title: 'Blocked WIH',
        status: 'blocked',
        blockedBy: ['OTHER-001'],
        blocks: [],
        tags: [],
        receiptRefs: [],
        artifacts: [],
        priority: 50,
      });

      await expect(
        prepareSessionInit({
          allternitKernel: kernel,
          enforceWih: true,
          wihId: wih.id,
          workspaceRoot: '/test',
        })
      ).rejects.toThrow('blocked');
    });

    it('should reject complete WIH', async () => {
      const wih = await kernel.createWih({
        title: 'Complete WIH',
        status: 'complete',
        blockedBy: [],
        blocks: [],
        tags: [],
        receiptRefs: [],
        artifacts: [],
        priority: 50,
      });

      await expect(
        prepareSessionInit({
          allternitKernel: kernel,
          enforceWih: true,
          wihId: wih.id,
          workspaceRoot: '/test',
        })
      ).rejects.toThrow('complete');
    });

    it('should check dependencies are resolved', async () => {
      // Create incomplete dependency
      const dep = await kernel.createWih({
        title: 'Dependency',
        status: 'in_progress',
        blockedBy: [],
        blocks: [],
        tags: [],
        receiptRefs: [],
        artifacts: [],
        priority: 50,
      });

      const wih = await kernel.createWih({
        title: 'Dependent WIH',
        status: 'ready',
        blockedBy: [dep.id],
        blocks: [],
        tags: [],
        receiptRefs: [],
        artifacts: [],
        priority: 50,
      });

      await expect(
        prepareSessionInit({
          allternitKernel: kernel,
          enforceWih: true,
          wihId: wih.id,
          workspaceRoot: '/test',
        })
      ).rejects.toThrow('not complete');
    });

    it('should allow session with valid WIH', async () => {
      const wih = await kernel.createWih({
        title: 'Valid WIH',
        status: 'ready',
        blockedBy: [],
        blocks: [],
        tags: [],
        receiptRefs: [],
        artifacts: [],
        priority: 50,
      });

      const result = await prepareSessionInit({
        allternitKernel: kernel,
        enforceWih: true,
        wihId: wih.id,
        workspaceRoot: '/test',
      });

      expect(result.success).toBe(true);
      expect(result.wihId).toBe(wih.id);
      expect(result.sessionId).toBeDefined();

      // WIH should be updated to in_progress
      const updated = await kernel.getWih(wih.id);
      expect(updated?.status).toBe('in_progress');
    });

    it('should use provided instanceId as sessionId', async () => {
      const result = await prepareSessionInit({
        allternitKernel: kernel,
        enforceWih: false,
        instanceId: 'my-custom-session',
        workspaceRoot: '/test',
      });

      expect(result.sessionId).toBe('my-custom-session');
    });
  });

  describe('Session Context', () => {
    it('should track active sessions', async () => {
      const result = await prepareSessionInit({
        allternitKernel: kernel,
        enforceWih: false,
        instanceId: 'test-session-1',
        workspaceRoot: '/test',
      });

      const context = getSessionContext('test-session-1');
      expect(context).not.toBeNull();
      expect(context?.sessionId).toBe('test-session-1');
      expect(context?.wihId).toBe('UNTRACKED');
    });

    it('should list all active sessions', async () => {
      await prepareSessionInit({
        allternitKernel: kernel,
        enforceWih: false,
        instanceId: 'session-1',
        workspaceRoot: '/test',
      });

      await prepareSessionInit({
        allternitKernel: kernel,
        enforceWih: false,
        instanceId: 'session-2',
        workspaceRoot: '/test',
      });

      const sessions = getActiveSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.sessionId)).toContain('session-1');
      expect(sessions.map(s => s.sessionId)).toContain('session-2');
    });

    it('should cleanup session', async () => {
      await prepareSessionInit({
        allternitKernel: kernel,
        enforceWih: false,
        instanceId: 'cleanup-test',
        workspaceRoot: '/test',
      });

      expect(getSessionContext('cleanup-test')).not.toBeNull();

      await cleanupSession('cleanup-test');

      expect(getSessionContext('cleanup-test')).toBeNull();
    });
  });
});
