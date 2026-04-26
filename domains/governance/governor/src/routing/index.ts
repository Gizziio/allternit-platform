/**
 * Allternit Kernel Routing Functions
 * 
 * Built-in routing functions for tool execution, file access,
 * and session management. These implement the RoutingFunction
 * interface defined in types/index.ts.
 */

import {
  AllternitKernel,
  ToolContext,
  FileContext,
  RoutingResult,
  // RoutingDecision,
  PreToolUseFunction,
  FileAccessFunction,
  // RoutingDeniedError,
} from '../types/index.js';

// ============================================================================
// Tool Routing
// ============================================================================

/**
 * Default tool allowlist - tools permitted without special review
 */
export const DEFAULT_ALLOWED_TOOLS = new Set([
  'read_file',
  'write_file', 
  'edit_file',
  'search_files',
  'list_files',
  'bash',
  'read_media_file',
  'fetch_url',
  'search_web',
]);

/**
 * High-risk tools requiring explicit approval
 */
export const HIGH_RISK_TOOLS = new Set([
  'deploy',
  'delete_file',
  'execute_remote',
  'modify_system_config',
]);

/**
 * PreToolUse router with WIH-aware validation
 * 
 * Checks:
 * 1. Tool is in allowlist
 * 2. No active WIH blocks this operation
 * 3. Session has required permissions
 */
export const preToolUseRouter: PreToolUseFunction = (
  context: ToolContext,
  _kernel: AllternitKernel
): RoutingResult => {
  const { toolName, wihId, sessionId } = context;

  // Check high-risk tools
  if (HIGH_RISK_TOOLS.has(toolName)) {
    return {
      decision: 'delegate',
      delegateTo: 'law-layer',
      reason: `High-risk tool '${toolName}' requires Law Layer review`,
      auditLog: {
        tool: toolName,
        wihId,
        sessionId,
        riskLevel: 'high',
      },
    };
  }

  // Check allowlist
  if (!DEFAULT_ALLOWED_TOOLS.has(toolName)) {
    return {
      decision: 'delegate',
      delegateTo: 'review-queue',
      reason: `Tool '${toolName}' not in default allowlist`,
      auditLog: {
        tool: toolName,
        wihId,
        action: 'requires_review',
      },
    };
  }

  // Allow with audit trail
  return {
    decision: 'allow',
    reason: 'Tool in default allowlist',
    auditLog: {
      tool: toolName,
      wihId,
      sessionId,
      timestamp: new Date().toISOString(),
    },
  };
};

/**
 * WIH-gated tool router
 * 
 * Only allows tools if there's an active WIH item for this session.
 * Enforces "no work without a ticket" policy.
 */
export const wihGatedRouter: PreToolUseFunction = async (
  context: ToolContext,
  _kernel: AllternitKernel
): Promise<RoutingResult> => {
  const { wihId, toolName, sessionId } = context;

  if (!wihId) {
    return {
      decision: 'deny',
      reason: 'No active WIH item. All work must be ticketed.',
      auditLog: {
        tool: toolName,
        sessionId,
        violation: 'missing_wih',
      },
    };
  }

  const wih = await _kernel.getWih(wihId);
  
  if (!wih) {
    return {
      decision: 'deny',
      reason: `WIH item ${wihId} not found`,
      auditLog: { wihId, violation: 'invalid_wih' },
    };
  }

  if (wih.status === 'blocked') {
    return {
      decision: 'deny',
      reason: `WIH ${wihId} is blocked by: ${wih.blockedBy.join(', ')}`,
      auditLog: { wihId, blockedBy: wih.blockedBy },
    };
  }

  if (wih.status !== 'in_progress' && wih.status !== 'ready') {
    return {
      decision: 'deny',
      reason: `WIH ${wihId} status is '${wih.status}', expected 'in_progress' or 'ready'`,
      auditLog: { wihId, status: wih.status },
    };
  }

  return {
    decision: 'allow',
    reason: `WIH ${wihId} active and valid`,
    auditLog: { wihId, tool: toolName, status: wih.status },
  };
};

// ============================================================================
// File Access Routing
// ============================================================================

