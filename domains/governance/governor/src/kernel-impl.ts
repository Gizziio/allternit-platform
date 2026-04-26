import type {
  AllternitKernel,
  WihItem,
  WihFilters,
  Receipt,
  PreToolUseFunction,
  PostToolUseFunction,
  FileAccessFunction,
  ToolContext,
  FileContext,
  RoutingResult,
} from './types/index.js';

/**
 * In-memory reference implementation of the Allternit kernel contract.
 *
 * Intended for local development, tests, and UI stubs that require
 * a concrete kernel implementation without network dependencies.
 */
export class AllternitKernelImpl implements AllternitKernel {
  readonly version = '0.1.0-dev';

  private wihStore = new Map<string, WihItem>();
  private receiptStore = new Map<string, Receipt>();
  private preToolUse = new Map<string, PreToolUseFunction>();
  private postToolUse = new Map<string, PostToolUseFunction>();
  private fileAccess = new Map<string, FileAccessFunction>();
  private counter = 1;

  private nextWihId(): string {
    return `Allternit-${String(this.counter++).padStart(4, '0')}`;
  }

  private nextReceiptId(): string {
    return `RCPT-${Math.random().toString(36).slice(2, 10)}`;
  }

  async createWih(item: Omit<WihItem, 'id' | 'createdAt' | 'version'>): Promise<WihItem> {
    const now = new Date().toISOString();
    const wih: WihItem = {
      id: this.nextWihId(),
      title: item.title ?? 'Untitled',
      description: item.description,
      status: item.status ?? 'draft',
      priority: item.priority ?? 50,
      blockedBy: item.blockedBy ?? [],
      blocks: item.blocks ?? [],
      assignee: item.assignee,
      phase: item.phase,
      tags: item.tags ?? [],
      estimatedEffort: item.estimatedEffort,
      actualEffort: item.actualEffort,
      receiptRefs: item.receiptRefs ?? [],
      artifacts: item.artifacts ?? [],
      createdAt: now,
      updatedAt: item.updatedAt,
      completedAt: item.completedAt,
      version: '1.0.0',
      routing: item.routing,
    };
    this.wihStore.set(wih.id, wih);
    return wih;
  }

  async getWih(id: string): Promise<WihItem | null> {
    return this.wihStore.get(id) ?? null;
  }

  async updateWih(id: string, updates: Partial<WihItem>): Promise<WihItem> {
    const existing = this.wihStore.get(id);
    if (!existing) throw new Error(`WIH item not found: ${id}`);
    const now = new Date().toISOString();
    const updated: WihItem = {
      ...existing,
      ...updates,
      updatedAt: now,
    };
    if (updates.status === 'complete' && !updated.completedAt) {
      updated.completedAt = now;
    }
    this.wihStore.set(id, updated);
    return updated;
  }

  async listWih(filters?: WihFilters): Promise<WihItem[]> {
    let items = Array.from(this.wihStore.values());
    if (!filters) return items;
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      items = items.filter((item) => statuses.includes(item.status));
    }
    if (filters.assignee) {
      items = items.filter((item) => item.assignee === filters.assignee);
    }
    if (filters.phase) {
      items = items.filter((item) => item.phase === filters.phase);
    }
    if (filters.tags && filters.tags.length > 0) {
      items = items.filter((item) => filters.tags!.every((tag) => item.tags.includes(tag)));
    }
    if (filters.blocked !== undefined) {
      items = items.filter((item) => (filters.blocked ? item.status === 'blocked' : item.status !== 'blocked'));
    }
    return items;
  }

  async createReceipt(receipt: Omit<Receipt, 'id' | 'timestamp'>): Promise<Receipt> {
    const created: Receipt = {
      ...receipt,
      id: this.nextReceiptId(),
      timestamp: new Date().toISOString(),
    };
    this.receiptStore.set(created.id, created);
    return created;
  }

  async getReceipt(id: string): Promise<Receipt | null> {
    return this.receiptStore.get(id) ?? null;
  }

  async verifyReceipt(id: string): Promise<boolean> {
    const receipt = this.receiptStore.get(id);
    if (!receipt) return false;
    return receipt.status === 'complete' && receipt.attestations.length > 0;
  }

  registerPreToolUse(name: string, fn: PreToolUseFunction): void {
    this.preToolUse.set(name, fn);
  }

  registerPostToolUse(name: string, fn: PostToolUseFunction): void {
    this.postToolUse.set(name, fn);
  }

  registerFileAccessCheck(name: string, fn: FileAccessFunction): void {
    this.fileAccess.set(name, fn);
  }

  async routeToolUse(context: ToolContext): Promise<RoutingResult> {
    for (const fn of this.preToolUse.values()) {
      const result = await fn(context, this);
      if (result.decision !== 'allow') return result;
    }
    return { decision: 'allow' };
  }

  async routeFileAccess(context: FileContext): Promise<RoutingResult> {
    for (const fn of this.fileAccess.values()) {
      const result = await fn(context, this);
      if (result.decision !== 'allow') return result;
    }
    return { decision: 'allow' };
  }
}
