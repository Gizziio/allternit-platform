declare module '@allternit/runtime' {
  export interface RuntimeBridge {
    send(msg: unknown): Promise<unknown>;
    close(): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    kernel: any;
  }
  export function createRuntimeBridge(config: {
    kernel?: unknown;
    enforceWih?: boolean;
    auditLogging?: { enabled: boolean };
  } | string): RuntimeBridge;
}

declare module '@allternit/governor' {
  export interface RoutingResult { [key: string]: unknown; }
  export interface ToolContext { path?: string; operation?: string; [key: string]: unknown; }
  export interface FileContext { path?: string; operation?: string; [key: string]: unknown; }
  export type PreToolUseFunction = (ctx: ToolContext, kernel: AllternitKernel) => RoutingResult | Promise<RoutingResult>;
  export type PostToolUseFunction = (ctx: ToolContext, kernel: AllternitKernel) => RoutingResult | Promise<RoutingResult>;
  export type FileAccessFunction = (ctx: FileContext, kernel: AllternitKernel) => RoutingResult | Promise<RoutingResult>;
  export interface WihItem {
    id: string;
    title?: string;
    description?: string;
    status: string;
    priority?: number;
    tags: string[];
    blockedBy?: string[];
    blocks?: string[];
    phase?: string;
    assignee?: string;
    completedAt?: string;
    updatedAt: string;
    createdAt?: string;
    version?: string;
    estimatedEffort?: unknown;
    actualEffort?: unknown;
    receiptRefs?: string[];
    artifacts?: unknown[];
    routing?: unknown;
    [key: string]: unknown;
  }
  export interface WihFilters {
    status?: string | string[];
    tags?: string[];
    assignee?: string;
    phase?: string;
    blocked?: boolean;
    [key: string]: unknown;
  }
  export interface Receipt {
    id: string;
    timestamp: string;
    status: string;
    attestations: unknown[];
    [key: string]: unknown;
  }
  export interface AllternitKernel {
    createWih(item: Partial<WihItem>): Promise<WihItem>;
    getWih(id: string): Promise<WihItem | null>;
    updateWih(id: string, updates: Partial<WihItem>): Promise<WihItem>;
    listWih(filters?: WihFilters): Promise<WihItem[]>;
    createReceipt(receipt: Omit<Receipt, 'id' | 'timestamp'>): Promise<Receipt>;
    getReceipt(id: string): Promise<Receipt | null>;
    verifyReceipt(id: string): Promise<boolean>;
    registerPreToolUse(name: string, fn: PreToolUseFunction): void;
    registerPostToolUse(name: string, fn: PostToolUseFunction): void;
    registerFileAccessCheck(name: string, fn: FileAccessFunction): void;
    routeToolUse(context: ToolContext): Promise<RoutingResult>;
    routeFileAccess(context: FileContext): Promise<RoutingResult>;
    [key: string]: unknown;
  }
}

declare module '@gizzi/workspace-loader' {
  export interface WorkspaceContext {
    path?: string;
    content?: string;
    gizziMd?: string;
    governance?: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  }
  export interface LoadWorkspaceOptions {
    workspacePath?: string;
    path?: string;
    subdirectory?: string;
    skipGlobal?: boolean;
    skipWorkspace?: boolean;
  }
  export function loadWorkspaceContext(options: LoadWorkspaceOptions): Promise<WorkspaceContext>;
  export function buildContextPack(context: WorkspaceContext): string;
  export function buildSystemPrompt(contextPack: string | WorkspaceContext): string;
}

declare module '@allternit/mcp-apps-adapter' {
  export interface McpAppsAdapter {
    [key: string]: unknown;
  }
  export function createMcpAppsAdapter(config?: unknown): McpAppsAdapter;
  export interface CapsulePermission {
    permission_type: string;
    resource: string;
    actions?: string[];
    [key: string]: unknown;
  }
  export interface InteractiveCapsule {
    id: string;
    type: string;
    state: string;
    toolId?: string;
    [key: string]: unknown;
  }
  export interface CapsuleEvent {
    id: string;
    capsuleId: string;
    direction: string;
    type: string;
    payload?: unknown;
    timestamp: string;
    source?: string;
    [key: string]: unknown;
  }
}

declare module '@modelcontextprotocol/ext-apps/app-bridge' {
  export class AppBridge {
    constructor(...args: unknown[]);
    sendToolInput(input: unknown): void;
    sendToolResult(result: unknown): void;
    setRequestHandler(schema: unknown, handler: (...args: any[]) => any): void;
    setHostContext(ctx: unknown): void;
    connect(transport: unknown): Promise<void>;
    close(): Promise<void>;
    [key: string]: unknown;
  }
  export class PostMessageTransport {
    constructor(source: Window | HTMLIFrameElement, ...args: unknown[]);
    [key: string]: unknown;
  }
  export interface McpUiHostContext { [key: string]: unknown; }
}

declare module '../dev-portal/src/App' {
  import type { ComponentType } from 'react';
  const App: ComponentType<Record<string, unknown>>;
  export default App;
}
