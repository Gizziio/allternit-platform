/**
 * Allternit Computer Use Engine - TypeScript SDK Approval Helpers
 * 
 * Utilities for handling approval requests in assist mode.
 */

import {
  ApprovalRequest,
  ApprovalRequestInfo,
  ApprovalResponse,
  ApprovalPredicate,
  EngineEvent,
  EngineEventType,
} from './types';
import { AllternitComputerUseClient } from './client';

/**
 * Pre-built approval predicates for common use cases.
 */
export const ApprovalPredicates = {
  /**
   * Always approve (use with caution!).
   */
  always: (): boolean => true,

  /**
   * Never approve - always deny.
   */
  never: (): boolean => false,

  /**
   * Approve if the action summary matches a pattern.
   * 
   * @param pattern - String pattern or RegExp to match
   */
  matches: (pattern: string | RegExp): ApprovalPredicate => {
    return (request: ApprovalRequestInfo): boolean => {
      const summary = request.action_summary ?? '';
      if (typeof pattern === 'string') {
        return summary.includes(pattern);
      }
      return pattern.test(summary);
    };
  },

  /**
   * Approve if the action is in a whitelist of safe actions.
   * 
   * @param safeActions - Array of safe action keywords
   */
  safeActions: (safeActions: string[]): ApprovalPredicate => {
    return (request: ApprovalRequestInfo): boolean => {
      const summary = (request.action_summary ?? '').toLowerCase();
      return safeActions.some(safe => summary.includes(safe.toLowerCase()));
    };
  },

  /**
   * Deny if the action is in a blacklist of dangerous actions.
   * 
   * @param dangerousActions - Array of dangerous action keywords
   */
  notDangerous: (dangerousActions: string[]): ApprovalPredicate => {
    return (request: ApprovalRequestInfo): boolean => {
      const summary = (request.action_summary ?? '').toLowerCase();
      return !dangerousActions.some(dangerous =>
        summary.includes(dangerous.toLowerCase())
      );
    };
  },

  /**
   * Combine multiple predicates with AND logic.
   * All predicates must return true to approve.
   * 
   * @param predicates - Array of predicates
   */
  all: (...predicates: ApprovalPredicate[]): ApprovalPredicate => {
    return async (request: ApprovalRequestInfo): Promise<boolean> => {
      for (const predicate of predicates) {
        const result = await predicate(request);
        if (!result) return false;
      }
      return true;
    };
  },

  /**
   * Combine multiple predicates with OR logic.
   * At least one predicate must return true to approve.
   * 
   * @param predicates - Array of predicates
   */
  any: (...predicates: ApprovalPredicate[]): ApprovalPredicate => {
    return async (request: ApprovalRequestInfo): Promise<boolean> => {
      for (const predicate of predicates) {
        const result = await predicate(request);
        if (result) return true;
      }
      return false;
    };
  },

  /**
   * Negate a predicate.
   * 
   * @param predicate - Predicate to negate
   */
  not: (predicate: ApprovalPredicate): ApprovalPredicate => {
    return async (request: ApprovalRequestInfo): Promise<boolean> => {
      const result = await predicate(request);
      return !result;
    };
  },

  /**
   * Approve read-only actions only.
   * Denies actions that look like they modify state.
   */
  readOnly: (): ApprovalPredicate => {
    const dangerousPatterns = [
      'delete', 'remove', 'drop', 'truncate', 'clear',
      'update', 'modify', 'change', 'edit', 'write',
      'create', 'insert', 'add', 'new',
      'execute', 'run', 'launch', 'start',
    ];
    return (request: ApprovalRequestInfo): boolean => {
      const summary = (request.action_summary ?? '').toLowerCase();
      return !dangerousPatterns.some(pattern => summary.includes(pattern));
    };
  },

  /**
   * Approve only if the adapter is in a whitelist.
   * 
   * @param allowedAdapters - Array of allowed adapter IDs
   */
  allowedAdapters: (allowedAdapters: string[]): ApprovalPredicate => {
    const adapterSet = new Set(allowedAdapters);
    return (request: ApprovalRequestInfo): boolean => {
      const adapterId = request.event.adapter_id;
      if (!adapterId) return false;
      return adapterSet.has(adapterId);
    };
  },
};

