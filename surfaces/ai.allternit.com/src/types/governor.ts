/**
 * Governor/Kernel types for work item management and governance.
 * Extracted from the private @allternit/governor package.
 */

export interface AllternitKernel {
  createWih(item: Partial<WihItem>): Promise<WihItem>;
  getWih(id: string): Promise<WihItem | undefined>;
  updateWih(id: string, updates: Partial<WihItem>): Promise<WihItem>;
  listWih(filters?: WihFilters): Promise<WihItem[]>;
  createReceipt(data: Partial<Receipt>): Promise<Receipt>;
  getReceipt(id: string): Promise<Receipt | undefined>;
  verifyReceipt(id: string): Promise<boolean>;
  registerPreToolUse(handler: PreToolUseFunction): void;
  registerPostToolUse(handler: PostToolUseFunction): void;
  registerFileAccessCheck(handler: FileAccessFunction): void;
  routeToolUse(context: ToolContext): Promise<RoutingResult>;
  routeFileAccess(context: FileContext): Promise<RoutingResult>;
  version: string;
}

export interface WihItem {
  id: string;
  title: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignee?: string;
  phase?: string;
  tags?: string[];
  routing?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  [key: string]: unknown;
}

export interface WihFilters {
  status?: string[];
  priority?: string[];
  assignee?: string[];
  phase?: string[];
  tags?: string[];
  [key: string]: unknown;
}

export interface Receipt {
  id: string;
  timestamp: number;
  status: 'valid' | 'invalid' | 'pending';
  attestations: Array<{
    verifier: string;
    timestamp: number;
    valid: boolean;
  }>;
}

export type PreToolUseFunction = (context: ToolContext) => Promise<RoutingResult>;
export type PostToolUseFunction = (context: ToolContext, result: unknown) => Promise<void>;
export type FileAccessFunction = (context: FileContext) => Promise<RoutingResult>;

export interface ToolContext {
  toolName: string;
  input: unknown;
  agentId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

export interface FileContext {
  path: string;
  operation: 'read' | 'write' | 'delete';
  agentId?: string;
  [key: string]: unknown;
}

export interface RoutingResult {
  decision: 'allow' | 'deny' | 'require_approval' | 'defer';
  reason?: string;
  metadata?: Record<string, unknown>;
}
