/**
 * Tool Execution Wrapper
 * 
 * Wraps runtime tool execution to inject A2R Kernel routing.
 */

import type {
  A2RKernel,
  ToolContext,
  RoutingResult,
  RoutingDecision,
} from '@a2r/governor';
import {
  type RuntimeToolPolicy,
  ToolExecutionError,
} from '../types.js';

/**
 * Original tool executor function type
 */
type OriginalToolExecutor = (
  toolName: string,
  params: Record<string, unknown>
) => Promise<unknown>;

/**
 * Tool wrapper options
 */
export interface ToolWrapperOptions {
  kernel: A2RKernel;
  sessionId: string;
  agentId: string;
  workspaceRoot: string;
  wihId?: string;
  
  /**
   * Original tool executor (from runtime)
   */
  originalExecutor: OriginalToolExecutor;
  
  /**
   * Additional tool policy
   */
  toolPolicy?: RuntimeToolPolicy;
  
  /**
   * Callback for audit logging
   */
  onAudit?: (log: ToolAuditLog) => void;
}

/**
 * Tool audit log entry
 */
export interface ToolAuditLog {
  timestamp: string;
  sessionId: string;
  wihId?: string;
  agentId: string;
  toolName: string;
  toolParams: Record<string, unknown>;
  decision: RoutingDecision;
  reason?: string;
  executionTime?: number;
  success?: boolean;
  error?: string;
}

/**
 * Wrapped tool execution result
 */
export interface WrappedToolResult {
  decision: RoutingDecision;
  result?: unknown;
  error?: Error;
  modifiedParams?: Record<string, unknown>;
  delegatedTo?: string;
  auditLog: ToolAuditLog;
}

/**
 * Wrap a single tool execution with A2R routing
 */
export async function wrapToolExecution(
  options: ToolWrapperOptions,
  toolName: string,
  toolParams: Record<string, unknown>
): Promise<WrappedToolResult> {
  const {
    kernel,
    sessionId,
    agentId,
    workspaceRoot,
    wihId,
    originalExecutor,
    onAudit,
  } = options;

  const timestamp = new Date().toISOString();

  // Build tool context for routing
  const toolContext: ToolContext = {
    toolName,
    toolParams,
    sessionId,
    agentId,
    workspaceRoot,
    wihId,
  };

  // Step 1: Pre-tool-use routing
  let routingResult: RoutingResult;
  try {
    routingResult = await kernel.routeToolUse(toolContext);
  } catch (error) {
    const auditLog = createAuditLog({
      timestamp,
      sessionId,
      wihId,
      agentId,
      toolName,
      toolParams,
      decision: 'deny',
      error: error instanceof Error ? error.message : String(error),
    });
    onAudit?.(auditLog);
    
    throw new ToolExecutionError(
      `Routing error: ${error instanceof Error ? error.message : String(error)}`,
      'ROUTING_ERROR'
    );
  }

  // Handle routing decision
  switch (routingResult.decision) {
    case 'deny': {
      const auditLog = createAuditLog({
        timestamp,
        sessionId,
        wihId,
        agentId,
        toolName,
        toolParams,
        decision: 'deny',
        reason: routingResult.reason,
      });
      onAudit?.(auditLog);

      return {
        decision: 'deny',
        error: new ToolExecutionError(
          routingResult.reason ?? 'Tool execution denied by A2R Kernel',
          'ACCESS_DENIED'
        ),
        auditLog,
      };
    }

    case 'delegate': {
      const auditLog = createAuditLog({
        timestamp,
        sessionId,
        wihId,
        agentId,
        toolName,
        toolParams,
        decision: 'delegate',
        reason: routingResult.reason,
      });
      onAudit?.(auditLog);

      return {
        decision: 'delegate',
        delegatedTo: routingResult.delegateTo,
        auditLog,
      };
    }

    // @ts-ignore
    case 'modify': { 
      // Apply parameter modifications
      if (routingResult.modifiedParams) {
        Object.assign(toolParams, routingResult.modifiedParams);
      }
      // Fall through to execute
    }

    case 'allow':
    default: {
      // Step 2: Execute tool
      let result: unknown;
      let executionError: Error | undefined;
      const executionStart = Date.now();

      try {
        result = await originalExecutor(
          toolName,
          routingResult.modifiedParams ?? toolParams
        );
      } catch (error) {
        executionError = error instanceof Error ? error : new Error(String(error));
      }

      const executionTime = Date.now() - executionStart;

      // Create audit log
      const auditLog = createAuditLog({
        timestamp,
        sessionId,
        wihId,
        agentId,
        toolName,
        toolParams: routingResult.modifiedParams ?? toolParams,
        decision: routingResult.decision,
        executionTime,
        success: !executionError,
        error: executionError?.message,
      });
      onAudit?.(auditLog);

      if (executionError) {
        return {
          decision: routingResult.decision,
          error: executionError,
          modifiedParams: routingResult.modifiedParams,
          auditLog,
        };
      }

      return {
        decision: routingResult.decision,
        result,
        modifiedParams: routingResult.modifiedParams,
        auditLog,
      };
    }
  }
}

