/**
 * Shared types for the verification subsystem. Extracted from
 * planner.ts/executor.ts, which were deleted as dead runtime code (the
 * Planner/Executor classes that defined these had zero live callers — only
 * these type shapes were actually used, by the verification/* consumers
 * below). Kept here as pure interfaces with zero imports so nothing pulls
 * in unreachable code by depending on these types.
 */

export interface PlanStep {
  id: string;
  toolId: string;
  args: any;
  description: string;
}

export interface Plan {
  sessionId: string;
  steps: PlanStep[];
  exitCriteria: string[];
  goal: string;
}

export interface ExecutionReceipt {
  stepId: string;
  toolId: string;
  success: boolean;
  output: any;
  durationMs: number;
  metadata?: any;
}
