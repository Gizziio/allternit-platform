/**
 * File IO Wrapper
 * 
 * Wraps runtime file operations to inject Allternit Kernel routing.
 */

import type {
  AllternitKernel,
  FileContext,
  RoutingResult,
  RoutingDecision,
} from '@allternit/governor';
import {
  FileAccessError,
} from '../types.js';
// Dynamic import used below
type FileHandle = any;
const isNode = typeof process !== 'undefined' && process.versions && !!process.versions.node;
const path = isNode ? (function() { try { return require('node:path'); } catch(e) { return null; } })() : null;
const pathShim = path || { resolve: (_a: string, b: string) => b, normalize: (a: string) => a };

/**
 * File operation type
 */
export type FileOperation = 'read' | 'write' | 'delete' | 'execute';

/**
 * File wrapper options
 */
export interface FileWrapperOptions {
  kernel: AllternitKernel;
  sessionId: string;
  agentId: string;
  wihId?: string;
  
  /**
   * Workspace root for path resolution
   */
  workspaceRoot: string;
  
  /**
   * Allow operations outside workspace
   * @default false
   */
  allowExternalPaths?: boolean;
  
  /**
   * Read-only mode
   * @default false
   */
  readOnly?: boolean;
  
  /**
   * Callback for audit logging
   */
  onAudit?: (log: FileAuditLog) => void;
}

/**
 * File audit log entry
 */
export interface FileAuditLog {
  timestamp: string;
  sessionId: string;
  wihId?: string;
  agentId: string;
  operation: FileOperation;
  path: string;
  resolvedPath?: string;
  decision: RoutingDecision;
  reason?: string;
  success?: boolean;
  error?: string;
}

/**
 * Wrapped file operation result
 */
export interface WrappedFileResult {
  decision: RoutingDecision;
  handle?: FileHandle;
  error?: Error;
  auditLog: FileAuditLog;
}

/**
 * Wrap file open operation
 */
