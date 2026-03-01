# LAYER BOUNDARY CONTRACTS

TypeScript interfaces defining the contracts between each layer in the A2R architecture.

## Layer 0-substrate/ Contracts
**Purpose**: Shared foundations, types, utilities, protocols

```typescript
// 0-substrate/types/contracts.ts
export interface A2RPrimitive {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface A2RProtocol {
  version: string;
  validate(data: any): boolean;
}

export interface A2RConfig {
  [key: string]: any;
}

export interface A2RLogger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}
```

## Layer 1-kernel/ Contracts
**Purpose**: Execution engine, sandboxing, process management

```typescript
// 1-kernel/contracts/execution.ts
import type { A2RPrimitive } from '../../0-substrate/types/contracts';

export interface ExecutionRequest {
  id: string;
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface ExecutionResult {
  id: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  resourcesUsed: ResourceUsage;
}

export interface ResourceUsage {
  cpuTimeMs: number;
  memoryPeakKb: number;
  networkBytes: number;
  filesystemOps: number;
}

export interface ExecutionEngine {
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
  sandbox(code: string, context?: any): Promise<ExecutionResult>;
  terminate(processId: string): Promise<boolean>;
}

export interface FileOperationRequest {
  operation: 'read' | 'write' | 'delete' | 'list';
  path: string;
  content?: string;
  options?: any;
}

export interface FileOperationResult {
  success: boolean;
  content?: string;
  error?: string;
  stats?: any;
}
```

## Layer 2-governance/ Contracts
**Purpose**: Policy enforcement, WIH, receipts, audit trails

```typescript
// 2-governance/contracts/policy.ts
import type { A2RPrimitive } from '../../0-substrate/types/contracts';
import type { ExecutionRequest, ExecutionResult } from '../../1-kernel/contracts/execution';

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  condition: string; // Expression or function
  action: 'allow' | 'deny' | 'approve' | 'restrict';
  priority: number;
}

export interface WorkItem {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';
  createdAt: Date;
  submittedAt?: Date;
  approvedAt?: Date;
  completedAt?: Date;
  submitter: string;
  approvers: string[];
  policyRules: PolicyRule[];
  metadata: Record<string, any>;
}

export interface Receipt {
  id: string;
  operation: string;
  actor: string;
  timestamp: Date;
  inputs: any;
  outputs: any;
  policyApplied: PolicyRule[];
  decision: 'approved' | 'rejected' | 'monitored';
  evidence: string[];
}

export interface PolicyEngine {
  evaluate(request: ExecutionRequest, context: any): Promise<PolicyDecision>;
  createWorkItem(item: WorkItem): Promise<WorkItem>;
  approveWorkItem(itemId: string, approver: string): Promise<boolean>;
  getReceipt(operationId: string): Promise<Receipt | null>;
  logReceipt(receipt: Receipt): Promise<void>;
}

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  requiredApprovals: string[];
  restrictions: any[];
}
```

## Layer 3-adapters/ Contracts
**Purpose**: Runtime boundary, vendor integration, protocol adapters

