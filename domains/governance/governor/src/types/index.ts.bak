/**
 * A2R Kernel Types
 * 
 * Core type definitions for Work-In-Hand (WIH) management,
 * Receipt generation, and routing functions.
 */

// ============================================================================
// WIH Types
// ============================================================================

export type WihStatus = 
  | 'draft' 
  | 'ready' 
  | 'in_progress' 
  | 'blocked' 
  | 'review' 
  | 'complete' 
  | 'cancelled';

export type EffortUnit = 'minutes' | 'hours' | 'days' | 'story-points';

export interface Effort {
  value: number;
  unit: EffortUnit;
}

export interface WihArtifact {
  path: string;
  type: 'code' | 'doc' | 'config' | 'test' | 'schema';
  description?: string;
}

export interface WihRouting {
  preToolUse?: string[];
  postToolUse?: string[];
  fileAccessCheck?: string[];
}

export interface WihItem {
  id: string;
  title: string;
  description?: string;
  status: WihStatus;
  priority: number;
  blockedBy: string[];
  blocks: string[];
  assignee?: string;
  phase?: string;
  tags: string[];
  estimatedEffort?: Effort;
  actualEffort?: Effort;
  receiptRefs: string[];
  artifacts: WihArtifact[];
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  version: string;
  routing?: WihRouting;
}

// ============================================================================
// Receipt Types
// ============================================================================

export type ReceiptStatus = 'complete' | 'partial' | 'rejected' | 'superseded';

export type AttestationType = 
  | 'git-commit' 
  | 'test-pass' 
  | 'review-approval' 
  | 'manual-sign' 
  | 'checksum' 
  | 'signature';

export interface Attestation {
  type: AttestationType;
  value: string;
  agent?: string;
  timestamp?: string;
}

export interface ReceiptArtifact {
  path: string;
  checksum?: string;
  type?: 'code' | 'doc' | 'config' | 'test' | 'binary';
}

export interface ReceiptMetrics {
  linesAdded?: number;
  linesRemoved?: number;
  filesChanged?: number;
  testsPassed?: number;
  testsFailed?: number;
  coveragePercent?: number;
}

export interface Receipt {
  id: string;
  wihId: string;
  status: ReceiptStatus;
  timestamp: string;
  duration?: number;
  agent?: string;
  attestations: Attestation[];
  artifacts: ReceiptArtifact[];
  metrics?: ReceiptMetrics;
  notes?: string;
  supersedes?: string;
}

// ============================================================================
// Routing Types
// ============================================================================

export type RoutingDecision = 'allow' | 'deny' | 'modify' | 'delegate';

export interface ToolContext {
  toolName: string;
  toolParams: Record<string, unknown>;
  sessionId: string;
  agentId: string;
  workspaceRoot: string;
  wihId?: string;
}

export interface FileContext {
  operation: 'read' | 'write' | 'delete' | 'execute';
  path: string;
  resolvedPath?: string;
  sessionId: string;
  agentId: string;
  wihId?: string;
}

export interface RoutingResult {
  decision: RoutingDecision;
  reason?: string;
  modifiedParams?: Record<string, unknown>;
  delegateTo?: string;
  auditLog?: Record<string, unknown>;
}

/**
 * Routing function interface for A2R Kernel
 * 
 * All routing functions must implement this signature.
 * They receive context about the operation and return a routing decision.
 */
export type RoutingFunction<TContext, TResult extends RoutingResult> = (
  context: TContext,
  kernel: A2RKernel
) => TResult | Promise<TResult>;

export type PreToolUseFunction = RoutingFunction<ToolContext, RoutingResult>;
export type PostToolUseFunction = RoutingFunction<ToolContext & { result: unknown }, RoutingResult>;
export type FileAccessFunction = RoutingFunction<FileContext, RoutingResult>;

// ============================================================================
// Kernel Interface
// ============================================================================

export interface A2RKernel {
  readonly version: string;
  
  // WIH operations
  createWih(item: Omit<WihItem, 'id' | 'createdAt' | 'version'>): Promise<WihItem>;
  getWih(id: string): Promise<WihItem | null>;
  updateWih(id: string, updates: Partial<WihItem>): Promise<WihItem>;
  listWih(filters?: WihFilters): Promise<WihItem[]>;
  
  // Receipt operations
  createReceipt(receipt: Omit<Receipt, 'id' | 'timestamp'>): Promise<Receipt>;
  getReceipt(id: string): Promise<Receipt | null>;
  verifyReceipt(id: string): Promise<boolean>;
  
  // Routing registration
  registerPreToolUse(name: string, fn: PreToolUseFunction): void;
  registerPostToolUse(name: string, fn: PostToolUseFunction): void;
  registerFileAccessCheck(name: string, fn: FileAccessFunction): void;
  
  // Routing execution
  routeToolUse(context: ToolContext): Promise<RoutingResult>;
  routeFileAccess(context: FileContext): Promise<RoutingResult>;
}

export interface WihFilters {
  status?: WihStatus | WihStatus[];
  assignee?: string;
  phase?: string;
  tags?: string[];
  blocked?: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

export class A2RKernelError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'A2RKernelError';
  }
}

export class WihNotFoundError extends A2RKernelError {
  constructor(id: string) {
    super(`WIH item not found: ${id}`, 'WIH_NOT_FOUND', { id });
    this.name = 'WihNotFoundError';
  }
}

export class InvalidReceiptError extends A2RKernelError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'INVALID_RECEIPT', context);
    this.name = 'InvalidReceiptError';
  }
}

export class RoutingDeniedError extends A2RKernelError {
  constructor(
    operation: string,
    reason: string,
    context?: Record<string, unknown>
  ) {
    super(`Routing denied for ${operation}: ${reason}`, 'ROUTING_DENIED', context);
    this.name = 'RoutingDeniedError';
  }
}
