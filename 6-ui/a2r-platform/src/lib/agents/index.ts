/**
 * Agent Library - Production Implementation
 *
 * Unified export for agent management functionality including:
 * - Basic agent CRUD and execution
 * - Subagents and multi-agent patterns
 * - Swarm orchestration
 * - Workflow DAG execution
 * - Templates and presets
 * - N20 Native OpenClaw Agent (native-agent.store)
 */

// ============================================================================
// Base Types & Store
// ============================================================================

export type {
  Agent,
  AgentType,
  CreateAgentInput,
  AgentTask,
  AgentRun,
  Checkpoint,
  Commit,
  CommitChange,
  ExecutionPlan,
  PlanStep,
  QueueItem,
  AgentEvent,
  AgentEventType,
  TaskStatus,
  VoiceConfig,
  VoicePreset,
  VoicesResponse,
  AgentMailMessage,
  AgentMailThread,
  SendMailInput,
  GateReview,
  GateDecision,
} from "./agent.types";

export type {
  HardBanCategory,
  EnforcementMode,
  RoleHardBan,
  RoleCardConfig,
  VoiceConfigLayer,
  RelationshipPair,
  RelationshipConfig,
  ProgressionStatRule,
  ProgressionConfig,
  AvatarConfig,
  CharacterLayerConfig,
  CharacterLintIssue,
  CharacterCompiledConfig,
  CharacterArtifactFile,
  CharacterTelemetryEventType,
  CharacterTelemetryEvent,
  CharacterStats,
  BanViolation,
} from "./character.types";

export { AGENT_CAPABILITIES, AGENT_MODELS, AGENT_TYPES } from "./agent.types";

export * from "./agent.service";
export * from "./character.service";
export { railsApi } from "./rails.service";
export {
  API_BASE_URL,
  apiRequest,
  apiRequestWithError,
  type ApiResponse,
} from "./api-config";
export type {
  // Plan/DAG
  PlanNewRequest,
  PlanNewResponse,
  PlanRefineRequest,
  PlanRefineResponse,
  DagMutation,
  DagRenderResponse,
  // WIH
  WihInfo,
  WihListRequest,
  WihListResponse,
  WihPickupRequest,
  WihPickupResponse,
  WihCloseRequest,
  WihCloseResponse,
  // Leases
  LeaseRequest,
  LeaseResponse,
  ManagedLease,
  LeaseListResponse,
  LeaseRenewRequest,
  LeaseRenewResponse,
  // Context Packs
  ContextPack,
  ContextPackInputs,
  ContextPackSealRequest,
  ContextPackSealResponse,
  ContextPackListRequest,
  ContextPackListResponse,
  // Receipts
  Receipt,
  ReceiptKind,
  ReceiptQueryRequest,
  ReceiptQueryResponse,
  // Ledger
  LedgerEvent,
  LedgerTailRequest,
  LedgerTraceRequest,
  // Mail
  MailThread,
  MailMessage,
  MailSendRequest,
  MailInboxRequest,
  // Gate
  GateCheckRequest,
  GateCheckResponse,
  // Vault
  VaultArchiveRequest,
  VaultArchiveResponse,
} from "./rails.service";

// Note: DAK Runner types (dag.types.ts) and store (dak.store.ts) are exported
// separately from src/runner/index.ts to avoid circular dependencies

// Unified Store - Rails/DAK Integration
export {
  useUnifiedStore,
  startAutoSync,
  stopAutoSync,
  selectHealth,
  selectContextMode,
  selectCurrentDag,
  selectCurrentWih,
  selectWihsByStatus,
  selectActiveExecutions,
  type ContextMode,
  type MainTab,
  type DrawerTab,
  type DagDefinition,
  type DagNode,
  type DagEdge,
  type DagExecution,
  type AgentInfo,
  type SystemHealth,
  type PromptTemplate,
  type TemplateVariable,
  type ToolSnapshot,
  type SnapshotStats,
  type LogEntry,
  type SessionAnalytics,
  type ScheduledJob,
} from "./unified.store";

