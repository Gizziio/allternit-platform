import type {
  PendingApproval,
  ApprovalResult,
  ApprovalRiskLevel,
  ApprovalDecision,
} from './types.js';

export interface ApprovalRule {
  actionType?: string | RegExp;
  riskLevel?: ApprovalRiskLevel[];
  decision: 'approve' | 'reject';
  reason?: string;
}

export interface ApprovalGateOptions {
  defaultTimeoutMs?: number;
  autoRules?: ApprovalRule[];
  onRequest?: (approval: PendingApproval) => void;
  onResult?: (result: ApprovalResult) => void;
}

type Resolver = (result: ApprovalResult) => void;

const RISK_ORDER: Record<ApprovalRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export class ApprovalGate {
  private pending = new Map<string, { approval: PendingApproval; resolve: Resolver; timer: ReturnType<typeof setTimeout> }>();
  private autoRules: ApprovalRule[];
  private defaultTimeoutMs: number;
  private onRequest?: (approval: PendingApproval) => void;
  private onResult?: (result: ApprovalResult) => void;

  constructor(opts: ApprovalGateOptions = {}) {
    this.defaultTimeoutMs = opts.defaultTimeoutMs ?? 120_000;
    this.autoRules = opts.autoRules ?? [];
    this.onRequest = opts.onRequest;
    this.onResult = opts.onResult;
  }

  async request(approval: PendingApproval): Promise<ApprovalResult> {
    const auto = this.matchAutoRule(approval);
    if (auto) {
      const result: ApprovalResult = {
        actionId: approval.actionId,
        decision: auto.decision === 'approve' ? 'approved' : 'rejected',
        responder: 'auto',
        respondedAt: new Date(),
      };
      this.onResult?.(result);
      return result;
    }

    return new Promise<ApprovalResult>((resolve) => {
      const timeoutMs = approval.timeoutMs ?? this.defaultTimeoutMs;

      const timer = setTimeout(() => {
        const entry = this.pending.get(approval.actionId);
        if (entry) {
          this.pending.delete(approval.actionId);
          const result: ApprovalResult = {
            actionId: approval.actionId,
            decision: 'timeout',
            responder: 'timeout',
            respondedAt: new Date(),
          };
          this.onResult?.(result);
          resolve(result);
        }
      }, timeoutMs);

      this.pending.set(approval.actionId, { approval, resolve, timer });
      this.onRequest?.(approval);
    });
  }

  respond(actionId: string, decision: 'approved' | 'rejected', userNote?: string): boolean {
    const entry = this.pending.get(actionId);
    if (!entry) return false;

    clearTimeout(entry.timer);
    this.pending.delete(actionId);

    const result: ApprovalResult = {
      actionId,
      decision,
      responder: 'user',
      respondedAt: new Date(),
    };
    this.onResult?.(result);
    entry.resolve(result);
    return true;
  }

  getPending(): PendingApproval[] {
    return [...this.pending.values()].map((e) => e.approval);
  }

  getPendingById(actionId: string): PendingApproval | null {
    return this.pending.get(actionId)?.approval ?? null;
  }

  addRule(rule: ApprovalRule): void {
    this.autoRules.push(rule);
  }

  clearRules(): void {
    this.autoRules = [];
  }

  cancelAll(reason: 'rejected' | 'timeout' = 'rejected'): void {
    for (const [actionId, entry] of this.pending.entries()) {
      clearTimeout(entry.timer);
      this.pending.delete(actionId);
      const result: ApprovalResult = {
        actionId,
        decision: reason,
        responder: 'auto',
        respondedAt: new Date(),
      };
      this.onResult?.(result);
      entry.resolve(result);
    }
  }

  private matchAutoRule(approval: PendingApproval): ApprovalRule | null {
    for (const rule of this.autoRules) {
      const riskMatch =
        !rule.riskLevel || rule.riskLevel.includes(approval.riskLevel);

      const actionMatch = !rule.actionType || (() => {
        const at = approval.details.actionType;
        return rule.actionType instanceof RegExp
          ? rule.actionType.test(at)
          : rule.actionType === at;
      })();

      if (riskMatch && actionMatch) return rule;
    }
    return null;
  }

  static buildDefaultRules(): ApprovalRule[] {
    return [
      { riskLevel: ['low'], decision: 'approve', reason: 'low-risk auto-approve' },
    ];
  }

  static riskScore(level: ApprovalRiskLevel): number {
    return RISK_ORDER[level];
  }
}
