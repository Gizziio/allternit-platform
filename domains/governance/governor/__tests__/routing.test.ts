import { describe, it, expect } from 'vitest';
import {
  preToolUseRouter,
  wihGatedRouter,
  fileAccessRouter,
  readOnlyFileRouter,
  createCompositeRouter,
  DEFAULT_ALLOWED_TOOLS,
  HIGH_RISK_TOOLS,
} from '../src/routing';
import { AllternitKernelImpl, WihItem, WihStorage } from '../src/index';
import { ToolContext, FileContext } from '../src/types';

// Mock storage implementation
class MockStorage implements WihStorage {
  private wihs = new Map<string, WihItem>();
  private receipts = new Map<string, import('../src/types').Receipt>();
  private idCounter = 1;

  async create(item: WihItem): Promise<WihItem> {
    this.wihs.set(item.id, item);
    return item;
  }

  async get(id: string): Promise<WihItem | null> {
    return this.wihs.get(id) ?? null;
  }

  async update(id: string, updates: Partial<WihItem>): Promise<WihItem> {
    const existing = this.wihs.get(id);
    if (!existing) throw new Error('Not found');
    const updated = { ...existing, ...updates };
    this.wihs.set(id, updated);
    return updated;
  }

  async list(): Promise<WihItem[]> {
    return Array.from(this.wihs.values());
  }

  async createReceipt(receipt: import('../src/types').Receipt): Promise<import('../src/types').Receipt> {
    this.receipts.set(receipt.id, receipt);
    return receipt;
  }

  async getReceipt(id: string): Promise<import('../src/types').Receipt | null> {
    return this.receipts.get(id) ?? null;
  }
}

