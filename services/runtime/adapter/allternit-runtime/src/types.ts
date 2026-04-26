import type { AllternitKernel } from '@allternit/governor';

export interface AdapterContext {
  kernel: AllternitKernel;
  wihId?: string;
  sessionId?: string;
  agentId?: string;
  workspaceRoot?: string;
}

export interface RuntimeSessionContext {
  id: string;
  agentId: string;
  kernel: AllternitKernel;
}

export interface RuntimeToolContext {
  toolName: string;
  params: Record<string, unknown>;
}

export interface RuntimeToolResult {
  success: boolean;
  result?: unknown;
  error?: Error;
}

export interface RuntimeToolPolicy {
  allow?: string[];
  deny?: string[];
}

export interface RuntimeFileContext {
  operation: 'read' | 'write' | 'delete' | 'execute';
  path: string;
  resolvedPath?: string;
  flags?: number;
  encoding?: string;
}

export interface RuntimeFileResult {
  success: boolean;
  data?: unknown;
  error?: Error;
}

export interface RuntimeGatewayOptions {
  kernel?: AllternitKernel;
  enforceWih?: boolean;
  instanceId?: string;
  clientName?: string;
  onClose?: (code: number, reason: string) => void;
  workspaceRoot?: string;
}

export interface SessionInitResult {
  success: boolean;
  sessionId: string;
  context: RuntimeSessionContext;
  wihId?: string;
}

export interface ToolWrapperResult {
  success: boolean;
  result?: unknown;
  error?: Error;
}

export interface FileWrapperResult {
  success: boolean;
  data?: unknown;
  error?: Error;
}

export interface RuntimeBridgeConfig {
  kernel: AllternitKernel;
  enforceWih?: boolean;
  defaultToolPolicy?: RuntimeToolPolicy;
  fileAccessMode?: 'standard' | 'strict' | 'readonly';
  allowedWorkspaces?: string[];
  auditLogging?: {
    enabled: boolean;
    destination?: 'console' | 'file';
    filePath?: string;
    callback?: (entry: AuditLogEntry) => void;
  };
}

export interface AuditLogEntry {
  timestamp: string;
  operation: string;
  decision: 'allow' | 'deny' | 'delegate';
  context: Record<string, unknown>;
  reason?: string;
}

export type HookFunction = (context: unknown) => Promise<unknown> | unknown;

export interface HookRegistry {
  preSessionStart: HookFunction[];
  postSessionStart: HookFunction[];
  preToolUse: HookFunction[];
  postToolUse: HookFunction[];
  preFileAccess: HookFunction[];
  postFileAccess: HookFunction[];
}

export interface HookManager {
  register<K extends keyof HookRegistry>(hookPoint: K, fn: HookFunction): void;
  execute<K extends keyof HookRegistry>(hookPoint: K, context: unknown): Promise<unknown[]>;
  clear<K extends keyof HookRegistry>(hookPoint: K): void;
  clearAll(): void;
  count<K extends keyof HookRegistry>(hookPoint: K): number;
}

export class RuntimeBridgeError extends Error {
  constructor(message: any, public code: string, public data?: any) {
    super(typeof message === 'string' ? message : JSON.stringify(message));
    this.name = 'RuntimeBridgeError';
  }
}

export class SessionInitError extends RuntimeBridgeError {
  constructor(message: any, data?: any, code: string = 'SESSION_INIT_ERROR') {
    super(message, code, data);
  }
}

export class ToolExecutionError extends RuntimeBridgeError {
  constructor(message: any, data?: any, code: string = 'TOOL_EXECUTION_ERROR') {
    super(message, code, data);
  }
}

export class FileAccessError extends RuntimeBridgeError {
  constructor(message: any, data?: any, code: string = 'FILE_ACCESS_ERROR') {
    super(message, code, data);
  }
}
