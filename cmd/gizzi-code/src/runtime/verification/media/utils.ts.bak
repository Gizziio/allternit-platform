/**
 * Media Capture Utilities
 * 
 * Convenience functions for common capture scenarios.
 */

import { MediaCaptureManager, type MediaCaptureOptions, type CapturedMedia } from "./capture";
import { MediaReviewWorkflow, type WorkflowState } from "./workflow";

export interface CaptureDuringVerificationOptions {
  sessionId: string;
  verificationId: string;
  captureScreenshots?: boolean;
  captureVideo?: boolean;
  screenshotInterval?: number;
  maxDuration?: number;
}

export async function captureVerificationMedia(
  manager: MediaCaptureManager,
  options: CaptureDuringVerificationOptions,
  durationMs?: number
): Promise<{ capture: CapturedMedia; stop: () => Promise<void> }> {
  const captureOptions: MediaCaptureOptions = {
    sessionId: options.sessionId,
    verificationId: options.verificationId,
    screenshots: options.captureScreenshots ?? true,
    video: options.captureVideo ?? false,
    screenshotInterval: options.screenshotInterval || 1000,
    maxDuration: options.maxDuration || 60,
  };
  
  const capture = await manager.startCapture(captureOptions);
  
  const stop = async (): Promise<void> => {
    await manager.stopCapture(capture.id);
  };
  
  // Auto-stop after duration if specified
  if (durationMs) {
    setTimeout(() => stop(), durationMs);
  }
  
  return { capture, stop };
}

export interface CompleteWorkflowResult {
  state: WorkflowState;
  waitForDecision: () => Promise<WorkflowState>;
  approve: (reviewer: string, notes?: string) => Promise<WorkflowState>;
  reject: (reviewer: string, notes?: string) => Promise<WorkflowState>;
}

export async function runCompleteWorkflow(
  workflow: MediaReviewWorkflow,
  captureId: string,
  requireReview: boolean = true,
  autoCleanupAfter: number = 3600
): Promise<CompleteWorkflowResult> {
  await workflow.start(captureId, { requireReview, autoCleanupAfter });
  
  const state = workflow.getState(captureId)!;
  
  return {
    state,
    waitForDecision: () => waitForDecision(workflow, captureId),
    approve: (reviewer: string, notes?: string) => 
      workflow.approve(captureId, { approved: true, reviewer, notes, timestamp: new Date().toISOString() })
        .then(s => s!),
    reject: (reviewer: string, notes?: string) => 
      workflow.reject(captureId, { approved: false, reviewer, notes, timestamp: new Date().toISOString() })
        .then(s => s!),
  };
}

async function waitForDecision(workflow: MediaReviewWorkflow, captureId: string): Promise<WorkflowState> {
  return new Promise((resolve) => {
    const check = () => {
      const state = workflow.getState(captureId);
      if (state?.phase === "decided" || state?.phase === "complete") {
        resolve(state);
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}