export {
  useAgentStore,
  useSelectedAgent,
  useAgentRuns,
  useAgentTasks,
  useActiveRun,
  useAgentMail,
  useAgentMailThreads,
  useUnreadMailCount,
  useAgentReviews,
  usePendingReviewCount,
  useCharacterLayer,
  useCharacterCompiled,
  useCharacterStats,
} from "./agent.store";

export type {
  AgentSessionDescriptor,
  AgentSessionFeatures,
  AgentSessionMode,
  AgentSessionSurface,
} from "./session-metadata";

export {
  buildAgentSessionMetadata,
  formatAgentSessionMetaLabel,
  formatAgentSessionSurfaceLabel,
  getAgentSessionDescriptor,
} from "./session-metadata";
export type {
  OpenClawDiscoveredAgent,
  OpenClawDiscoveryResponse,
  OpenClawDiscoveryFiles,
} from "./openclaw-discovery";
export {
  buildOpenClawImportInput,
  discoverOpenClawAgents,
  getOpenClawWorkspacePathFromAgent,
  getRegisteredOpenClawAgentId,
  resolveOpenClawRegistration,
} from "./openclaw-discovery";
export {
  useEmbeddedAgentSession,
  useEmbeddedAgentSessionStore,
} from "./embedded-agent-session.store";
export { mapNativeMessagesToStreamMessages } from "./embedded-agent-chat";
export { AgentContextStrip } from "@/components/agents/AgentContextStrip";
export { ToolCallVisualization, useToolCallAccent } from "@/components/agents/ToolCallVisualization";
export { CronJobWizard, type CronJobConfig } from "@/components/agents/CronJobWizard";
export {
  AskUserQuestion,
  QuestionWizard,
  ToolQuestionDisplay,
  useAskUserQuestion,
  useToolQuestions,
  type AskUserQuestionProps,
  type QuestionType,
} from "@/components/agents/AskUserQuestion";

// ============================================================================
// Native Agent Tools
// ============================================================================

export {
  useAskUserToolStore,
  executeAskUserTool,
  ASK_USER_TOOL_DEFINITION,
  validateAnswer,
  formatQuestionForDisplay,
  type QuestionConfig,
  type QuestionOption,
  type ValidationRule,
  type PendingQuestion,
  type AskUserToolState,
  type AskUserToolActions,
} from "./tools/ask-user.tool";

export {
  registerTool,
  executeTool,
  getToolDefinition,
  getAllToolDefinitions,
  isToolRegistered,
  type ToolDefinition,
  type ToolExecutionContext,
  type ToolExecutionHandler,
} from "./tools";

export {
  useToolHooksStore,
  usePendingToolConfirmations,
  useToolExecutionHistory,
  useToolHooks,
  createConfirmationHook,
  createAuditHook,
  type ToolDecision,
  type ToolContext,
  type ToolRoutingResult,
  type PreToolUseFunction,
  type PostToolUseFunction,
  type PendingToolConfirmation,
  type ToolExecutionRecord,
} from "./tools/tool-hooks";

export {
  createScheduledJob,
  listScheduledJobs,
  updateScheduledJob,
  deleteScheduledJob,
  runScheduledJobNow,
  pauseScheduledJob,
  resumeScheduledJob,
  executeScheduledJob,
  describeCronExpression,
  calculateNextRun,
  type ScheduledJobConfig,
  type JobExecution,
} from "./scheduled-jobs.service";

export {
  startJobRunner,
  stopJobRunner,
  isJobRunnerRunning,
  getJobRunnerState,
  getExecutionHistory,
  clearExecutionHistory,
  useJobRunner,
  type JobRunnerConfig,
  type JobRunnerState,
} from "./scheduled-jobs.runner";