/**
 * Create a wrapped tool executor
 */
export function createWrappedToolExecutor(
  options: Omit<ToolWrapperOptions, 'originalExecutor'> & {
    originalExecutor: OriginalToolExecutor;
  }
): (
  toolName: string,
  params: Record<string, unknown>
) => Promise<WrappedToolResult> {
  return (toolName, params) => wrapToolExecution(options, toolName, params);
}

/**
 * Batch wrap multiple tools
 */
export function wrapToolSet(
  toolNames: string[],
  options: ToolWrapperOptions
): Map<string, (params: Record<string, unknown>) => Promise<WrappedToolResult>> {
  const wrapped = new Map<string, (params: Record<string, unknown>) => Promise<WrappedToolResult>>();

  for (const toolName of toolNames) {
    wrapped.set(
      toolName,
      async (params: Record<string, unknown>) => {
        return wrapToolExecution(options, toolName, params);
      }
    );
  }

  return wrapped;
}

/**
 * Wrap runtime tool policy
 */
export function wrapToolPolicy(
  originalPolicy: RuntimeToolPolicy,
  _kernel: A2RKernel,
  _context: {
    sessionId: string;
    agentId: string;
    workspaceRoot: string;
    wihId?: string;
  }
): RuntimeToolPolicy {
  return {
    allow: originalPolicy.allow,
    deny: originalPolicy.deny,
  };
}

/**
 * Helper to create audit log entry
 */
function createAuditLog(params: {
  timestamp: string;
  sessionId: string;
  wihId?: string;
  agentId: string;
  toolName: string;
  toolParams: Record<string, unknown>;
  decision: RoutingDecision;
  reason?: string;
  executionTime?: number;
  success?: boolean;
  error?: string;
}): ToolAuditLog {
  const sanitizedParams = sanitizeParams(params.toolParams);

  return {
    timestamp: params.timestamp,
    sessionId: params.sessionId,
    wihId: params.wihId,
    agentId: params.agentId,
    toolName: params.toolName,
    toolParams: sanitizedParams,
    decision: params.decision,
    reason: params.reason,
    executionTime: params.executionTime,
    success: params.success,
    error: params.error,
  };
}

/**
 * Sanitize tool parameters for audit logging
 */
function sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    const isSensitive = sensitiveKeys.some(sk => 
      key.toLowerCase().includes(sk.toLowerCase())
    );
    
    if (isSensitive) {
      sanitized[key] = '***REDACTED***';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * High-risk tool list (mirrors kernel routing)
 */
export const HIGH_RISK_TOOLS = new Set([
  'deploy',
  'delete_file',
  'execute_remote',
  'modify_system_config',
  'exec',
  'bash',
]);

/**
 * Check if tool is high-risk
 */
export function isHighRiskTool(toolName: string): boolean {
  return HIGH_RISK_TOOLS.has(toolName.toLowerCase());
}
