/**
 * Hook Runtime
 * 
 * Implements the hook lifecycle events:
 * SessionStart → UserPromptSubmit → PreToolUse → PostToolUse → SessionEnd
 * 
 * Normalizes provider events (Claude/others) and emits to observability bus.
 * Ensures Rails gating occurs at PreToolUse.
 */

import { EventEmitter } from 'events';
import {
  HookEvent,
  HookEventType,
  ToolCall,
  ToolResult,
  GateDecision,
  RunId,
  CorrelationId,
  WihId,
  DagId,
  NodeId,
  Role,
  ContextPackId,
  PolicyBundleId,
  ReceiptId,
  SessionStartPayload,
  PreToolUsePayload,
  PostToolUsePayload,
  PostToolUseFailurePayload,
} from '../types';

export interface HookRuntimeConfig {
  runId: RunId;
  wihId: WihId;
  dagId: DagId;
  nodeId: NodeId;
  role: Role;
  contextPackId: ContextPackId;
  policyBundleId: PolicyBundleId;
  leaseId?: string;
}

export interface GateChecker {
  check(toolCall: ToolCall): Promise<{
    decision: GateDecision;
    transformedArgs?: Record<string, unknown>;
    reason?: string;
  }>;
  commit(toolCall: ToolCall, result: ToolResult, receiptId: ReceiptId): Promise<void>;
  fail(toolCall: ToolCall, error: ToolResult['error'], receiptId: ReceiptId): Promise<void>;
}

export interface ToolExecutor {
  execute(toolCall: ToolCall, transformedArgs?: Record<string, unknown>): Promise<ToolResult>;
}

export interface ReceiptEmitter {
  emitReceipt(kind: string, payload: unknown): Promise<ReceiptId>;
}

export type HookHandler = (event: HookEvent) => void | Promise<void>;

export class HookRuntime extends EventEmitter {
  private config: HookRuntimeConfig;
  private gateChecker: GateChecker;
  private toolExecutor: ToolExecutor;
  private receiptEmitter: ReceiptEmitter;
  private isActive = false;
  private handlers: Map<HookEventType, HookHandler[]> = new Map();

  constructor(
    config: HookRuntimeConfig,
    gateChecker: GateChecker,
    toolExecutor: ToolExecutor,
    receiptEmitter: ReceiptEmitter
  ) {
    super();
    this.config = config;
    this.gateChecker = gateChecker;
    this.toolExecutor = toolExecutor;
    this.receiptEmitter = receiptEmitter;
  }

  /**
   * Start the session
   */
  async start(reason: 'startup' | 'resume' | 'clear' | 'compact'): Promise<void> {
    if (this.isActive) {
      throw new Error('Session already active');
    }
    this.isActive = true;

    const correlationId = this.generateCorrelationId();
    const payload: SessionStartPayload = {
      reason,
      wihId: this.config.wihId,
      dagId: this.config.dagId,
      nodeId: this.config.nodeId,
      role: this.config.role,
    };

    await this.emitHookEvent('SessionStart', payload, correlationId);
  }

  /**
   * End the session
   */
  async end(endReason: string): Promise<void> {
    if (!this.isActive) {
      throw new Error('Session not active');
    }

    const correlationId = this.generateCorrelationId();
    await this.emitHookEvent('SessionEnd', { reason: endReason }, correlationId);
    this.isActive = false;
  }