export {
  READ_FILE_DEFINITION,
  WRITE_FILE_DEFINITION,
  SEARCH_CODE_DEFINITION,
  LIST_DIRECTORY_DEFINITION,
  DELETE_FILE_DEFINITION,
  executeReadFile,
  executeWriteFile,
  executeSearchCode,
  executeListDirectory,
  executeDeleteFile,
  type SearchResult,
  type FileEntry,
  FilesApiClientError,
} from "./tools/file-tools";

export { filesApi, type FilesApiError } from "./files-api";
export {
  useToolRegistryStore,
  useToolsByCategory,
  useFilteredTools,
  useEnabledToolCount,
  useToolCategories,
  type ToolRegistryEntry,
  type ToolCategory,
  type SessionToolConfig,
} from "./tool-registry.store";

// ============================================================================
// Advanced Types & Store
// ============================================================================

export type {
  // Subagents
  SubagentConfig,
  TriggerCondition,

  // Swarms
  AgentSwarm,
  SwarmAgentConfig,
  SwarmRole,
  SwarmStrategy,
  SwarmCommunication,
  SwarmRun,
  SwarmMessage,

  // Workflows
  AgentWorkflow,
  WorkflowStep,
  WorkflowBranch,
  WorkflowExpression,
  WorkflowVariable,
  WorkflowErrorHandling,
  WorkflowTrigger,
  ParallelStepConfig,
  WorkflowExecutionState,

  // Loop Control
  LoopControlConfig,
  AbortCondition,

  // Call Options
  AgentCallOptions,

  // Tool Config
  AgentToolConfig,
  RetryConfig,

  // Memory
  AgentMemoryConfig,

  // Cost & Safety
  CostControlConfig,
  SafetyConfig,
  ObservabilityConfig,

  // Relationships
  AgentRelationship,

  // Advanced Config
  AdvancedAgentConfig,

  // Templates
  AgentTemplate,
  AgentExample,

  // Execution
  AdvancedAgentRun,
  ExecutionTraceEvent,
  RunCost,
  TokenUsage,
} from "./agent-advanced.types";

export { PREDEFINED_AGENT_TEMPLATES } from "./agent-advanced.types";

export {
  useAdvancedAgentStore,
  useAgentSubagents,
  useAgentWorkflows,
  useSelectedTemplate,
  useSwarmMessages,
} from "./agent-advanced.store";

// ============================================================================
// N20 Native OpenClaw Agent (Full Implementation)
// ============================================================================

// Native Agent Store
export type {
  MessageRole,
  NativeMessage,
  ToolCall,
  ToolResult,
  NativeSession,
  CreateSessionInput,
  SessionUpdateInput,
  Tool,
  Canvas,
  StreamEventType,
  StreamEvent,
  StreamingState,
  RuntimeExecutionModeStatus,
} from "./native-agent.store";

export {
  useNativeAgentStore,
  selectActiveSession,
  selectActiveMessages,
  selectSessionCanvases,
  selectIsStreaming,
  selectStreamingError,
  selectSessionSyncState,
  selectExecutionModeState,
  isLocalDraftSession,
  useActiveSession,
  useActiveMessages,
  useSessionCanvases,
  useStreamingState,
  useSessionSyncState,
  useExecutionModeState,
} from "./native-agent.store";

// Native Agent API Layer
export {
  nativeAgentApi,
  sessionApi,
  chatApi,
  runtimeApi,
  toolsApi,
  canvasApi,
  NativeAgentApiError,
  type BackendSession,
  type BackendSessionSnapshot,
  type BackendTool,
  type BackendCanvas,
  type BackendChatChunk,
  type ChatStreamCallbacks,
  type CanvasOperation,
  type SessionCreatedEvent,
  type SessionDeletedEvent,
  type SessionMessageAddedEvent,
  type SessionStatusChangedEvent,
  type SessionSyncEvent,
  type SessionUpdatedEvent,
} from "./native-agent-api";
