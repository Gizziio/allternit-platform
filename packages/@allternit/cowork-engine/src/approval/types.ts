export type ApprovalRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ApprovalDecision = 'approved' | 'rejected' | 'timeout';
export type ApprovalResponder = 'user' | 'auto' | 'timeout';

export interface PendingApproval {
  actionId: string;
  sessionId: string;
  riskLevel: ApprovalRiskLevel;
  summary: string;
  details: {
    actionType: string;
    target: string;
    args: Record<string, unknown>;
    consequence: string;
  };
  timeoutMs?: number;
  requestedAt: Date;
}

export interface ApprovalResult {
  actionId: string;
  decision: ApprovalDecision;
  responder: ApprovalResponder;
  respondedAt: Date;
}