  /**
   * Execute a tool call with full gating lifecycle
   * This is the critical path - every tool goes through PreToolUse gate check
   */
  async executeTool(toolCall: ToolCall, leaseManager?: { isLeaseValid: (leaseId: string) => boolean }): Promise<ToolResult> {
    if (!this.isActive) {
      throw new Error('Session not active');
    }

    // Validate lease if configured
    if (this.config.leaseId && leaseManager) {
      if (!leaseManager.isLeaseValid(this.config.leaseId)) {
        throw new Error(`Lease ${this.config.leaseId} is no longer valid`);
      }
    }

    const correlationId = toolCall.correlationId || this.generateCorrelationId();

    // Phase 1: PreToolUse - Gate check
    const prePayload: PreToolUsePayload = {
      toolCall,
      contextPackId: this.config.contextPackId,
      policyBundleId: this.config.policyBundleId,
    };

    await this.emitHookEvent('PreToolUse', prePayload, correlationId);

    // Emit tool_call_pre receipt
    const preReceiptId = await this.receiptEmitter.emitReceipt('tool_call_pre', {
      tool: toolCall.tool,
      args: this.hashArgs(toolCall.args),
      correlationId,
    });

    // Call Rails gate for authorization
    const gateResult = await this.gateChecker.check(toolCall);

    if (gateResult.decision === 'BLOCK') {
      const errorResult: ToolResult = {
        success: false,
        error: {
          message: `Tool blocked by policy: ${gateResult.reason || 'No reason provided'}`,
          code: 'GATE_BLOCKED',
        },
      };

      await this.emitPostToolUseFailure(toolCall, errorResult.error, preReceiptId, correlationId);
      return errorResult;
    }

    if (gateResult.decision === 'REQUIRE_APPROVAL') {
      await this.emitHookEvent('PermissionRequest', {
        toolCall,
        reason: 'Gate returned REQUIRE_APPROVAL',
      }, correlationId);

      const errorResult: ToolResult = {
        success: false,
        error: {
          message: 'Tool requires explicit approval',
          code: 'REQUIRES_APPROVAL',
        },
      };

      await this.emitPostToolUseFailure(toolCall, errorResult.error, preReceiptId, correlationId);
      return errorResult;
    }

    // Execute the tool (with transformed args if applicable)
    const argsToUse = gateResult.decision === 'TRANSFORM' 
      ? gateResult.transformedArgs || toolCall.args 
      : toolCall.args;

    const executionToolCall = { ...toolCall, args: argsToUse };

    try {
      const result = await this.toolExecutor.execute(executionToolCall);

      // Phase 2: PostToolUse - Record outcome
      const postReceiptId = await this.receiptEmitter.emitReceipt('tool_call_post', {
        tool: toolCall.tool,
        args: this.hashArgs(toolCall.args),
        result: result.success ? 'success' : 'failure',
        affectedPaths: result.affectedPaths,
        correlationId,
      });

      const postPayload: PostToolUsePayload = {
        toolCall,
        result,
        gateDecision: gateResult.decision,
        receiptId: postReceiptId,
      };

      await this.emitHookEvent('PostToolUse', postPayload, correlationId);
      await this.gateChecker.commit(toolCall, result, postReceiptId);

      return result;
    } catch (error) {
      const toolError: ToolResult['error'] = {
        message: error instanceof Error ? error.message : String(error),
        code: 'EXECUTION_ERROR',
      };

      await this.emitPostToolUseFailure(toolCall, toolError, preReceiptId, correlationId);
      return { success: false, error: toolError };
    }
  }

  /**
   * Register a handler for a specific hook event type
   */
  onHook(eventType: HookEventType, handler: HookHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  /**
   * Remove a handler for a specific hook event type
   */
  offHook(eventType: HookEventType, handler: HookHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Check if session is active
   */
  get active(): boolean {
    return this.isActive;
  }

  /**
   * Get runtime config
   */
  getRuntimeConfig(): HookRuntimeConfig {
    return { ...this.config };
  }

  // Private helpers

  private async emitHookEvent(
    type: HookEventType,
    payload: unknown,
    correlationId: CorrelationId
  ): Promise<void> {
    const event: HookEvent = {
      type,
      timestamp: new Date().toISOString(),
      runId: this.config.runId,
      correlationId,
      payload,
    };

    // Emit to EventEmitter for external listeners
    this.emit(type, event);
    this.emit('*', event);

    // Call registered handlers
    const handlers = this.handlers.get(type) || [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Hook handler error for ${type}:`, error);
      }
    }
  }

  private async emitPostToolUseFailure(
    toolCall: ToolCall,
    error: ToolResult['error'],
    receiptId: ReceiptId,
    correlationId: CorrelationId
  ): Promise<void> {
    // Emit failure receipt
    const failReceiptId = await this.receiptEmitter.emitReceipt('tool_call_failure', {
      tool: toolCall.tool,
      args: this.hashArgs(toolCall.args),
      error,
      correlationId,
    });

    const payload: PostToolUseFailurePayload = {
      toolCall,
      error,
      receiptId: failReceiptId,
    };

    await this.emitHookEvent('PostToolUseFailure', payload, correlationId);
    await this.gateChecker.fail(toolCall, error, failReceiptId);
  }

  private generateCorrelationId(): CorrelationId {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private hashArgs(args: Record<string, unknown>): string {
    // Simple hash for now - in production use proper hashing
    const str = JSON.stringify(args, Object.keys(args).sort());
    return Buffer.from(str).toString('base64').slice(0, 16);
  }
}

// Factory function
export function createHookRuntime(
  config: HookRuntimeConfig,
  gateChecker: GateChecker,
  toolExecutor: ToolExecutor,
  receiptEmitter: ReceiptEmitter
): HookRuntime {
  return new HookRuntime(config, gateChecker, toolExecutor, receiptEmitter);
}