```typescript
// 3-adapters/contracts/runtime.ts
import type { A2RPrimitive } from '../../0-substrate/types/contracts';
import type { ExecutionRequest, ExecutionResult } from '../../1-kernel/contracts/execution';
import type { WorkItem, PolicyDecision, Receipt } from '../../2-governance/contracts/policy';

export interface RuntimeConfig {
  enforcePolicy: boolean;
  auditLogging: boolean;
  allowedWorkspaces: string[];
  resourceLimits: ResourceLimits;
}

export interface ResourceLimits {
  maxProcesses: number;
  maxMemoryMb: number;
  maxNetworkBytes: number;
  maxFilesystemOps: number;
  maxExecutionTimeMs: number;
}

export interface RuntimeBridge {
  executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResult>;
  executeFileOperation(request: FileOperationRequest): Promise<FileOperationResult>;
  createSession(context: SessionContext): Promise<Session>;
  getSession(sessionId: string): Promise<Session | null>;
  listSessions(): Promise<Session[]>;
  auditLog(entry: AuditLogEntry): Promise<void>;
  getAuditLogs(filter?: AuditLogFilter): Promise<AuditLogEntry[]>;
}

export interface ToolExecutionRequest {
  id: string;
  toolId: string;
  parameters: any;
  context: ToolExecutionContext;
  identityId: string;
  sessionId: string;
  tenantId: string;
  traceId?: string;
  retryCount?: number;
  idempotencyKey?: string;
}

export interface ToolExecutionResult {
  executionId: string;
  toolId: string;
  input: any;
  output?: any;
  error?: string;
  stdout: string;
  stderr: string;
  exitCode?: number;
  executionTimeMs: number;
  resourcesUsed: ResourceUsage;
  timestamp: number;
}

export interface ToolExecutionContext {
  userId: string;
  sessionId: string;
  taskId: string;
  permissions: string[];
  currentWih?: WorkItem;
}

export interface Session {
  id: string;
  userId: string;
  startedAt: Date;
  lastActivityAt: Date;
  status: 'active' | 'idle' | 'terminated';
  context: any;
}

export interface SessionContext {
  userId: string;
  sessionId?: string;
  taskId?: string;
  wihId?: string;
  permissions: string[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  operation: string;
  actor: string;
  target: string;
  inputs: any;
  outputs: any;
  decision: string;
  policyApplied: string[];
  session?: string;
  traceId?: string;
}

export interface AuditLogFilter {
  from?: Date;
  to?: Date;
  operation?: string;
  actor?: string;
  session?: string;
  decision?: string;
}
```

## Layer 4-services/ Contracts
**Purpose**: Orchestration services, schedulers, coordinators

```typescript
// 4-services/contracts/orchestration.ts
import type { A2RPrimitive } from '../../0-substrate/types/contracts';
import type { RuntimeBridge } from '../../3-adapters/contracts/runtime';

export interface ServiceConfig {
  name: string;
  port?: number;
  host?: string;
  enabled: boolean;
  dependencies: string[];
  healthCheckPath?: string;
}

export interface Service {
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): ServiceStatus;
  getConfig(): ServiceConfig;
}

export interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error';
  uptime?: number;
  health: 'healthy' | 'unhealthy' | 'degraded';
  error?: string;
}

export interface Orchestrator {
  registerService(service: Service): Promise<void>;
  startService(name: string): Promise<void>;
  stopService(name: string): Promise<void>;
  listServices(): Promise<ServiceInfo[]>;
  getServiceStatus(name: string): Promise<ServiceStatus>;
}

export interface ServiceInfo {
  name: string;
  status: ServiceStatus;
  endpoint?: string;
  dependencies: string[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'critical';
  assignedTo?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  dependencies: string[];
  resources: ResourceRequirements;
  context: any;
}

export interface ResourceRequirements {
  cpu: number; // cores
  memory: number; // MB
  storage: number; // MB
  network: 'low' | 'normal' | 'high';
}

export interface TaskScheduler {
  scheduleTask(task: Task): Promise<string>;
  cancelTask(taskId: string): Promise<boolean>;
  getTask(taskId: string): Promise<Task | null>;
  listTasks(filter?: TaskFilter): Promise<Task[]>;
  executeTask(taskId: string): Promise<TaskResult>;
}

export interface TaskFilter {
  status?: string;
  priority?: string;
  assignedTo?: string;
  from?: Date;
  to?: Date;
}

export interface TaskResult {
  taskId: string;
  status: 'success' | 'failure' | 'partial';
  output?: any;
  error?: string;
  executionTimeMs: number;
  resourcesUsed: ResourceUsage;
}
```

## Layer 5-ui/ Contracts
**Purpose**: UI components, platform primitives, design system