/**
 * Default paths that require explicit approval
 */
export const PROTECTED_PATHS = [
  /^\//,                          // Absolute paths (root)
  /\.\./,                         // Path traversal
  /\.env/,                        // Environment files
  /\.ssh/,                        // SSH keys
  /\.aws/,                        // AWS credentials
  /node_modules\//,               // Dependency directories
  /\.git\//,                     // Git internals
];

/**
 * File access router with path validation
 * 
 * Validates:
 * 1. Path is within workspace root
 * 2. No traversal attempts
 * 3. Not accessing protected files
 */
export const fileAccessRouter: FileAccessFunction = (
  context: FileContext,
  _kernel: AllternitKernel
): RoutingResult => {
  const { operation, path: filePath, resolvedPath } = context; const workspaceRoot = (context as any).workspaceRoot;

  // Check for path traversal
  if (filePath.includes('..')) {
    return {
      decision: 'deny',
      reason: 'Path contains traversal pattern (..)',
      auditLog: { path: filePath, operation, violation: 'traversal' },
    };
  }

  // Check against protected patterns
  for (const pattern of PROTECTED_PATHS) {
    if (pattern.test(filePath)) {
      return {
        decision: 'delegate',
        delegateTo: 'law-layer',
        reason: `Path matches protected pattern: ${pattern}`,
        auditLog: { path: filePath, pattern: pattern.toString() },
      };
    }
  }

  // If resolved path is provided, verify it's within workspace
  if (resolvedPath && workspaceRoot) {
    const normalizedWorkspace = workspaceRoot.replace(/\/$/, '');
    const normalizedPath = resolvedPath.replace(/\/$/, '');
    
    if (!normalizedPath.startsWith(normalizedWorkspace)) {
      return {
        decision: 'deny',
        reason: 'Resolved path escapes workspace root',
        auditLog: {
          path: filePath,
          resolvedPath,
          workspaceRoot,
          violation: 'escapes_workspace',
        },
      };
    }
  }

  return {
    decision: 'allow',
    reason: 'File access validated',
    auditLog: { operation, path: filePath },
  };
};

/**
 * Read-only file router
 * 
 * Only allows read operations. Useful for audit/prod environments.
 */
export const readOnlyFileRouter: FileAccessFunction = (
  context: FileContext,
  _kernel: AllternitKernel
): RoutingResult => {
  const { operation, path: filePath } = context;

  if (operation !== 'read') {
    return {
      decision: 'deny',
      reason: `Operation '${operation}' not allowed in read-only mode`,
      auditLog: { operation, path: filePath, mode: 'read-only' },
    };
  }

  return fileAccessRouter(context, _kernel) as RoutingResult;
};

// ============================================================================
// Composite Routers
// ============================================================================

/**
 * Create a composite router that runs multiple routers in sequence
 * All routers must return 'allow' for the composite to allow.
 */
export function createCompositeRouter(
  ...routers: PreToolUseFunction[]
): PreToolUseFunction {
  return async (context: ToolContext, _kernel: AllternitKernel): Promise<RoutingResult> => {
    const auditLogs: Record<string, unknown>[] = [];

    for (const router of routers) {
      const result = await router(context, _kernel);
      
      if (result.auditLog) {
        auditLogs.push(result.auditLog);
      }

      if (result.decision !== 'allow') {
        return {
          ...result,
          auditLog: { composite: auditLogs },
        };
      }
    }

    return {
      decision: 'allow',
      reason: 'All composite checks passed',
      auditLog: { composite: auditLogs },
    };
  };
}

// ============================================================================
// Router Registry
// ============================================================================

export const BUILTIN_ROUTERS = {
  preToolUse: {
    default: preToolUseRouter,
    wihGated: wihGatedRouter,
    composite: createCompositeRouter,
  },
  fileAccess: {
    default: fileAccessRouter,
    readOnly: readOnlyFileRouter,
  },
} as const;

export type RouterName = keyof typeof BUILTIN_ROUTERS.preToolUse 
  | keyof typeof BUILTIN_ROUTERS.fileAccess;