export async function wrapFileOpen(
  options: FileWrapperOptions,
  filePath: string,
  flags?: string | number,
  mode?: number
): Promise<WrappedFileResult> {
  const {
    kernel,
    sessionId,
    agentId,
    wihId,
    workspaceRoot,
    onAudit,
  } = options;

  const timestamp = new Date().toISOString();

  // Determine operation type from flags
  const operation = determineOperation(flags);

  // Check read-only mode
  if (options.readOnly && operation !== 'read') {
    const auditLog = createAuditLog({
      timestamp,
      sessionId,
      wihId,
      agentId,
      operation,
      path: filePath,
      decision: 'deny',
      reason: 'File system is in read-only mode',
    });
    onAudit?.(auditLog);

    return {
      decision: 'deny',
      error: new FileAccessError(
        'File system is in read-only mode',
        'READ_ONLY'
      ),
      auditLog,
    };
  }

  // Resolve and validate path
  let resolvedPath: string;
  try {
    resolvedPath = pathShim.resolve(workspaceRoot, filePath);
  } catch (error) {
    const auditLog = createAuditLog({
      timestamp,
      sessionId,
      wihId,
      agentId,
      operation,
      path: filePath,
      decision: 'deny',
      reason: 'Invalid path',
      error: error instanceof Error ? error.message : String(error),
    });
    onAudit?.(auditLog);

    return {
      decision: 'deny',
      error: new FileAccessError(
        `Invalid path: ${error instanceof Error ? error.message : String(error)}`,
        'INVALID_PATH'
      ),
      auditLog,
    };
  }

  // Check workspace boundary
  if (!options.allowExternalPaths) {
    const normalizedWorkspace = pathShim.normalize(workspaceRoot);
    const normalizedPath = pathShim.normalize(resolvedPath);
    
    if (!normalizedPath.startsWith(normalizedWorkspace)) {
      const auditLog = createAuditLog({
        timestamp,
        sessionId,
        wihId,
        agentId,
        operation,
        path: filePath,
        resolvedPath,
        decision: 'deny',
        reason: 'Path escapes workspace root',
      });
      onAudit?.(auditLog);

      return {
        decision: 'deny',
        error: new FileAccessError(
          'Path escapes workspace root',
          'PATH_ESCAPE'
        ),
        auditLog,
      };
    }
  }

  // Build file context for routing
  const fileContext: FileContext = {
    operation,
    path: filePath,
    resolvedPath,
    sessionId,
    agentId,
    wihId,
  };

  // Route through Allternit Kernel
  let routingResult: RoutingResult;
  try {
    routingResult = await kernel.routeFileAccess(fileContext);
  } catch (error) {
    const auditLog = createAuditLog({
      timestamp,
      sessionId,
      wihId,
      agentId,
      operation,
      path: filePath,
      resolvedPath,
      decision: 'deny',
      error: error instanceof Error ? error.message : String(error),
    });
    onAudit?.(auditLog);

    return {
      decision: 'deny',
      error: new FileAccessError(
        `Routing error: ${error instanceof Error ? error.message : String(error)}`,
        'ROUTING_ERROR'
      ),
      auditLog,
    };
  }

  // Handle routing decision
  switch (routingResult.decision) {
    case 'deny': {
      const auditLog = createAuditLog({
        timestamp,
        sessionId,
        wihId,
        agentId,
        operation,
        path: filePath,
        resolvedPath,
        decision: 'deny',
        reason: routingResult.reason,
      });
      onAudit?.(auditLog);

      return {
        decision: 'deny',
        error: new FileAccessError(
          routingResult.reason ?? 'File access denied by Allternit Kernel',
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
        operation,
        path: filePath,
        resolvedPath,
        decision: 'delegate',
        reason: routingResult.reason,
      });
      onAudit?.(auditLog);

      return {
        decision: 'delegate',
        error: new FileAccessError(
          `Delegated to ${routingResult.delegateTo}: ${routingResult.reason}`,
          'DELEGATED'
        ),
        auditLog,
      };
    }

    case 'allow':
    case 'modify':
    default: {
      // Execute file operation
      let handle: FileHandle | undefined;
      let executionError: Error | undefined;

      try {
        const { open } = await import('node:fs/promises');
      handle = await open(resolvedPath, flags as any, mode);
      } catch (error) {
        executionError = error instanceof Error ? error : new Error(String(error));
      }

      const auditLog = createAuditLog({
        timestamp,
        sessionId,
        wihId,
        agentId,
        operation,
        path: filePath,
        resolvedPath,
        decision: routingResult.decision,
        success: !executionError,
        error: executionError?.message,
      });
      onAudit?.(auditLog);

      if (executionError) {
        return {
          decision: routingResult.decision,
          error: executionError,
          auditLog,
        };
      }

      return {
        decision: routingResult.decision,
        handle,
        auditLog,
      };
    }
  }
}

/**
 * Wrap read file operation
 */
export async function wrapFileRead(
  options: FileWrapperOptions,
  filePath: string,
  encoding?: BufferEncoding
): Promise<{ data: string | Buffer; auditLog: FileAuditLog }> {
  const result = await wrapFileOpen(options, filePath, 'r');

  if (result.error || !result.handle) {
    throw result.error ?? new FileAccessError('Failed to open file', 'OPEN_ERROR');
  }

  try {
    const data = encoding 
      ? await result.handle.readFile({ encoding })
      : await result.handle.readFile();
    return { data, auditLog: result.auditLog };
  } finally {
    await result.handle.close();
  }
}

/**
 * Wrap write file operation
 */
export async function wrapFileWrite(
  options: FileWrapperOptions,
  filePath: string,
  data: string | Buffer,
  encoding?: BufferEncoding
): Promise<{ bytesWritten: number; auditLog: FileAuditLog }> {
  const result = await wrapFileOpen(
    options,
    filePath,
    'w',
    0o644
  );

  if (result.error || !result.handle) {
    throw result.error ?? new FileAccessError('Failed to open file', 'OPEN_ERROR');
  }

  try {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, encoding);
    const writeResult = await result.handle.write(buffer);
    return { bytesWritten: writeResult.bytesWritten, auditLog: result.auditLog };
  } finally {
    await result.handle.close();
  }
}

/**
 * Wrap delete file operation
 */
