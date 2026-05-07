/**
 * Server-side ApprovalGate singleton.
 * Initialized at process start via instrumentation.ts; accessed by the approvals API routes.
 * Do NOT import in client ('use client') files.
 */
import { ApprovalGate } from '@allternit/cowork-engine';

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