describe('Routing Functions', () => {
  const mockKernel = new AllternitKernelImpl(new MockStorage());

  describe('preToolUseRouter', () => {
    const baseContext: ToolContext = {
      toolName: 'read_file',
      toolParams: { path: '/test.txt' },
      sessionId: 'test-session',
      agentId: 'test-agent',
      workspaceRoot: '/workspace',
    };

    it('should allow tools in default allowlist', () => {
      for (const tool of DEFAULT_ALLOWED_TOOLS) {
        const result = preToolUseRouter(
          { ...baseContext, toolName: tool },
          mockKernel
        );
        expect(result.decision).toBe('allow');
      }
    });

    it('should delegate high-risk tools to law-layer', () => {
      for (const tool of HIGH_RISK_TOOLS) {
        const result = preToolUseRouter(
          { ...baseContext, toolName: tool },
          mockKernel
        );
        expect(result.decision).toBe('delegate');
        expect(result.delegateTo).toBe('law-layer');
      }
    });

    it('should delegate unknown tools to review-queue', () => {
      const result = preToolUseRouter(
        { ...baseContext, toolName: 'unknown_tool' },
        mockKernel
      );
      expect(result.decision).toBe('delegate');
      expect(result.delegateTo).toBe('review-queue');
    });
  });

  describe('wihGatedRouter', () => {
    const baseContext: ToolContext = {
      toolName: 'read_file',
      toolParams: { path: '/test.txt' },
      sessionId: 'test-session',
      agentId: 'test-agent',
      workspaceRoot: '/workspace',
    };

    it('should deny when no WIH is provided', async () => {
      const result = await wihGatedRouter(baseContext, mockKernel);
      expect(result.decision).toBe('deny');
      expect(result.reason).toContain('No active WIH');
    });

    it('should deny when WIH does not exist', async () => {
      const result = await wihGatedRouter(
        { ...baseContext, wihId: 'NONEXISTENT-001' },
        mockKernel
      );
      expect(result.decision).toBe('deny');
      expect(result.reason).toContain('not found');
    });

    it('should deny when WIH is blocked', async () => {
      const wih = await mockKernel.createWih({
        title: 'Test WIH',
        status: 'blocked',
        blockedBy: ['OTHER-001'],
        blocks: [],
        tags: [],
        receiptRefs: [],
        artifacts: [],
        priority: 50,
      });

      const result = await wihGatedRouter(
        { ...baseContext, wihId: wih.id },
        mockKernel
      );
      expect(result.decision).toBe('deny');
      expect(result.reason).toContain('blocked');
    });

    it('should allow when WIH is in progress', async () => {
      const wih = await mockKernel.createWih({
        title: 'Test WIH',
        status: 'in_progress',
        blockedBy: [],
        blocks: [],
        tags: [],
        receiptRefs: [],
        artifacts: [],
        priority: 50,
      });

      const result = await wihGatedRouter(
        { ...baseContext, wihId: wih.id },
        mockKernel
      );
      expect(result.decision).toBe('allow');
    });
  });

  describe('fileAccessRouter', () => {
    const baseContext: FileContext = {
      operation: 'read',
      path: '/workspace/test.txt',
      sessionId: 'test-session',
      agentId: 'test-agent',
      workspaceRoot: '/workspace',
    };

    it('should deny paths with traversal patterns', () => {
      const result = fileAccessRouter(
        { ...baseContext, path: '../../../etc/passwd' },
        mockKernel
      );
      expect(result.decision).toBe('deny');
      expect(result.reason).toContain('traversal');
    });

    it('should delegate protected paths to law-layer', () => {
      const result = fileAccessRouter(
        { ...baseContext, path: '/home/user/.ssh/id_rsa' },
        mockKernel
      );
      expect(result.decision).toBe('delegate');
      expect(result.delegateTo).toBe('law-layer');
    });

    it('should deny paths that escape workspace', () => {
      const result = fileAccessRouter(
        { 
          ...baseContext, 
          path: '/etc/passwd',
          resolvedPath: '/etc/passwd',
          workspaceRoot: '/workspace'
        },
        mockKernel
      );
      expect(result.decision).toBe('deny');
      expect(result.reason).toContain('escapes');
    });

    it('should allow valid paths within workspace', () => {
      const result = fileAccessRouter(
        { 
          ...baseContext, 
          path: 'src/index.ts',
          resolvedPath: '/workspace/src/index.ts',
          workspaceRoot: '/workspace'
        },
        mockKernel
      );
      expect(result.decision).toBe('allow');
    });
  });

  describe('readOnlyFileRouter', () => {
    const baseContext: FileContext = {
      operation: 'read',
      path: '/workspace/test.txt',
      sessionId: 'test-session',
      agentId: 'test-agent',
      workspaceRoot: '/workspace',
    };

    it('should allow read operations', () => {
      const result = readOnlyFileRouter(baseContext, mockKernel);
      expect(result.decision).toBe('allow');
    });

    it('should deny write operations', () => {
      const result = readOnlyFileRouter(
        { ...baseContext, operation: 'write' },
        mockKernel
      );
      expect(result.decision).toBe('deny');
      expect(result.reason).toContain('read-only');
    });

    it('should deny delete operations', () => {
      const result = readOnlyFileRouter(
        { ...baseContext, operation: 'delete' },
        mockKernel
      );
      expect(result.decision).toBe('deny');
    });
  });

  describe('createCompositeRouter', () => {
    it('should allow when all routers allow', async () => {
      const router1: import('../src/types').PreToolUseFunction = () => ({ 
        decision: 'allow' 
      });
      const router2: import('../src/types').PreToolUseFunction = () => ({ 
        decision: 'allow' 
      });
      
      const composite = createCompositeRouter(router1, router2);
      const result = await composite(baseContext, mockKernel);
      
      expect(result.decision).toBe('allow');
    });

    it('should deny when any router denies', async () => {
      const router1: import('../src/types').PreToolUseFunction = () => ({ 
        decision: 'deny',
        reason: 'First router denies'
      });
      const router2: import('../src/types').PreToolUseFunction = () => ({ 
        decision: 'allow' 
      });
      
      const composite = createCompositeRouter(router1, router2);
      const result = await composite(baseContext, mockKernel);
      
      expect(result.decision).toBe('deny');
      expect(result.reason).toBe('First router denies');
    });
  });
});

