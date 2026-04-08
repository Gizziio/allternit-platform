/**
 * @fileoverview DEPRECATED - This file is deprecated and will be removed in v2.0.
 * 
 * Direct kernel communication is no longer supported.
 * All requests must go through the Gateway → API → Services.
 * 
 * MIGRATION GUIDE:
 * 
 * OLD (deprecated):
 *   import { getKernelBridge } from './integration/kernel';
 *   const kernel = await getKernelBridge();
 *   await kernel.createWih({...});
 * 
 * NEW (recommended):
 *   import { api } from '@allternit/platform';
 *   // WIH operations through API
 *   
 * See: MIGRATION_PLAN.md for complete migration guide.
 * @deprecated Use api-client.ts instead
 */

import { createRuntimeBridge, RuntimeBridge } from '@allternit/runtime';
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
} from '@allternit/governor';

// Deprecation warning (silenced for production)
// console.warn('[DEPRECATED] integration/kernel/index.ts is deprecated. Use api-client.ts instead.');

// This is the SINGLE entrypoint for kernel communication
let bridge: RuntimeBridge | null = null;

function createKernelStub(): AllternitKernel {
  const wihStore = new Map<string, WihItem>();
  const receiptStore = new Map<string, Receipt>();
  const preToolUse = new Map<string, PreToolUseFunction>();
  const postToolUse = new Map<string, PostToolUseFunction>();
  const fileAccess = new Map<string, FileAccessFunction>();
  let counter = 1;

  const nextWihId = () => `A2R-${String(counter++).padStart(4, "0")}`;
  const nextReceiptId = () => `RCPT-${Math.random().toString(36).slice(2, 10)}`;

  const routeList = async <TContext>(
    context: TContext,
    routers: Map<string, (ctx: TContext, kernel: AllternitKernel) => Promise<RoutingResult> | RoutingResult>
  ): Promise<RoutingResult> => {
    for (const fn of routers.values()) {
      const result = await fn(context as any, kernel);
      if (result.decision !== "allow") return result;
    }
    return { decision: "allow" };
  };

  const kernel: AllternitKernel = {
    version: "0.1.0-dev",

    async createWih(item: Omit<WihItem, "id" | "createdAt" | "version">): Promise<WihItem> {
      const now = new Date().toISOString();
      const wih: WihItem = {
        id: nextWihId(),
        title: item.title ?? "Untitled",
        description: item.description,
        status: item.status ?? "draft",
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
        version: "1.0.0",
        routing: item.routing,
      };
      wihStore.set(wih.id, wih);
      return wih;
    },

    async getWih(id: string): Promise<WihItem | null> {
      return wihStore.get(id) ?? null;
    },

    async updateWih(id: string, updates: Partial<WihItem>): Promise<WihItem> {
      const existing = wihStore.get(id);
      if (!existing) throw new Error(`WIH item not found: ${id}`);
      const now = new Date().toISOString();
      const updated: WihItem = {
        ...existing,
        ...updates,
        updatedAt: now,
      };
      if (updates.status === "complete" && !updated.completedAt) {
        updated.completedAt = now;
      }
      wihStore.set(id, updated);
      return updated;
    },

    async listWih(filters?: WihFilters): Promise<WihItem[]> {
      let items = Array.from(wihStore.values());
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
        items = items.filter((item) => (filters.blocked ? item.status === "blocked" : item.status !== "blocked"));
      }
      return items;
    },

    async createReceipt(receipt: Omit<Receipt, "id" | "timestamp">): Promise<Receipt> {
      const created: Receipt = {
        ...receipt,
        id: nextReceiptId(),
        timestamp: new Date().toISOString(),
      };
      receiptStore.set(created.id, created);
      return created;
    },

    async getReceipt(id: string): Promise<Receipt | null> {
      return receiptStore.get(id) ?? null;
    },

    async verifyReceipt(id: string): Promise<boolean> {
      const receipt = receiptStore.get(id);
      if (!receipt) return false;
      return receipt.status === "complete" && receipt.attestations.length > 0;
    },

    registerPreToolUse(name: string, fn: PreToolUseFunction): void {
      preToolUse.set(name, fn);
    },

    registerPostToolUse(name: string, fn: PostToolUseFunction): void {
      postToolUse.set(name, fn);
    },

    registerFileAccessCheck(name: string, fn: FileAccessFunction): void {
      fileAccess.set(name, fn);
    },

    async routeToolUse(context: ToolContext): Promise<RoutingResult> {
      return routeList(context, preToolUse);
    },

    async routeFileAccess(context: FileContext): Promise<RoutingResult> {
      return routeList(context, fileAccess);
    },
  };

  return kernel;
}

export async function getKernelBridge(): Promise<RuntimeBridge> {
  if (bridge) return bridge;

  // Initialize kernel with a local stub to avoid runtime dependency on governor impl
  const kernel = createKernelStub();

  bridge = createRuntimeBridge({
    kernel,
    enforceWih: true,
    auditLogging: { enabled: true }
  });

  return bridge;
}

type KernelToolRequest = {
  tool: string;
  arguments?: Record<string, unknown>;
  context?: Record<string, unknown>;
};

export type KernelToolResult = {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
};

const DEFAULT_KERNEL_URL = "http://localhost:3004";

function kernelUrl() {
  return (window as any).__ALLTERNIT_KERNEL_URL__ || DEFAULT_KERNEL_URL;
}

function randomId(): string {
  const cryptoObj = (globalThis as any).crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return `id-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function safeComponent(value: string | undefined, fallback: string): string {
  const candidate = (value || "").trim();
  if (!candidate) return fallback;
  if (/^[A-Za-z0-9_-]+$/.test(candidate)) return candidate;
  const cleaned = candidate.replace(/[^A-Za-z0-9_-]/g, "-");
  return cleaned || fallback;
}

export async function executeKernelTool(
  request: KernelToolRequest,
  actor: string = "ui-user"
): Promise<KernelToolResult> {
  try {
    const ctx = (request.context ?? {}) as Record<string, any>;
    const runId = safeComponent(ctx.run_id, `run-${randomId()}`);
    const workflowId = safeComponent(ctx.workflow_id, `wf-${randomId()}`);
    const nodeId = safeComponent(ctx.node_id, `node-${randomId()}`);
    const wihId = safeComponent(ctx.wih_id, `wih-${randomId()}`);
    const writeScope = ctx.write_scope ?? {
      root: "/.a2r/",
      allowed_globs: [
        `/.a2r/receipts/${runId}/**`,
        `/.a2r/artifacts/${runId}/**`,
      ],
    };
    const payload = {
      input: request.arguments ?? {},
      identity_id: actor,
      session_id: actor,
      tenant_id: ctx.tenant_id,
      run_id: runId,
      workflow_id: workflowId,
      node_id: nodeId,
      wih_id: wihId,
      write_scope: writeScope,
      capsule_run: ctx.capsule_run,
      trace_id: ctx.trace_id,
      idempotency_key: ctx.idempotency_key ?? randomId(),
      retry_count: ctx.retry_count ?? 0,
    };
    const res = await fetch(`${kernelUrl()}/v1/tools/${request.tool}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      return { success: false, error: data?.error || `Kernel error ${res.status}` };
    }
    const output =
      typeof data?.output === "string"
        ? data.output
        : data?.output
        ? JSON.stringify(data.output)
        : "";
    return {
      success: !data?.error,
      output,
      error: data?.error,
      metadata: data?.metadata,
    };
  } catch (error: any) {
    return { success: false, error: error?.message || "Kernel tool execution failed" };
  }
}
