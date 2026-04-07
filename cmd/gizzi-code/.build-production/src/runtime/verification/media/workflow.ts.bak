/**
 * Media Review Workflow
 * 
 * Handles review → approve/reject → cleanup phases.
 */

import {
  MediaCaptureManager,
  type CapturedMedia,
  type ReviewDecision,
  type VerificationWithMediaOptions,
} from "./capture";
import { Log } from "@/shared/util/log";

const log = Log.create({ service: "verification-workflow" });

export type ReviewPhase = "capture" | "review" | "decided" | "cleanup" | "complete";

export interface WorkflowState {
  captureId: string;
  phase: ReviewPhase;
  capture: CapturedMedia | null;
  reviewDecision?: ReviewDecision;
  cleanupScheduledAt?: Date;
  cleanupCompletedAt?: Date;
  error?: string;
}

export type WorkflowCallback = (state: WorkflowState) => void | Promise<void>;

export class MediaReviewWorkflow {
  private states = new Map<string, WorkflowState>();
  private callbacks: WorkflowCallback[] = [];
  private cleanupTimers = new Map<string, NodeJS.Timeout>();
  
  constructor(private captureManager: MediaCaptureManager) {}
  
  onStateChange(callback: WorkflowCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) this.callbacks.splice(index, 1);
    };
  }
  
  private async notify(state: WorkflowState): Promise<void> {
    for (const callback of this.callbacks) {
      try { await callback(state); } catch (error) { log.warn("notification callback error", { error }); }
    }
  }
  
  async start(captureId: string, options: VerificationWithMediaOptions): Promise<WorkflowState> {
    const state: WorkflowState = {
      captureId,
      phase: "capture",
      capture: this.captureManager.getCapture(captureId) ?? null,
    };
    this.states.set(captureId, state);
    
    log.info("Workflow started", { captureId });
    await this.notify(state);
    
    if (options.requireReview) {
      this.scheduleAutoCleanup(captureId, options.autoCleanupAfter || 86400);
    } else {
      await this.approve(captureId, { 
        approved: true, 
        notes: "Auto-approved (no review required)",
        timestamp: new Date().toISOString(),
      });
    }
    
    return state;
  }
  
  async approve(captureId: string, decision: Omit<ReviewDecision, "approved"> & { approved: true }): Promise<WorkflowState | null> {
    const state = this.states.get(captureId);
    if (!state || state.phase !== "capture") return null;
    
    const fullDecision: ReviewDecision = { ...decision, approved: true };
    state.reviewDecision = fullDecision;
    state.phase = "decided";
    
    await this.captureManager.reviewCapture(captureId, fullDecision);
    await this.notify(state);
    
    log.info("Capture approved", { captureId, reviewer: decision.reviewer });
    return state;
  }
  
  async reject(captureId: string, decision: Omit<ReviewDecision, "approved"> & { approved: false }): Promise<WorkflowState | null> {
    const state = this.states.get(captureId);
    if (!state || state.phase !== "capture") return null;
    
    const fullDecision: ReviewDecision = { ...decision, approved: false };
    state.reviewDecision = fullDecision;
    state.phase = "decided";
    
    await this.captureManager.reviewCapture(captureId, fullDecision);
    await this.notify(state);
    
    log.info("Capture rejected", { captureId, reviewer: decision.reviewer });
    
    // Cleanup rejected captures immediately
    await this.cleanup(captureId);
    return state;
  }
  
  async cleanup(captureId: string, options?: { keepScreenshots?: boolean; keepVideo?: boolean; keepGif?: boolean }): Promise<WorkflowState | null> {
    const state = this.states.get(captureId);
    if (!state) return null;
    
    state.phase = "cleanup";
    await this.notify(state);
    
    await this.captureManager.cleanup(captureId, options);
    
    state.phase = "complete";
    state.cleanupCompletedAt = new Date();
    await this.notify(state);
    
    // Cancel any scheduled cleanup
    const timer = this.cleanupTimers.get(captureId);
    if (timer) { clearTimeout(timer); this.cleanupTimers.delete(captureId); }
    
    log.info("Workflow complete", { captureId });
    return state;
  }
  
  private scheduleAutoCleanup(captureId: string, delaySeconds: number): void {
    const timer = setTimeout(() => {
      log.info("Auto-cleanup triggered", { captureId });
      this.cleanup(captureId);
    }, delaySeconds * 1000);
    
    this.cleanupTimers.set(captureId, timer);
    
    const state = this.states.get(captureId);
    if (state) {
      state.cleanupScheduledAt = new Date(Date.now() + delaySeconds * 1000);
    }
  }
  
  getState(captureId: string): WorkflowState | undefined {
    return this.states.get(captureId);
  }
  
  getAllStates(): WorkflowState[] {
    return Array.from(this.states.values());
  }
  
  async destroy(): Promise<void> {
    const entries = Array.from(this.cleanupTimers.entries());
    for (const [captureId, timer] of entries) {
      clearTimeout(timer);
      await this.cleanup(captureId);
    }
    this.cleanupTimers.clear();
    this.states.clear();
    this.callbacks = [];
  }
}