```typescript
// 5-ui/contracts/platform.ts
import type { A2RPrimitive } from '../../0-substrate/types/contracts';
import type { RuntimeBridge } from '../../3-adapters/contracts/runtime';

export interface ShellConfig {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  compactMode: boolean;
  sidebarCollapsed: boolean;
}

export interface ShellState {
  config: ShellConfig;
  activeView: ViewId;
  openViews: ViewId[];
  sidebarVisible: boolean;
  drawerOpen: boolean;
  notifications: Notification[];
}

export interface View {
  id: ViewId;
  type: ViewType;
  title: string;
  component: React.ComponentType<ViewProps>;
  props?: any;
  closable: boolean;
  pinned: boolean;
}

export type ViewId = string;
export type ViewType = 
  | 'home'
  | 'chat' 
  | 'workspace'
  | 'browser'
  | 'studio'
  | 'marketplace'
  | 'registry'
  | 'memory'
  | 'settings'
  | 'terminal'
  | 'runner'
  | 'code';

export interface ViewProps {
  context: ViewContext;
  runtime: RuntimeBridge;
}

export interface ViewContext {
  viewId: ViewId;
  viewType: ViewType;
  capsuleId?: string;
  title?: string;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  dismissible: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ShellPlatform {
  initialize(config: ShellConfig): Promise<void>;
  openView(viewType: ViewType, context?: ViewContext): Promise<ViewId>;
  closeView(viewId: ViewId): Promise<boolean>;
  updateView(viewId: ViewId, props: any): Promise<boolean>;
  showNotification(notification: Notification): void;
  getShellState(): ShellState;
  setShellConfig(config: ShellConfig): void;
}

export interface UIComponent {
  render(props: any): React.ReactElement;
  getDisplayName(): string;
  getPropsSchema?(): any; // JSON Schema for props
}
```

## Layer 6-apps/ Contracts
**Purpose**: Application entrypoints, distribution targets

```typescript
// 6-apps/contracts/entrypoints.ts
import type { A2RPrimitive } from '../../0-substrate/types/contracts';
import type { ShellPlatform } from '../../5-ui/contracts/platform';

export interface AppManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  entrypoint: string; // Path to main file
  dependencies: string[];
  permissions: Permission[];
  configSchema?: any; // JSON Schema
}

export interface Permission {
  name: string;
  description: string;
  required: boolean;
  granted: boolean;
}

export interface AppEnvironment {
  platform: ShellPlatform;
  runtime: RuntimeBridge;
  config: any;
  logger: A2RLogger;
}

export interface App {
  start(env: AppEnvironment): Promise<void>;
  stop(): Promise<void>;
  getStatus(): AppStatus;
  getConfig(): AppManifest;
}

export interface AppStatus {
  running: boolean;
  uptime?: number;
  memoryUsage?: number;
  cpuUsage?: number;
  error?: string;
}

export interface AppHost {
  launchApp(manifest: AppManifest, env: AppEnvironment): Promise<App>;
  listApps(): Promise<AppInfo[]>;
  getAppStatus(appId: string): Promise<AppStatus>;
  terminateApp(appId: string): Promise<boolean>;
}

export interface AppInfo {
  id: string;
  name: string;
  version: string;
  status: AppStatus;
  permissions: Permission[];
}
```

## Cross-Layer Integration Contracts

### UI → Runtime Boundary
```typescript
// The primary contract that UI components use to interact with the runtime
export interface UIRuntimeInterface {
  // Tool execution
  executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResult>;
  
  // Session management
  createSession(context: SessionContext): Promise<Session>;
  getCurrentSession(): Session | null;
  
  // Audit and policy
  getPolicyStatus(): Promise<PolicyStatus>;
  requestApproval(workItem: WorkItem): Promise<WorkItem>;
  
  // File operations
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<boolean>;
  
  // Event subscription
  subscribeToEvents(handler: (event: any) => void): () => void;
}
```

These interfaces establish the proper boundaries between layers while maintaining the architectural integrity of the A2R system. Each layer can only import from lower layers (0-substrate, 1-kernel, 2-governance, etc.) and must use the defined contracts to communicate across layer boundaries.