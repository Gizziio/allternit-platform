/**
 * Unified Agent Store - Single source of truth for Rails/DAK integration
 * 
 * Combines:
 * - Rails API: DAGs, WIHs, Leases, Mail, Ledger
 * - DAK Runner: Templates, Snapshots, Context Packs
 * - Context State: Current mode, selected entities
 * - UI State: Loading, errors, active tabs
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { railsApi } from "./rails.service";
import type {
  WihInfo,
  ManagedLease,
  ContextPack,
  Receipt,
  ReceiptQueryRequest,
  LedgerEvent,
  MailThread,
  MailMessage,
  DagMutation,
} from "./rails.service";

// ============================================================================
// Types
// ============================================================================

export type ContextMode = 
  | "idle"
  | "planning" 
  | "executing" 
  | "working" 
  | "reviewing" 
  | "monitoring";

export type MainTab = "plan" | "work" | "status" | "mail" | "tools" | "audit";
export type DrawerTab = "queue" | "terminal" | "logs" | "executions" | "agents" | "scheduler" | "context";

export interface DagDefinition {
  dagId: string;
  version: string;
  createdAt: string;
  nodes: DagNode[];
  edges: DagEdge[];
  metadata?: {
    title?: string;
    description?: string;
  };
}

export interface DagNode {
  nodeId: string;
  title: string;
  description?: string;
  status: "pending" | "ready" | "running" | "blocked" | "review" | "completed" | "failed";
  dependencies: string[];
  assignee?: string;
  wihId?: string;
}

export interface DagEdge {
  from: string;
  to: string;
}

export interface DagExecution {
  runId: string;
  dagId: string;
  status: "running" | "completed" | "failed" | "cancelled";
  startedAt: number;
  endedAt?: number;
  progress: number;
  completedNodes: string[];
  failedNodes: string[];
  blockedNodes: string[];
}

export interface AgentInfo {
  agentId: string;
  name: string;
  role: string;
  status: "working" | "waiting" | "idle";
  currentWihId?: string;
  currentDagId?: string;
  lastActiveAt: number;
}

export interface SystemHealth {
  rails: boolean;
  gateway: boolean;
  version: string;
  timestamp: number;
}

export interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  template: string;
  variables: TemplateVariable[];
  version: string;
  tags: string[];
}

export interface TemplateVariable {
  name: string;
  description: string;
  required: boolean;
  type: "string" | "number" | "boolean" | "array";
  defaultValue?: string | number | boolean;
}

export interface ToolSnapshot {
  snapshotId: string;
  toolName: string;
  createdAt: number;
  size: number;
  hash: string;
}

export interface SnapshotStats {
  total: number;
  totalSize: number;
  oldestSnapshot?: number;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  source: "local" | "rails";
  runId?: string;
  dagId?: string;
  wihId?: string;
  threadId?: string;
}

export type TimelineEntryType = "message" | "ledger" | "receipt";

export interface TimelineEntry {
  timestamp: number;
  label: string;
  type: TimelineEntryType;
  speaker?: string;
  detail?: string;
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
  cached?: number;
}

export interface ModelUsageSummary {
  messages: number;
  toolCalls: number;
  lastUsedAt: number;
  avgLatencyMs?: number;
}

export interface ToolUsageEntry {
  name: string;
  count: number;
  lastUsedAt: number;
}

export interface SessionDuration {
  startedAt: number;
  lastActivityAt: number;
  minutes: number;
}

export interface SessionAnalytics {
  threadId: string;
  totalMessages: number;
  unreadMessages: number;
  participants: string[];
  lastMessageAt?: string;
  ledgerEventCount: number;
  toolCallCount: number;
  toolNames: string[];
  logEntryCount: number;
  lastEventType?: string;
  receiptKinds: Record<string, number>;
  estimatedCost?: number;
  summary: string[];
  timeline?: TimelineEntry[];
  tokenUsage?: TokenUsage;
  modelUsage?: Record<string, ModelUsageSummary>;
  toolUsage?: ToolUsageEntry[];
  sessionDuration?: SessionDuration;
  status?: "active" | "idle" | "complete" | "error";
}

export interface ScheduledJob {
  jobId: string;
  title: string;
  dagId: string;
  schedule: string; // cron expression
  status: "active" | "paused";
  lastRun?: number;
  nextRun?: number;
}

// ============================================================================
// Store Interface
// ============================================================================

interface UnifiedStore {
  // Connection State
  health: SystemHealth;
  isLoading: boolean;
  error: string | null;
  lastSync: number;
  
  // Context State
  contextMode: ContextMode;
  selectedDagId: string | null;
  selectedWihId: string | null;
  selectedRunId: string | null;
  selectedThreadId: string | null;
  contextMetadata: Record<string, unknown>;
  
  // Data State
  dags: DagDefinition[];
  executions: DagExecution[];
  wihs: WihInfo[];
  myWihs: WihInfo[];
  leases: ManagedLease[];
  contextPacks: ContextPack[];
  receipts: Receipt[];
  ledgerEvents: LedgerEvent[];
  mailThreads: MailThread[];
  mailMessages: MailMessage[];
  agents: AgentInfo[];
  templates: PromptTemplate[];
  snapshots: ToolSnapshot[];
  snapshotStats?: SnapshotStats;
  scheduledJobs: ScheduledJob[];
  logs: LogEntry[];
  
  // UI State
  activeMainTab: MainTab;
  activeDrawerTab: DrawerTab;
  drawerOpen: boolean;
  drawerHeight: number;
  sidebarOpen: boolean;
  mailUnreadCount: number;
  
  // Computed/Getters (derived from state)
  currentDag: DagDefinition | null;
  currentWih: WihInfo | null;
  currentExecution: DagExecution | null;
  getSessionAnalytics: (threadId: string) => SessionAnalytics;
  
  // Actions - Connection
  checkHealth: () => Promise<void>;
  syncAll: () => Promise<void>;
  clearError: () => void;
  
  // Actions - Context
  setContextMode: (mode: ContextMode) => void;
  selectDag: (dagId: string | null) => void;
  selectWih: (wihId: string | null) => void;
  selectRun: (runId: string | null) => void;
  selectThread: (threadId: string | null) => void;
  setContextMetadata: (key: string, value: unknown) => void;
  clearContext: () => void;
  
  // Actions - DAGs
  fetchDags: () => Promise<void>;
  createDag: (text: string, dagId?: string) => Promise<string>;
  refineDag: (dagId: string, delta: string, reason?: string, mutations?: DagMutation[]) => Promise<void>;
  executeDag: (dagId: string) => Promise<string>;
  cancelExecution: (runId: string) => Promise<void>;
  fetchDagDetails: (dagId: string) => Promise<DagDefinition | null>;
  
  // Actions - WIHs
  fetchWihs: (dagId?: string) => Promise<void>;
  pickupWih: (dagId: string, nodeId: string, agentId: string, role?: string) => Promise<string>;
  closeWih: (wihId: string, status: "completed" | "failed" | "cancelled", evidence?: string[]) => Promise<void>;
  
  // Actions - Leases
  fetchLeases: () => Promise<void>;
  requestLease: (wihId: string, agentId: string, paths: string[], ttlSeconds?: number) => Promise<string>;
  renewLease: (leaseId: string) => Promise<void>;
  releaseLease: (leaseId: string) => Promise<void>;
  
  // Actions - Context Packs
  fetchContextPacks: (dagId?: string, nodeId?: string, wihId?: string) => Promise<void>;
  sealContextPack: (dagId: string, nodeId: string, wihId: string) => Promise<string>;
  
  // Actions - Receipts
  fetchReceipts: (query?: ReceiptQueryRequest) => Promise<void>;
  
  // Actions - Ledger
  fetchLedgerEvents: (count?: number) => Promise<void>;
  traceEvents: (nodeId?: string, wihId?: string) => Promise<void>;
  
  // Actions - Mail
  fetchMailThreads: () => Promise<void>;
  fetchMailMessages: (threadId?: string) => Promise<void>;
  sendMail: (threadId: string, body: string) => Promise<void>;
  requestReview: (threadId: string, wihId: string, diffRef: string) => Promise<void>;
  decideReview: (threadId: string, approve: boolean, notes?: string) => Promise<void>;
  ackMessage: (threadId: string, messageId: string, note?: string) => Promise<void>;
  
  // Actions - Agents (derived from WIHs)
  fetchAgents: () => Promise<void>;
  
  // Actions - Templates
  fetchTemplates: () => Promise<void>;
  executeTemplate: (templateId: string, variables: Record<string, unknown>) => Promise<void>;
  
  // Actions - Snapshots
  fetchSnapshots: () => Promise<void>;
  clearSnapshot: (snapshotId: string) => Promise<void>;
  clearAllSnapshots: () => Promise<void>;
  
  // Actions - Scheduler
  fetchScheduledJobs: () => Promise<void>;
  pauseJob: (jobId: string) => Promise<void>;
  resumeJob: (jobId: string) => Promise<void>;
  
  // Actions - Logs
  addLog: (entry: Omit<LogEntry, "id">) => void;
  clearLogs: () => void;
  
  // Actions - UI
  setActiveMainTab: (tab: MainTab) => void;
  setActiveDrawerTab: (tab: DrawerTab) => void;
  toggleDrawer: () => void;
  setDrawerHeight: (height: number) => void;
  toggleSidebar: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function createLogEntry(entry: Omit<LogEntry, "id">): LogEntry {
  return {
    ...entry,
    id: generateId(),
  };
}

function buildSessionAnalytics(state: UnifiedStore, threadId: string): SessionAnalytics {
  const messages = state.mailMessages.filter((msg) => msg.thread_id === threadId);
  const participants = Array.from(
    new Set(messages.flatMap((msg) => (msg.from_agent ? [msg.from_agent] : [])))
  );
  const ledgerEvents = state.ledgerEvents.filter((event) => {
    const payload = event.payload as Record<string, unknown>;
    if (!payload || typeof payload !== "object") return false;
    return payload["thread_id"] === threadId || payload["mail_thread_id"] === threadId;
  });
  const logEntries = state.logs.filter((log) => log.threadId === threadId);
  const receiptsForThread = state.receipts.filter((receipt) =>
    receiptMatchesThread(receipt, threadId, state)
  );
  const receiptKindCounts = receiptsForThread.reduce<Record<string, number>>((acc, receipt) => {
    acc[receipt.kind] = (acc[receipt.kind] || 0) + 1;
    return acc;
  }, {});
  const toolReceipts = receiptsForThread.filter((receipt) => receipt.kind === "tool_call_post");
  const receiptCost = receiptsForThread.reduce(
    (sum, receipt) => sum + extractReceiptCost(receipt.payload),
    0
  );
  const timeline: TimelineEntry[] = [];
  const toolUsage: Record<string, ToolUsageEntry> = {};
  const modelUsage: Record<string, ModelUsageSummary> = {};
  let tokenUsage: TokenUsage | undefined;
  messages.forEach((msg) => {
    timeline.push({
      timestamp: new Date(msg.timestamp).getTime(),
      label: msg.body,
      type: "message",
      speaker: msg.from_agent,
    });
  });
  ledgerEvents.forEach((event) => {
    timeline.push({
      timestamp: new Date(event.timestamp).getTime(),
      label: event.event_type,
      type: "ledger",
      detail:
        typeof event.payload === "object" ? JSON.stringify(event.payload).slice(0, 200) : undefined,
    });
  });
  receiptsForThread.forEach((receipt) => {
    const payload = receipt.payload as Record<string, unknown> | null;
    const ts = new Date(receipt.timestamp).getTime();
    if (payload) {
      const toolName = (payload["tool"] as string) || (payload["tool_name"] as string);
      const modelName = (payload["model"] as string) || (payload["model_name"] as string);
      const usage = payload["usage"] as Record<string, unknown> | undefined;
      if (toolName) {
        const entry = toolUsage[toolName] || { name: toolName, count: 0, lastUsedAt: 0 };
        entry.count += 1;
        entry.lastUsedAt = Math.max(entry.lastUsedAt, ts);
        toolUsage[toolName] = entry;
      }
      if (modelName) {
        const entry = modelUsage[modelName] || { messages: 0, toolCalls: 0, lastUsedAt: 0 };
        entry.toolCalls += 1;
        entry.lastUsedAt = Math.max(entry.lastUsedAt, ts);
        modelUsage[modelName] = entry;
      }
      if (usage) {
        const inputTokens = Number(usage["input_tokens"] || usage["prompt_tokens"] || 0);
        const outputTokens = Number(usage["output_tokens"] || usage["completion_tokens"] || 0);
        const totalTokens = Number(usage["total_tokens"] || inputTokens + outputTokens);
        if (!Number.isNaN(totalTokens)) {
          if (!tokenUsage) {
            tokenUsage = { input: 0, output: 0, total: 0 };
          }
          tokenUsage.input += Math.max(0, inputTokens);
          tokenUsage.output += Math.max(0, outputTokens);
          tokenUsage.total += Math.max(0, totalTokens);
        }
      }
    }
    if (receipt.kind === "tool_call_post") {
      timeline.push({
        timestamp: ts,
        label: `Tool ${toolUsage[receipt.payload as string]?.name ?? "call"} result`,
        type: "receipt",
      });
    }
  });
  const sortedTimeline = timeline.sort((a, b) => a.timestamp - b.timestamp);
  const summary: string[] = [
    `Messages: ${messages.length}`,
    `Ledger events: ${ledgerEvents.length}`,
    `Log entries: ${logEntries.length}`,
    `Tool calls: ${toolReceipts.length}`,
    receiptCost > 0 ? `Est. cost: $${receiptCost.toFixed(2)}` : "",
    Object.keys(receiptKindCounts).length
      ? `Receipts: ${Object.entries(receiptKindCounts)
          .map(([kind, count]) => `${kind}(${count})`)
          .join(", ")}`
      : "",
  ];
  const lastMessage = messages.length ? messages[messages.length - 1] : undefined;
  const lastLedgerEvent = ledgerEvents.length ? ledgerEvents[ledgerEvents.length - 1] : undefined;
  if (messages.length) {
    summary.push(`Last message: ${new Date(lastMessage!.timestamp).toLocaleString()}`);
  }
  if (ledgerEvents.length) {
    summary.push(`Last event: ${lastLedgerEvent!.event_type}`);
  }
  return {
    threadId,
    totalMessages: messages.length,
    unreadMessages: messages.filter((msg) => !msg.acknowledged).length,
    participants,
    lastMessageAt: lastMessage?.timestamp,
    ledgerEventCount: ledgerEvents.length,
    toolCallCount: toolReceipts.length,
    toolNames: Array.from(new Set(toolReceipts.map((receipt) => (receipt.payload as Record<string, unknown> | null)?.["tool"] as string).filter(Boolean))),
    logEntryCount: logEntries.length,
    lastEventType: lastLedgerEvent?.event_type,
    receiptKinds: receiptKindCounts,
    estimatedCost: receiptCost > 0 ? receiptCost : undefined,
    summary: summary.filter(Boolean) as string[],
    timeline: sortedTimeline,
    tokenUsage,
    modelUsage: Object.keys(modelUsage).length ? modelUsage : undefined,
    toolUsage: Object.values(toolUsage),
    sessionDuration: messages.length
      ? {
          startedAt: new Date(messages[0].timestamp).getTime(),
          lastActivityAt: new Date(messages[messages.length - 1].timestamp).getTime(),
          minutes:
            (new Date(messages[messages.length - 1].timestamp).getTime() -
              new Date(messages[0].timestamp).getTime()) /
            60000,
        }
      : undefined,
    status: logEntries.some((log) => log.level === "error")
      ? "error"
      : ledgerEvents.length
      ? "active"
      : messages.length
      ? "idle"
      : "idle",
  };
}

function receiptMatchesThread(receipt: Receipt, threadId: string, state: UnifiedStore): boolean {
  const { selectedRunId, selectedWihId } = state;
  const payload = receipt.payload as Record<string, unknown> | null;
  if (payload) {
    if (payload["thread_id"] === threadId || payload["mail_thread_id"] === threadId) {
      return true;
    }
    if (selectedRunId && payload["run_id"] === selectedRunId) {
      return true;
    }
    if (selectedWihId && payload["wih_id"] === selectedWihId) {
      return true;
    }
  }
  if (receipt.run_id && selectedRunId && receipt.run_id === selectedRunId) {
    return true;
  }
  return false;
}

function extractReceiptCost(payload: unknown): number {
  if (!payload || typeof payload !== "object") return 0;
  const map = payload as Record<string, unknown>;
  const costFields = ["cost", "estimated_cost", "total_cost", "usd", "value"];
  for (const key of costFields) {
    const value = map[key];
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = parseFloat(value);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  const usage = map["usage"];
  if (usage && typeof usage === "object") {
    for (const key of costFields) {
      const value = (usage as Record<string, unknown>)[key];
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const parsed = parseFloat(value);
        if (!Number.isNaN(parsed)) return parsed;
      }
    }
  }
  return 0;
}

// ============================================================================
// PFS v1 Templates (Production-ready)
// ============================================================================

const PRODUCTION_TEMPLATES: PromptTemplate[] = [
  {
    id: "core/system",
    name: "System Prompt",
    category: "core",
    description: "Base system prompt establishing agent identity and capabilities",
    template: "You are {{role}}. Your capabilities: {{capabilities}}. Rules: {{rules}}",
    variables: [
      { name: "role", description: "Agent role", required: true, type: "string" },
      { name: "capabilities", description: "Comma-separated capabilities", required: true, type: "string" },
      { name: "rules", description: "Behavioral rules", required: false, defaultValue: "Follow best practices", type: "string" },
    ],
    version: "1.0.0",
    tags: ["core", "system"],
  },
  {
    id: "roles/builder",
    name: "Builder Role",
    category: "roles",
    description: "Prompt for builder agents that implement features",
    template: "You are a Builder agent. Task: {{task}}. Scope: {{scope}}. Dependencies: {{dependencies}}",
    variables: [
      { name: "task", description: "What to build", required: true, type: "string" },
      { name: "scope", description: "Files/directories to modify", required: true, type: "string" },
      { name: "dependencies", description: "Required dependencies", required: false, defaultValue: "None", type: "string" },
    ],
    version: "1.0.0",
    tags: ["role", "builder"],
  },
  {
    id: "roles/validator",
    name: "Validator Role",
    category: "roles",
    description: "Prompt for validator agents that verify work",
    template: "You are a Validator agent. Validate: {{artifact}}. Criteria: {{criteria}}. Standards: {{standards}}",
    variables: [
      { name: "artifact", description: "What to validate", required: true, type: "string" },
      { name: "criteria", description: "Validation criteria", required: true, type: "string" },
      { name: "standards", description: "Standards to check against", required: false, defaultValue: "Project standards", type: "string" },
    ],
    version: "1.0.0",
    tags: ["role", "validator"],
  },
  {
    id: "orch/dag-topo",
    name: "DAG Topology",
    category: "orchestration",
    description: "Generate DAG structure from natural language",
    template: "Create a DAG for: {{goal}}. Constraints: {{constraints}}. Max depth: {{maxDepth}}",
    variables: [
      { name: "goal", description: "What the DAG should accomplish", required: true, type: "string" },
      { name: "constraints", description: "Execution constraints", required: false, type: "string" },
      { name: "maxDepth", description: "Maximum DAG depth", required: false, defaultValue: "5", type: "number" },
    ],
    version: "1.0.0",
    tags: ["orchestration", "dag"],
  },
  {
    id: "plan/three-pass",
    name: "Three-Pass Planning",
    category: "planning",
    description: "Structured three-pass planning approach",
    template: "Phase 1 (Analysis): {{phase1}}\nPhase 2 (Design): {{phase2}}\nPhase 3 (Implementation): {{phase3}}",
    variables: [
      { name: "phase1", description: "Analysis phase tasks", required: true, type: "string" },
      { name: "phase2", description: "Design phase tasks", required: true, type: "string" },
      { name: "phase3", description: "Implementation phase tasks", required: true, type: "string" },
    ],
    version: "1.0.0",
    tags: ["planning", "structured"],
  },
  {
    id: "cleanup/artifact",
    name: "Artifact Cleanup",
    category: "cleanup",
    description: "Clean up generated artifacts",
    template: "Cleanup mode: {{mode}}. Target artifacts: {{targets}}. Preserve: {{preserve}}",
    variables: [
      { name: "mode", description: "Cleanup mode (aggressive/safe)", required: true, type: "string" },
      { name: "targets", description: "What to clean", required: true, type: "string" },
      { name: "preserve", description: "What to preserve", required: false, type: "string" },
    ],
    version: "1.0.0",
    tags: ["cleanup", "maintenance"],
  },
  {
    id: "control/branch",
    name: "Conditional Branch",
    category: "control_flow",
    description: "Conditional execution based on context",
    template: "Condition: {{condition}}. If true: {{thenBranch}}. If false: {{elseBranch}}",
    variables: [
      { name: "condition", description: "Condition to evaluate", required: true, type: "string" },
      { name: "thenBranch", description: "Execute if true", required: true, type: "string" },
      { name: "elseBranch", description: "Execute if false", required: false, type: "string" },
    ],
    version: "1.0.0",
    tags: ["control", "conditional"],
  },
  {
    id: "evidence/context",
    name: "Context Pack Builder",
    category: "evidence",
    description: "Build context pack for node execution",
    template: "Build context for node {{nodeId}} in DAG {{dagId}}. Include: WIH, receipts, dependencies.",
    variables: [
      { name: "nodeId", description: "Target node ID", required: true, type: "string" },
      { name: "dagId", description: "DAG ID", required: true, type: "string" },
    ],
    version: "1.0.0",
    tags: ["evidence", "context"],
  },
];

// ============================================================================
// Store Implementation
// ============================================================================

export const useUnifiedStore = create<UnifiedStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    health: {
      rails: false,
      gateway: false,
      version: "1.0.0",
      timestamp: 0,
    },
    isLoading: false,
    error: null,
    lastSync: 0,
    
    contextMode: "idle",
    selectedDagId: null,
    selectedWihId: null,
    selectedRunId: null,
    selectedThreadId: null,
    contextMetadata: {},
    
    dags: [],
    executions: [],
    wihs: [],
    myWihs: [],
    leases: [],
    contextPacks: [],
    receipts: [],
    ledgerEvents: [],
    mailThreads: [],
    mailMessages: [],
    agents: [],
    templates: PRODUCTION_TEMPLATES,
    snapshots: [],
    scheduledJobs: [],
    logs: [],
    
    activeMainTab: "plan",
    activeDrawerTab: "queue",
    drawerOpen: false,
    drawerHeight: 300,
    sidebarOpen: true,
    mailUnreadCount: 0,
    
    // Computed
    get currentDag() {
      const { dags, selectedDagId } = get();
      return dags.find((d) => d.dagId === selectedDagId) || null;
    },
    get currentWih() {
      const { wihs, myWihs, selectedWihId } = get();
      return [...wihs, ...myWihs].find((w) => w.wih_id === selectedWihId) || null;
    },
    get currentExecution() {
      const { executions, selectedRunId } = get();
      return executions.find((e) => e.runId === selectedRunId) || null;
    },
    getSessionAnalytics: (threadId: string) => buildSessionAnalytics(get(), threadId),
    
    // Actions - Connection
    checkHealth: async () => {
      try {
        const health = await railsApi.health();
        set({
          health: {
            rails: health.status === "healthy" || health.status === "ok",
            gateway: true,
            version: health.version || "1.0.0",
            timestamp: Date.now(),
          },
        });
      } catch (err: any) {
        set({
          health: {
            rails: false,
            gateway: false,
            version: "1.0.0",
            timestamp: Date.now(),
          },
          error: err.message,
        });
      }
    },
    
    syncAll: async () => {
      const { fetchDags, fetchWihs, fetchLeases, fetchLedgerEvents, fetchMailThreads } = get();
      await Promise.all([
        fetchDags(),
        fetchWihs(),
        fetchLeases(),
        fetchLedgerEvents(50),
        fetchMailThreads(),
      ]);
      set({ lastSync: Date.now() });
    },
    
    clearError: () => set({ error: null }),
    
    // Actions - Context
    setContextMode: (mode) => set({ contextMode: mode }),
    
    selectDag: (dagId) => {
      const { dags } = get();
      const dag = dags.find((d) => d.dagId === dagId);
      set({
        selectedDagId: dagId,
        contextMode: dagId ? "planning" : "idle",
        contextMetadata: dag ? { dagTitle: dag.metadata?.title } : {},
      });
      if (dagId) {
        get().fetchDagDetails(dagId);
        get().fetchWihs(dagId);
      }
    },
    
    selectWih: (wihId) => {
      const { wihs, myWihs } = get();
      const wih = [...wihs, ...myWihs].find((w) => w.wih_id === wihId);
      set({
        selectedWihId: wihId,
        contextMode: wihId ? "working" : "idle",
      });
      if (wih?.dag_id) {
        set({ selectedDagId: wih.dag_id });
      }
    },
    
    selectRun: (runId) => set({ selectedRunId: runId }),
    
    selectThread: (threadId) => set({ selectedThreadId: threadId }),
    
    setContextMetadata: (key, value) =>
      set((state) => ({
        contextMetadata: { ...state.contextMetadata, [key]: value },
      })),
    
    clearContext: () =>
      set({
        contextMode: "idle",
        selectedDagId: null,
        selectedWihId: null,
        selectedRunId: null,
        contextMetadata: {},
      }),
    
    // Actions - DAGs
    fetchDags: async () => {
      set({ isLoading: true, error: null });
      try {
        const response = await railsApi.plan.list();
        const dags: DagDefinition[] = response.dags.map((d: any) => ({
          dagId: d.dag_id,
          version: d.version,
          createdAt: d.created_at,
          nodes: [],
          edges: [],
          metadata: d.metadata,
        }));
        set({ dags, isLoading: false });
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
      }
    },
    
    createDag: async (text, dagId) => {
      set({ isLoading: true, error: null });
      try {
        const response = await railsApi.plan.new({ text, dag_id: dagId });
        const dagDetails = await railsApi.plan.show(response.dag_id);
        const newDag: DagDefinition = {
          dagId: dagDetails.dag_id,
          version: "1.0.0",
          createdAt: new Date().toISOString(),
          nodes: (dagDetails.dag as any)?.nodes || [],
          edges: (dagDetails.dag as any)?.edges || [],
          metadata: { title: text.slice(0, 50) },
        };
        set((state) => ({
          dags: [...state.dags, newDag],
          selectedDagId: newDag.dagId,
          contextMode: "planning",
          isLoading: false,
        }));
        get().addLog({
          timestamp: Date.now(),
          level: "info",
          message: `Created DAG: ${newDag.dagId}`,
          source: "rails",
          dagId: newDag.dagId,
        });
        return newDag.dagId;
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
        throw err;
      }
    },
    
    refineDag: async (dagId, delta, reason, mutations) => {
      set({ isLoading: true, error: null });
      try {
        await railsApi.plan.refine({ dag_id: dagId, delta, reason, mutations });
        await get().fetchDagDetails(dagId);
        set({ isLoading: false });
        get().addLog({
          timestamp: Date.now(),
          level: "info",
          message: `Refined DAG: ${dagId}`,
          source: "rails",
          dagId,
        });
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
      }
    },
    
    executeDag: async (dagId) => {
      set({ isLoading: true, error: null });
      try {
        const runId = `run_${Date.now()}`;
        await railsApi.plan.execute(dagId, runId);
        const newExecution: DagExecution = {
          runId,
          dagId,
          status: "running",
          startedAt: Date.now(),
          progress: 0,
          completedNodes: [],
          failedNodes: [],
          blockedNodes: [],
        };
        set((state) => ({
          executions: [...state.executions, newExecution],
          selectedRunId: runId,
          contextMode: "executing",
          isLoading: false,
        }));
        get().addLog({
          timestamp: Date.now(),
          level: "info",
          message: `Started execution: ${runId}`,
          source: "rails",
          dagId,
          runId,
        });
        return runId;
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
        throw err;
      }
    },
    
    cancelExecution: async (runId) => {
      try {
        await railsApi.plan.cancel(runId);
        set((state) => ({
          executions: state.executions.map((e) =>
            e.runId === runId ? { ...e, status: "cancelled" as const } : e
          ),
        }));
        get().addLog({
          timestamp: Date.now(),
          level: "warn",
          message: `Cancelled execution: ${runId}`,
          source: "rails",
          runId,
        });
      } catch (err: any) {
        set({ error: err.message });
      }
    },
    
    fetchDagDetails: async (dagId) => {
      try {
        const response = await railsApi.plan.show(dagId);
        const dag: DagDefinition = {
          dagId: response.dag_id,
          version: "1.0.0",
          createdAt: new Date().toISOString(),
          nodes: (response.dag as any)?.nodes || [],
          edges: (response.dag as any)?.edges || [],
          metadata: (response.dag as any)?.metadata,
        };
        set((state) => ({
          dags: state.dags.map((d) => (d.dagId === dagId ? dag : d)),
        }));
        return dag;
      } catch (err: any) {
        set({ error: err.message });
        return null;
      }
    },
    
    // Actions - WIHs
    fetchWihs: async (dagId) => {
      // Guard against concurrent calls
      const state = get();
      if (state.isLoading) return;
      
      set({ isLoading: true, error: null });
      try {
        const response = await railsApi.wihs.list({ dag_id: dagId });
        set({ wihs: response.wihs ?? [], isLoading: false });
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
      }
    },
    
    pickupWih: async (dagId, nodeId, agentId, role) => {
      set({ isLoading: true, error: null });
      try {
        const response = await railsApi.wihs.pickup({
          dag_id: dagId,
          node_id: nodeId,
          agent_id: agentId,
          role,
        });
        await get().fetchWihs(dagId);
        set({ selectedWihId: response.wih_id, contextMode: "working", isLoading: false });
        get().addLog({
          timestamp: Date.now(),
          level: "info",
          message: `Picked up WIH: ${response.wih_id}`,
          source: "rails",
          dagId,
          wihId: response.wih_id,
        });
        return response.wih_id;
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
        throw err;
      }
    },
    
    closeWih: async (wihId, status, evidence) => {
      set({ isLoading: true, error: null });
      try {
        await railsApi.wihs.close(wihId, { status, evidence });
        set((state) => ({
          wihs: state.wihs.map((w) => (w.wih_id === wihId ? { ...w, status: "closed" } : w)),
          myWihs: state.myWihs.filter((w) => w.wih_id !== wihId),
          selectedWihId: null,
          contextMode: state.myWihs.length > 1 ? "working" : "idle",
          isLoading: false,
        }));
        get().addLog({
          timestamp: Date.now(),
          level: status === "completed" ? "info" : "warn",
          message: `Closed WIH ${wihId}: ${status}`,
          source: "rails",
          wihId,
        });
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
      }
    },
    
    // Actions - Leases
    fetchLeases: async () => {
      set({ isLoading: true, error: null });
      try {
        const response = await railsApi.leases.list();
        set({ leases: response.leases, isLoading: false });
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
      }
    },
    
    requestLease: async (wihId, agentId, paths, ttlSeconds = 900) => {
      set({ isLoading: true, error: null });
      try {
        const response = await railsApi.leases.request({
          wih_id: wihId,
          agent_id: agentId,
          paths,
          ttl_seconds: ttlSeconds,
        });
        if (response.granted) {
          await get().fetchLeases();
          set({ isLoading: false });
          get().addLog({
            timestamp: Date.now(),
            level: "info",
            message: `Granted lease: ${response.lease_id}`,
            source: "rails",
            wihId,
          });
          return response.lease_id;
        } else {
          throw new Error("Lease request denied");
        }
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
        throw err;
      }
    },
    
    renewLease: async (leaseId) => {
      try {
        await railsApi.leases.renew(leaseId, 300);
        await get().fetchLeases();
        get().addLog({
          timestamp: Date.now(),
          level: "info",
          message: `Renewed lease: ${leaseId}`,
          source: "rails",
        });
      } catch (err: any) {
        set({ error: err.message });
      }
    },
    
    releaseLease: async (leaseId) => {
      try {
        await railsApi.leases.release(leaseId);
        set((state) => ({
          leases: state.leases.filter((l) => l.lease_id !== leaseId),
        }));
        get().addLog({
          timestamp: Date.now(),
          level: "info",
          message: `Released lease: ${leaseId}`,
          source: "rails",
        });
      } catch (err: any) {
        set({ error: err.message });
      }
    },
    
    // Actions - Context Packs
    fetchContextPacks: async (dagId, nodeId, wihId) => {
      set({ isLoading: true, error: null });
      try {
        const response = await railsApi.contextPacks.list({ dag_id: dagId, node_id: nodeId, wih_id: wihId });
        set({ contextPacks: response.packs, isLoading: false });
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
      }
    },
    
    sealContextPack: async (dagId, nodeId, wihId) => {
      set({ isLoading: true, error: null });
      try {
        const receiptsResponse = await railsApi.receipts.query({ dag_id: dagId, node_id: nodeId });
        const response = await railsApi.contextPacks.seal({
          dag_id: dagId,
          node_id: nodeId,
          wih_id: wihId,
          inputs: {
            wih_id: wihId,
            dag_id: dagId,
            node_id: nodeId,
            receipt_refs: receiptsResponse.receipts.map((r) => r.receipt_id),
          },
        });
        await get().fetchContextPacks(dagId, nodeId, wihId);
        set({ isLoading: false });
        return response.context_pack_id;
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
        throw err;
      }
    },
    
    // Actions - Receipts
    fetchReceipts: async (query) => {
      set({ isLoading: true, error: null });
      try {
        const response = await railsApi.receipts.query(query || {});
        set({ receipts: response.receipts, isLoading: false });
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
      }
    },
    
    // Actions - Ledger
    fetchLedgerEvents: async (count = 50) => {
      try {
        const events = await railsApi.ledger.tail(count);
        set({ ledgerEvents: events });
        // Also add to logs
        events.forEach((event) => {
          get().addLog({
            timestamp: new Date(event.timestamp).getTime(),
            level: "info",
            message: `${event.event_type}: ${JSON.stringify(event.payload).slice(0, 100)}`,
            source: "rails",
            dagId: event.scope?.dag_id,
            wihId: event.scope?.wih_id,
          });
        });
      } catch (err: any) {
        set({ error: err.message });
      }
    },
    
    traceEvents: async (nodeId, wihId) => {
      try {
        const events = await railsApi.ledger.trace({ node_id: nodeId, wih_id: wihId });
        set({ ledgerEvents: events });
      } catch (err: any) {
        set({ error: err.message });
      }
    },
    
    // Actions - Mail
    fetchMailThreads: async () => {
      try {
        // Threads are created via ensureThread, list them from messages
        const response = await railsApi.mail.inbox({ limit: 100 });
        const threadsMap = new Map<string, MailThread>();
        response.messages.forEach((msg) => {
          if (!threadsMap.has(msg.thread_id)) {
            threadsMap.set(msg.thread_id, {
              thread_id: msg.thread_id,
              topic: msg.thread_id,
              created_at: msg.timestamp,
            });
          }
        });
        set({ mailThreads: Array.from(threadsMap.values()) });
      } catch (err: any) {
        set({ error: err.message });
      }
    },
    
    fetchMailMessages: async (threadId) => {
      try {
        const response = await railsApi.mail.inbox({ thread_id: threadId, limit: 50 });
        set({ mailMessages: response.messages });
        const unread = response.messages.filter((m) => !m.acknowledged).length;
        set({ mailUnreadCount: unread });
      } catch (err: any) {
        set({ error: err.message });
      }
    },
    
    sendMail: async (threadId, body) => {
      try {
        await railsApi.mail.send({ thread_id: threadId, body_ref: body });
        await get().fetchMailMessages(threadId);
        get().addLog({
          timestamp: Date.now(),
          level: "info",
          message: `Sent message to thread: ${threadId}`,
          source: "rails",
        });
      } catch (err: any) {
        set({ error: err.message });
      }
    },
    
    requestReview: async (threadId, wihId, diffRef) => {
      try {
        await railsApi.mail.requestReview(threadId, wihId, diffRef);
        await get().fetchMailMessages(threadId);
        set({ contextMode: "reviewing" });
        get().addLog({
          timestamp: Date.now(),
          level: "info",
          message: `Requested review for WIH: ${wihId}`,
          source: "rails",
          wihId,
        });
      } catch (err: any) {
        set({ error: err.message });
      }
    },
    
    decideReview: async (threadId, approve, notes) => {
      try {
        await railsApi.mail.decide(threadId, approve, notes);
        await get().fetchMailMessages(threadId);
        set({ contextMode: approve ? "executing" : "idle" });
        get().addLog({
          timestamp: Date.now(),
          level: approve ? "info" : "warn",
          message: `Review ${approve ? "approved" : "rejected"} for thread: ${threadId}`,
          source: "rails",
        });
      } catch (err: any) {
        set({ error: err.message });
      }
    },
    
    ackMessage: async (threadId, messageId, note) => {
      try {
        await railsApi.mail.ack(threadId, messageId, note);
        await get().fetchMailMessages(threadId);
      } catch (err: any) {
        set({ error: err.message });
      }
    },
    
    // Actions - Agents (derived from WIHs)
    fetchAgents: async () => {
      const { wihs } = get();
      const agentMap = new Map<string, AgentInfo>();
      
      wihs.forEach((wih) => {
        if (wih.assignee) {
          agentMap.get(wih.assignee);
          agentMap.set(wih.assignee, {
            agentId: wih.assignee,
            name: wih.assignee,
            role: "Agent",
            status: wih.status === "in_progress" ? "working" : "waiting",
            currentWihId: wih.wih_id,
            currentDagId: wih.dag_id,
            lastActiveAt: Date.now(),
          });
        }
      });
      
      set({ agents: Array.from(agentMap.values()) });
    },
    
    // Actions - Templates
    fetchTemplates: async () => {
      // Templates are static for now, loaded from production templates
    },
    
    executeTemplate: async (templateId, variables) => {
      set({ isLoading: true, error: null });
      try {
        const template = get().templates.find((t) => t.id === templateId);
        if (!template) throw new Error("Template not found");
        
        let text = template.template;
        Object.entries(variables).forEach(([key, value]) => {
          text = text.replace(new RegExp(`{{${key}}}`, "g"), String(value));
        });
        
        await get().createDag(text);
        set({ isLoading: false });
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
      }
    },
    
    // Actions - Snapshots
    fetchSnapshots: async () => {
      // Snapshots are managed locally by DAK Runner
      set({ snapshots: [], snapshotStats: { total: 0, totalSize: 0 } });
    },
    
    clearSnapshot: async (snapshotId) => {
      set((state) => ({
        snapshots: state.snapshots.filter((s) => s.snapshotId !== snapshotId),
      }));
    },
    
    clearAllSnapshots: async () => {
      set({ snapshots: [], snapshotStats: { total: 0, totalSize: 0 } });
    },
    
    // Actions - Scheduler
    fetchScheduledJobs: async () => {
      // Would fetch from Rails scheduled jobs endpoint
      set({ scheduledJobs: [] });
    },
    
    pauseJob: async (jobId) => {
      set((state) => ({
        scheduledJobs: state.scheduledJobs.map((j) =>
          j.jobId === jobId ? { ...j, status: "paused" as const } : j
        ),
      }));
    },
    
    resumeJob: async (jobId) => {
      set((state) => ({
        scheduledJobs: state.scheduledJobs.map((j) =>
          j.jobId === jobId ? { ...j, status: "active" as const } : j
        ),
      }));
    },
    
    // Actions - Logs
    addLog: (entry) =>
      set((state) => ({
        logs: [createLogEntry(entry), ...state.logs].slice(0, 1000),
      })),
    
    clearLogs: () => set({ logs: [] }),
    
    // Actions - UI
    setActiveMainTab: (tab) => set({ activeMainTab: tab }),
    setActiveDrawerTab: (tab) => set({ activeDrawerTab: tab }),
    toggleDrawer: () => set((state) => ({ drawerOpen: !state.drawerOpen })),
    setDrawerHeight: (height) => set({ drawerHeight: height }),
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  }))
);

// ============================================================================
// Auto-sync and Polling
// ============================================================================

let healthInterval: NodeJS.Timeout | null = null;
let syncInterval: NodeJS.Timeout | null = null;

export function startAutoSync(intervalMs = 30000) {
  if (healthInterval) clearInterval(healthInterval);
  if (syncInterval) clearInterval(syncInterval);
  
  const store = useUnifiedStore.getState();
  
  // Health check every 10 seconds
  healthInterval = setInterval(() => {
    store.checkHealth();
  }, 10000);
  
  // Full sync every intervalMs
  syncInterval = setInterval(() => {
    store.syncAll();
  }, intervalMs);
}

export function stopAutoSync() {
  if (healthInterval) {
    clearInterval(healthInterval);
    healthInterval = null;
  }
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

// ============================================================================
// Selectors (for performance)
// ============================================================================

export const selectHealth = (state: UnifiedStore) => state.health;
export const selectContextMode = (state: UnifiedStore) => state.contextMode;
export const selectCurrentDag = (state: UnifiedStore) => state.currentDag;
export const selectCurrentWih = (state: UnifiedStore) => state.currentWih;
export const selectWihsByStatus = (status: string) => (state: UnifiedStore) =>
  state.wihs.filter((w) => w.status === status);
export const selectActiveExecutions = (state: UnifiedStore) =>
  state.executions.filter((e) => e.status === "running");

// ============================================================================
// Export
// ============================================================================

export default useUnifiedStore;