export async function wrapFileDelete(
  options: FileWrapperOptions,
  filePath: string
): Promise<{ success: boolean; auditLog: FileAuditLog }> {
  const timestamp = new Date().toISOString();
  const {
    kernel,
    sessionId,
    agentId,
    wihId,
    workspaceRoot,
    onAudit,
  } = options;

  const resolvedPath = pathShim.resolve(workspaceRoot, filePath);

  // Build file context for routing
  const fileContext: FileContext = {
    operation: 'delete',
    path: filePath,
    resolvedPath,
    sessionId,
    agentId,
    wihId,
  };

  // Route through Allternit Kernel
  const routingResult = await kernel.routeFileAccess(fileContext);

  if (routingResult.decision === 'deny') {
    const auditLog = createAuditLog({
      timestamp,
      sessionId,
      wihId,
      agentId,
      operation: 'delete',
      path: filePath,
      resolvedPath,
      decision: 'deny',
      reason: routingResult.reason,
    });
    onAudit?.(auditLog);

    throw new FileAccessError(
      routingResult.reason ?? 'File deletion denied',
      'ACCESS_DENIED'
    );
  }

  // Execute deletion
  if (!isNode) throw new Error('File deletion is not supported in this environment.');
  const { unlink } = await import('node:fs/promises');
  try {
    await unlink(resolvedPath);
    
    const auditLog = createAuditLog({
      timestamp,
      sessionId,
      wihId,
      agentId,
      operation: 'delete',
      path: filePath,
      resolvedPath,
      decision: 'allow',
      success: true,
    });
    onAudit?.(auditLog);

    return { success: true, auditLog };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    const auditLog = createAuditLog({
      timestamp,
      sessionId,
      wihId,
      agentId,
      operation: 'delete',
      path: filePath,
      resolvedPath,
      decision: 'allow',
      success: false,
      error: errorMessage,
    });
    onAudit?.(auditLog);

    throw new FileAccessError(errorMessage, 'DELETE_ERROR');
  }
}

/**
 * Create Allternit-aware file operations object
 */
export function createWrappedFileOperations(
  options: FileWrapperOptions
): {
  open: (path: string, flags?: string | number) => Promise<WrappedFileResult>;
  read: (path: string, encoding?: BufferEncoding) => Promise<{ data: string | Buffer; auditLog: FileAuditLog }>;
  write: (path: string, data: string | Buffer, encoding?: BufferEncoding) => Promise<{ bytesWritten: number; auditLog: FileAuditLog }>;
  delete: (path: string) => Promise<{ success: boolean; auditLog: FileAuditLog }>;
} {
  return {
    open: (path, flags) => wrapFileOpen(options, path, flags),
    read: (path, encoding) => wrapFileRead(options, path, encoding),
    write: (path, data, encoding) => wrapFileWrite(options, path, data, encoding),
    delete: (path) => wrapFileDelete(options, path),
  };
}

/**
 * Determine operation type from file flags
 */
function determineOperation(flags?: string | number): FileOperation {
  if (flags === undefined || flags === 'r') {
    return 'read';
  }

  const flagStr = String(flags);
  
  if (flagStr.includes('r') && !flagStr.includes('w') && !flagStr.includes('a')) {
    return 'read';
  }
  
  if (flagStr.includes('w') || flagStr.includes('a')) {
    return 'write';
  }
  
  if (flagStr.includes('x')) {
    return 'execute';
  }

  return 'read';
}

/**
 * Helper to create audit log entry
 */
function createAuditLog(params: {
  timestamp: string;
  sessionId: string;
  wihId?: string;
  agentId: string;
  operation: FileOperation;
  path: string;
  resolvedPath?: string;
  decision: RoutingDecision;
  reason?: string;
  success?: boolean;
  error?: string;
}): FileAuditLog {
  return {
    timestamp: params.timestamp,
    sessionId: params.sessionId,
    wihId: params.wihId,
    agentId: params.agentId,
    operation: params.operation,
    path: params.path,
    resolvedPath: params.resolvedPath,
    decision: params.decision,
    reason: params.reason,
    success: params.success,
    error: params.error,
  };
}

/**
 * Protected path patterns
 */
export const PROTECTED_PATH_PATTERNS = [
  /\.\./,                    // Path traversal
  /\.env/i,                  // Environment files
  /\.ssh/i,                  // SSH keys
  /\.aws/i,                  // AWS credentials
  /\.git[\/]/,               // Git internals
  /node_modules[\/]/,        // Dependencies
  /\//,                      // Absolute paths (when not allowed)
];

/**
 * Check if path matches protected pattern
 */
export function isProtectedPath(filePath: string): boolean {
  return PROTECTED_PATH_PATTERNS.some(pattern => pattern.test(filePath));
}