/**
 * Handler for managing approval requests.
 */
export class ApprovalHandler {
  private client: AllternitComputerUseClient;
  private pendingApprovals: Map<string, (decision: boolean) => void> = new Map();
  private autoApprovePredicates: Map<string, ApprovalPredicate> = new Map();
  private globalPredicate?: ApprovalPredicate;
  private subscriptions: Map<string, () => void> = new Map();

  /**
   * Callback for approval requests when no predicate matches.
   * Return true to approve, false to deny.
   */
  onApprovalRequest?: (request: ApprovalRequestInfo) => boolean | Promise<boolean>;

  /**
   * Create a new approval handler.
   * 
   * @param client - The Allternit Computer Use client
   */
  constructor(client: AllternitComputerUseClient) {
    this.client = client;
  }

  /**
   * Set a global auto-approval predicate.
   * This predicate is checked for all approval requests.
   * 
   * @param predicate - The predicate to use
   */
  setGlobalPredicate(predicate: ApprovalPredicate): void {
    this.globalPredicate = predicate;
  }

  /**
   * Start watching a run for approval requests.
   * 
   * @param runId - The run ID to watch
   * @param predicate - Optional predicate for auto-approval
   * @returns Unwatch function
   */
  watchRun(runId: string, predicate?: ApprovalPredicate): () => void {
    // Store predicate if provided
    if (predicate) {
      this.autoApprovePredicates.set(runId, predicate);
    }

    // Subscribe to events for this run
    const unsubscribe = this.client.subscribeToRun(
      runId,
      async (event: EngineEvent) => {
        await this.handleEvent(runId, event);
      },
      { autoClose: false }
    );

    this.subscriptions.set(runId, unsubscribe);

    return () => {
      this.unwatchRun(runId);
    };
  }

  /**
   * Stop watching a run.
   * 
   * @param runId - The run ID to stop watching
   */
  unwatchRun(runId: string): void {
    const unsubscribe = this.subscriptions.get(runId);
    if (unsubscribe) {
      unsubscribe();
      this.subscriptions.delete(runId);
    }
    this.autoApprovePredicates.delete(runId);
    this.pendingApprovals.delete(runId);
  }

  /**
   * Handle an incoming event.
   */
  private async handleEvent(runId: string, event: EngineEvent): Promise<void> {
    if (event.event_type !== 'approval.required') {
      // Resolve any pending promise for terminal events
      if (this.isTerminalEvent(event.event_type)) {
        const resolver = this.pendingApprovals.get(runId);
        if (resolver) {
          resolver(false);
          this.pendingApprovals.delete(runId);
        }
      }
      return;
    }

    const request: ApprovalRequestInfo = {
      run_id: runId,
      event,
      message: event.message,
      action_summary: (event.data as Record<string, unknown> | undefined)?.action_summary as string | undefined,
    };

    // Check run-specific predicate
    const runPredicate = this.autoApprovePredicates.get(runId);
    if (runPredicate) {
      const shouldApprove = await runPredicate(request);
      await this.submitDecision(runId, shouldApprove);
      return;
    }

    // Check global predicate
    if (this.globalPredicate) {
      const shouldApprove = await this.globalPredicate(request);
      await this.submitDecision(runId, shouldApprove);
      return;
    }

    // Fall back to callback
    if (this.onApprovalRequest) {
      const shouldApprove = await this.onApprovalRequest(request);
      await this.submitDecision(runId, shouldApprove);
      return;
    }

    // No handler configured - deny by default for safety
    console.warn(`No approval handler configured for run ${runId}, denying by default`);
    await this.submitDecision(runId, false);
  }

