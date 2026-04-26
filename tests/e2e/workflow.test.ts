/**
 * End-to-End Workflow Tests
 * 
 * Complete user workflows from shell initialization to task completion.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createShell, type ShellConfig } from '@allternit/shell';
import { AllternitKernelImpl } from '@allternit/governor';
import type { WihStorage, WihItem, Receipt } from '@allternit/governor';

// E2E test storage
class E2EStorage implements WihStorage {
  private wihs = new Map<string, WihItem>();
  private receipts = new Map<string, Receipt>();
  private idCounters = { wih: 1, receipt: 1 };

  async create(item: WihItem): Promise<WihItem> {
    const id = `E2E-${String(this.idCounters.wih++).padStart(4, '0')}`;
    const newItem = { ...item, id };
    this.wihs.set(id, newItem);
    return newItem;
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

  async list(filters?: { status?: string | string[] }): Promise<WihItem[]> {
    let items = Array.from(this.wihs.values());
    
    if (filters?.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      items = items.filter(i => statuses.includes(i.status));
    }
    
    return items;
  }

  async createReceipt(receipt: Receipt): Promise<Receipt> {
    const id = `RCPT-${String(this.idCounters.receipt++).padStart(4, '0')}`;
    const newReceipt = { ...receipt, id };
    this.receipts.set(id, newReceipt);
    return newReceipt;
  }

  async getReceipt(id: string): Promise<Receipt | null> {
    return this.receipts.get(id) ?? null;
  }

  clear(): void {
    this.wihs.clear();
    this.receipts.clear();
    this.idCounters = { wih: 1, receipt: 1 };
  }

  // Test helpers
  getWihCount(): number {
    return this.wihs.size;
  }

  getReceiptCount(): number {
    return this.receipts.size;
  }
}

describe('E2E Workflows', () => {
  let storage: E2EStorage;
  let kernel: AllternitKernelImpl;

  beforeEach(() => {
    storage = new E2EStorage();
    kernel = new AllternitKernelImpl(storage);
  });

  afterEach(async () => {
    storage.clear();
  });

  describe('Developer Workflow', () => {
    it('should complete coding task workflow', async () => {
      // 1. Create coding WIH
      const wih = await kernel.createWih({
        title: 'Implement feature X',
        description: 'Add new API endpoint for user management',
        status: 'ready',
        priority: 80,
        tags: ['coding', 'backend'],
        blockedBy: [],
        blocks: [],
        receiptRefs: [],
        artifacts: [],
      });

      // 2. Start shell with WIH
      const shell = createShell(kernel, {
        wihId: wih.id,
        workspaceRoot: '/project',
        enforceWih: true,
      });

      // 3. Verify WIH loaded
      expect(shell.state.wih.id).toBe(wih.id);
      expect(shell.state.wih.status).toBe('active');

      // 4. Execute commands
      const helpResult = await shell.executeCommand('/help');
      expect(helpResult.success).toBe(true);
      expect(helpResult.message).toContain('Allternit Shell Commands');

      const statusResult = await shell.executeCommand('/status');
      expect(statusResult.success).toBe(true);
      expect(statusResult.message).toContain('Connection');
      expect(statusResult.message).toContain(wih.id);

      // 5. Send messages (would connect to gateway in real scenario)
      await shell.processInput('Hello, I need to implement a new API endpoint');
      expect(shell.state.messages).toHaveLength(1);
      expect(shell.state.messages[0].role).toBe('user');

      // 6. Complete WIH
      const updatedWih = await kernel.updateWih(wih.id, {
        status: 'complete',
        completedAt: new Date().toISOString(),
      });

      expect(updatedWih.status).toBe('complete');

      // 7. Cleanup
      await shell.dispose();
    });

    it('should handle blocked dependencies workflow', async () => {
      // 1. Create dependency WIHs
      const dep1 = await kernel.createWih({
        title: 'Database migration',
        status: 'in_progress',
        priority: 90,
        blockedBy: [],
        blocks: [],
        tags: [],
        receiptRefs: [],
        artifacts: [],
      });

      // 2. Create dependent WIH
      const wih = await kernel.createWih({
        title: 'Implement API using new schema',
        status: 'ready',
        priority: 80,
        blockedBy: [dep1.id],
        blocks: [],
        tags: [],
        receiptRefs: [],
        artifacts: [],
      });

      // 3. Try to start shell with blocked WIH
      const shell = createShell(kernel, {
        wihId: wih.id,
        enforceWih: true,
      });

      // 4. Verify blocked status detected
      expect(shell.state.wih.status).toBe('blocked');

      // 5. Complete dependency
      await kernel.updateWih(dep1.id, {
        status: 'complete',
        completedAt: new Date().toISOString(),
      });

      // 6. Reload WIH
      await shell.loadWih(wih.id);

      // 7. Verify now active
      expect(shell.state.wih.status).toBe('active');

      await shell.dispose();
    });

    it('should handle multiple WIH items', async () => {
      // Create multiple WIHs
      const wih1 = await kernel.createWih({
        title: 'Task 1',
        status: 'ready',
        priority: 50,
        blockedBy: [],
        blocks: [],
        tags: [],
        receiptRefs: [],
        artifacts: [],
      });

      const wih2 = await kernel.createWih({
        title: 'Task 2',
        status: 'in_progress',
        priority: 60,
        blockedBy: [],
        blocks: [],
        tags: [],
        receiptRefs: [],
        artifacts: [],
      });

      // Start shell
      const shell = createShell(kernel, {
        wihId: wih1.id,
        enforceWih: true,
      });

      // List WIHs via command
      const listResult = await shell.executeCommand('/wih list');
      expect(listResult.success).toBe(true);
      expect(listResult.message).toContain(wih1.id);
      expect(listResult.message).toContain(wih2.id);

      // Switch WIH
      const setResult = await shell.executeCommand(`/wih set ${wih2.id}`);
      expect(setResult.success).toBe(true);
      expect(shell.state.wih.id).toBe(wih2.id);

      await shell.dispose();
    });
  });

  describe('Shell Commands', () => {
    it('should execute all built-in commands', async () => {
      const wih = await kernel.createWih({
        title: 'Test WIH',
        status: 'ready',
        blockedBy: [],
        blocks: [],
        tags: [],
        receiptRefs: [],
        artifacts: [],
      });

      const shell = createShell(kernel, { wihId: wih.id });

      // Test theme toggle
      const initialTheme = shell.state.ui.theme;
      await shell.executeCommand('/theme');
      expect(shell.state.ui.theme).not.toBe(initialTheme);

      // Test compact mode
      expect(shell.state.ui.compact).toBe(false);
      await shell.executeCommand('/compact');
      expect(shell.state.ui.compact).toBe(true);

      // Test tools toggle
      expect(shell.state.ui.showToolCalls).toBe(false);
      await shell.executeCommand('/tools');
      expect(shell.state.ui.showToolCalls).toBe(true);

      // Test clear
      shell.addMessage({
        id: 'test-msg',
        role: 'user',
        content: 'test',
        timestamp: new Date().toISOString(),
      });
      expect(shell.state.messages.length).toBeGreaterThan(0);
      await shell.executeCommand('/clear');
      expect(shell.state.messages).toHaveLength(0);

      await shell.dispose();
    });

    it('should handle unknown commands gracefully', async () => {
      const shell = createShell(kernel);

      const result = await shell.executeCommand('/unknown');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown command');

      await shell.dispose();
    });

    it('should handle exit command', async () => {
      const shell = createShell(kernel);

      let exited = false;
      shell.on('exit', () => {
        exited = true;
      });

      const result = await shell.executeCommand('/exit');
      expect(result.exit).toBe(true);
      expect(result.success).toBe(true);

      // Simulate event
      shell.emit('exit');
      expect(exited).toBe(true);

      await shell.dispose();
    });
  });

  describe('Policy Enforcement', () => {
    it('should enforce WIH requirement in strict mode', async () => {
      // Try to create shell without WIH in strict mode
      const shell = createShell(kernel, {
        enforceWih: true,
      });

      // Should still create but show warning
      expect(shell.state.wih.status).toBe('none');

      // Commands that require WIH should fail
      const result = await shell.executeCommand('/wih');
      expect(result.message).toContain('No active WIH');

      await shell.dispose();
    });

    it('should allow operations with valid WIH', async () => {
      const wih = await kernel.createWih({
        title: 'Test WIH',
        status: 'in_progress',
        blockedBy: [],
        blocks: [],
        tags: [],
        receiptRefs: [],
        artifacts: [],
      });

      const shell = createShell(kernel, {
        wihId: wih.id,
        enforceWih: true,
      });

      const result = await shell.executeCommand('/wih');
      expect(result.success).toBe(true);
      expect(result.message).toContain(wih.title);

      await shell.dispose();
    });
  });

  describe('Event Handling', () => {
    it('should emit events correctly', async () => {
      const wih = await kernel.createWih({
        title: 'Test WIH',
        status: 'ready',
        blockedBy: [],
        blocks: [],
        tags: [],
        receiptRefs: [],
        artifacts: [],
      });

      const shell = createShell(kernel, { wihId: wih.id });
      const events: string[] = [];

      shell.on('wih', () => events.push('wih'));
      shell.on('message', () => events.push('message'));

      // Trigger events
      await shell.loadWih(wih.id);
      await shell.processInput('test message');

      expect(events).toContain('wih');
      expect(events).toContain('message');

      await shell.dispose();
    });
  });
});