describe('AllternitKernelImpl', () => {
  let storage: MockStorage;
  let kernel: AllternitKernelImpl;

  beforeEach(() => {
    storage = new MockStorage();
    kernel = new AllternitKernelImpl(storage);
  });

  describe('WIH Operations', () => {
    it('should create WIH with defaults', async () => {
      const wih = await kernel.createWih({
        title: 'Test WIH',
      });

      expect(wih.id).toMatch(/^Allternit-\d{4}$/);
      expect(wih.status).toBe('draft');
      expect(wih.priority).toBe(50);
      expect(wih.version).toBe('1.0.0');
      expect(wih.createdAt).toBeDefined();
    });

    it('should get WIH by id', async () => {
      const created = await kernel.createWih({ title: 'Test' });
      const retrieved = await kernel.getWih(created.id);
      
      expect(retrieved).toEqual(created);
    });

    it('should return null for non-existent WIH', async () => {
      const result = await kernel.getWih('NONEXISTENT');
      expect(result).toBeNull();
    });

    it('should update WIH', async () => {
      const created = await kernel.createWih({ title: 'Test' });
      const updated = await kernel.updateWih(created.id, { 
        status: 'in_progress' 
      });
      
      expect(updated.status).toBe('in_progress');
      expect(updated.updatedAt).toBeDefined();
    });

    it('should throw for non-existent WIH update', async () => {
      await expect(kernel.updateWih('NONEXISTENT', { status: 'complete' }))
        .rejects.toThrow('WIH item not found');
    });
  });

  describe('Receipt Operations', () => {
    it('should create receipt with generated id and timestamp', async () => {
      const receipt = await kernel.createReceipt({
        wihId: 'TEST-001',
        status: 'complete',
        attestations: [{ type: 'manual-sign', value: 'test' }],
        artifacts: [],
      });

      expect(receipt.id).toMatch(/^RCPT-[a-z0-9]{8}$/);
      expect(receipt.timestamp).toBeDefined();
    });

    it('should verify complete receipt with attestations', async () => {
      const receipt = await kernel.createReceipt({
        wihId: 'TEST-001',
        status: 'complete',
        attestations: [{ type: 'git-commit', value: 'abc123' }],
        artifacts: [],
      });

      const verified = await kernel.verifyReceipt(receipt.id);
      expect(verified).toBe(true);
    });

    it('should not verify incomplete receipt', async () => {
      const receipt = await kernel.createReceipt({
        wihId: 'TEST-001',
        status: 'rejected',
        attestations: [{ type: 'manual-sign', value: 'rejected' }],
        artifacts: [],
      });

      const verified = await kernel.verifyReceipt(receipt.id);
      expect(verified).toBe(false);
    });
  });

  describe('Routing', () => {
    it('should register and execute pre-tool-use router', async () => {
      kernel.registerPreToolUse('test', () => ({ decision: 'allow' }));
      
      const result = await kernel.routeToolUse({
        toolName: 'test',
        toolParams: {},
        sessionId: 'test',
        agentId: 'test',
        workspaceRoot: '/workspace',
      });

      expect(result.decision).toBe('allow');
    });

    it('should deny if any router denies', async () => {
      kernel.registerPreToolUse('allow', () => ({ decision: 'allow' }));
      kernel.registerPreToolUse('deny', () => ({ 
        decision: 'deny',
        reason: 'Test denial'
      }));
      
      const result = await kernel.routeToolUse({
        toolName: 'test',
        toolParams: {},
        sessionId: 'test',
        agentId: 'test',
        workspaceRoot: '/workspace',
      });

      expect(result.decision).toBe('deny');
      expect(result.reason).toBe('Test denial');
    });

    it('should register and execute file access router', async () => {
      kernel.registerFileAccessCheck('test', () => ({ decision: 'allow' }));
      
      const result = await kernel.routeFileAccess({
        operation: 'read',
        path: '/test',
        sessionId: 'test',
        agentId: 'test',
      });

      expect(result.decision).toBe('allow');
    });
  });
});
