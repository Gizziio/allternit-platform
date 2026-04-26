/**
 * Allternit Operator Types
 * 
 * Canonical contracts for the Thin Client Operator.
 */

export type OperatorTargetType = "browser" | "electron" | "desktop" | "unknown";

export interface OperatorExecuteRequest {
  requestId: string;
  sessionId: string;
  actor: {
    userId: string;
    tenantId?: string;
    role?: string;
  };
  intent: string;
  mode: "plan_only" | "plan_then_execute" | "execute_direct";
  context: {
    targetType: OperatorTargetType;
    targetApp?: string;
    targetDomain?: string;
    pageTitle?: string;
    url?: string;
    raw?: Record<string, unknown>;
  };
  preferences: {
    preferConnector: boolean;
    allowBrowserAutomation: boolean;
    allowDesktopFallback: boolean;
  };
  policy: {
    requirePrivateModel?: boolean;
    requireApprovalForWrites?: boolean;
  };
}

export interface RunnerPlanStep {
  id: string;
  kind: "inspect" | "navigate" | "create" | "update" | "verify";
  title: string;
  detail: string;
  tool?: string;
  args?: Record<string, unknown>;
}

export interface RunnerPlan {
  planId: string;
  summary: string;
  target: {
    app?: string;
    domain?: string;
    url?: string;
    confidence: number;
  };
  backendCandidate: "connector" | "browser_automation" | "electron_native" | "desktop_fallback";
  risk: "low" | "medium" | "high";
  steps: RunnerPlanStep[];
  expectedArtifacts: Array<{
    type: string;
    name: string;
  }>;
  approvalsRequired: string[];
}

export type OperatorEvent =
  | { type: "planning_started"; requestId: string }
  | { type: "plan_ready"; requestId: string; plan: RunnerPlan }
  | { type: "execution_started"; requestId: string; backend: string }
  | { type: "step_started"; requestId: string; stepId: string; title: string }
  | { type: "step_finished"; requestId: string; stepId: string; status: "ok" | "failed" }
  | { type: "verification_result"; requestId: string; status: "ok" | "partial" | "failed"; detail: string }
  | { type: "receipt_ready"; requestId: string; receiptId: string }
  | { type: "run_failed"; requestId: string; error: string }
  | { type: "run_finished"; requestId: string; status: "success" | "partial" | "failed" };

export interface OperatorReceipt {
  receiptId: string;
  requestId: string;
  actor: {
    userId: string;
    tenantId?: string;
  };
  target: {
    app?: string;
    domain?: string;
    url?: string;
  };
  backend: "connector" | "browser_automation" | "electron_native" | "desktop_fallback";
  planId?: string;
  actions: Array<{
    stepId: string;
    action: string;
    status: "ok" | "failed";
    evidence?: string;
  }>;
  verification: {
    status: "ok" | "partial" | "failed";
    detail: string;
  };
  modelRouting: {
    provider: string;
    model: string;
    local: boolean;
  };
  createdArtifacts: Array<{
    type: string;
    id?: string;
    name?: string;
  }>;
  startedAt: string;
  finishedAt: string;
}