  /**
   * Submit an approval decision.
   */
  private async submitDecision(runId: string, approve: boolean): Promise<void> {
    const approvalRequest: ApprovalRequest = {
      decision: approve ? 'approve' : 'deny',
    };

    try {
      await this.client.approve(runId, approvalRequest);
    } catch (error) {
      console.error(`Failed to submit approval for run ${runId}:`, error);
      throw error;
    }
  }

  /**
   * Check if an event type is terminal.
   */
  private isTerminalEvent(eventType: EngineEventType): boolean {
    return (
      eventType === 'run.completed' ||
      eventType === 'run.failed' ||
      eventType === 'run.cancelled'
    );
  }

  /**
   * Create an interactive approval prompt.
   * 
   * This is a factory for creating approval handlers that prompt
   * the user interactively (e.g., via CLI, UI dialog, etc.).
   * 
   * @param prompt - Function that displays the prompt and returns user choice
   * @returns ApprovalHandler configured for interactive approval
   */
  static createInteractive(
    client: AllternitComputerUseClient,
    prompt: (request: ApprovalRequestInfo) => Promise<boolean> | boolean
  ): ApprovalHandler {
    const handler = new ApprovalHandler(client);
    handler.onApprovalRequest = prompt;
    return handler;
  }

  /**
   * Create an auto-approval handler with a predicate.
   * 
   * @param predicate - Predicate to determine auto-approval
   * @returns ApprovalHandler configured for auto-approval
   */
  static createAutoApprove(
    client: AllternitComputerUseClient,
    predicate: ApprovalPredicate = ApprovalPredicates.always
  ): ApprovalHandler {
    const handler = new ApprovalHandler(client);
    handler.setGlobalPredicate(predicate);
    return handler;
  }

  /**
   * Wait for an approval request and return the result.
   * 
   * @param runId - The run ID
   * @returns Promise resolving to the approval request info
   */
  async waitForApprovalRequest(runId: string): Promise<ApprovalRequestInfo> {
    return new Promise((resolve, reject) => {
      const unsubscribe = this.client.subscribeToRun(
        runId,
        (event: EngineEvent) => {
          if (event.event_type === 'approval.required') {
            unsubscribe();
            resolve({
              run_id: runId,
              event,
              message: event.message,
              action_summary: (event.data as Record<string, unknown> | undefined)?.action_summary as string | undefined,
            });
          } else if (this.isTerminalEvent(event.event_type)) {
            unsubscribe();
            reject(new Error(`Run ${runId} ended without requiring approval`));
          }
        },
        { autoClose: false }
      );
    });
  }

  /**
   * Clean up all resources.
   */
  dispose(): void {
    for (const [runId] of this.subscriptions) {
      this.unwatchRun(runId);
    }
    this.pendingApprovals.clear();
    this.autoApprovePredicates.clear();
  }
}

/**
 * Create an approval prompt for a run.
 * 
 * This is a convenience function for creating interactive approval flows.
 * 
 * @param client - The Allternit Computer Use client
 * @param runId - The run ID
 * @param prompt - Function to prompt the user
 * @returns Promise resolving when approval is handled
 */
export async function createApprovalPrompt(
  client: AllternitComputerUseClient,
  runId: string,
  prompt: (request: ApprovalRequestInfo) => Promise<boolean> | boolean
): Promise<ApprovalResponse> {
  const event = await client.waitForApproval(runId);
  
  const request: ApprovalRequestInfo = {
    run_id: runId,
    event,
    message: event.message,
    action_summary: (event.data as Record<string, unknown> | undefined)?.action_summary as string | undefined,
  };

  const shouldApprove = await prompt(request);
  
  return client.approve(runId, {
    decision: shouldApprove ? 'approve' : 'deny',
  });
}

/**
 * Set up conditional auto-approval for a run.
 * 
 * @param client - The Allternit Computer Use client
 * @param runId - The run ID
 * @param predicate - Predicate to determine approval
 * @returns Unwatch function
 */
export function autoApprove(
  client: AllternitComputerUseClient,
  runId: string,
  predicate: ApprovalPredicate
): () => void {
  const handler = new ApprovalHandler(client);
  return handler.watchRun(runId, predicate);
}
