/**
 * Server-side ApprovalGate singleton.
 * Lightweight local implementation — no external package dependency.
 * Do NOT import in client ('use client') files.
 */

type RiskLevel = "low" | "medium" | "high" | "critical";

type PendingApproval = {
  actionId: string;
  sessionId: string;
  riskLevel: RiskLevel;
  summary: string;
  details: string;
  timeoutMs: number;
  requestedAt: Date;
  status: "pending" | "approved" | "rejected";
  note?: string;
  resolvedAt?: Date;
};

type ApprovalRule = {
  name: string;
  condition: (approval: PendingApproval) => boolean;
  action: "auto_approve" | "auto_reject" | "require_human";
};

class ApprovalGate {
  private approvals = new Map<string, PendingApproval>();
  private listeners = new Set<(approval: PendingApproval) => void>();
  private rules: ApprovalRule[];
  private defaultTimeoutMs: number;

  constructor(options?: { defaultTimeoutMs?: number; autoRules?: ApprovalRule[] }) {
    this.defaultTimeoutMs = options?.defaultTimeoutMs ?? 120_000;
    this.rules = options?.autoRules ?? ApprovalGate.buildDefaultRules();
  }

  static buildDefaultRules(): ApprovalRule[] {
    return [
      {
        name: "auto-approve-low",
        condition: (a) => a.riskLevel === "low",
        action: "auto_approve",
      },
    ];
  }

  async request(approval: Omit<PendingApproval, "status">): Promise<PendingApproval> {
    const full: PendingApproval = { ...approval, status: "pending" };
    this.approvals.set(full.actionId, full);

    // Check auto-rules
    for (const rule of this.rules) {
      if (rule.condition(full)) {
        if (rule.action === "auto_approve") {
          full.status = "approved";
          full.resolvedAt = new Date();
        } else if (rule.action === "auto_reject") {
          full.status = "rejected";
          full.resolvedAt = new Date();
        }
        break;
      }
    }

    this.listeners.forEach((cb) => cb(full));
    return full;
  }

  respond(actionId: string, decision: "approved" | "rejected", note?: string): boolean {
    const approval = this.approvals.get(actionId);
    if (!approval || approval.status !== "pending") return false;

    approval.status = decision;
    approval.note = note;
    approval.resolvedAt = new Date();
    this.listeners.forEach((cb) => cb(approval));
    return true;
  }

  getPending(): PendingApproval[] {
    return Array.from(this.approvals.values())
      .filter((a) => a.status === "pending")
      .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  }

  get(actionId: string): PendingApproval | undefined {
    return this.approvals.get(actionId);
  }

  onResolve(callback: (approval: PendingApproval) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __coworkApprovalGate: ApprovalGate | undefined;
}

export function getApprovalGate(): ApprovalGate {
  if (!globalThis.__coworkApprovalGate) {
    globalThis.__coworkApprovalGate = new ApprovalGate({
      defaultTimeoutMs: 120_000,
      autoRules: ApprovalGate.buildDefaultRules(),
    });
  }
  return globalThis.__coworkApprovalGate;
}

export function initApprovalGate(): void {
  getApprovalGate();
}

export type { PendingApproval, RiskLevel };
