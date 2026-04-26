/**
 * Agent Library - Production Implementation
 *
 * Unified export for agent management functionality.
 * 
 * **SESSION ARCHITECTURE**:
 * Chat, Code, and Cowork each have isolated session stores.
 * Sessions do NOT sync between modes - this is by design (like Claude Desktop).
 * 
 * @see SESSION_ARCHITECTURE.md for full documentation
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
  AgentStatus,
  AgentWorkspace,
  AgentWorkspaceLayers,
  // Creation flow types
  CreationTemperament,
  CreationBlueprintState,
  CreationCardSeedState,
  CreateFlowStepId,
  // Tool and session types
  ToolCall,
  NativeSession,
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

export { acknowledgeMail, buildSeedTelemetryEvents, cancelAgentRun, checkGateStatus, connectAgentEventStream, createAgent, createCheckpoint, createCommit, createDefaultAvatarConfig, createExecutionPlan, deleteAgent, dequeueTask, detectPluginConflicts, enqueueTask, formatDuration, generateEnhancedWorkspaceDocuments, getAgent, getAgentInbox, getAgentRun, getAgentTask, getAgentThreads, getCommit, getExecutionPlan, getGateRules, getPendingReviews, getStatusColor, listAgentRuns, listAgentTasks, listAgents, listCheckpoints, listCommits, listQueueItems, mutateViaGate, pauseAgentRun, requestAgentReview, restoreCheckpoint, resumeAgentRun, sendAgentMail, setupSeedDefaults, splitLines, startAgentRun, submitGateDecision, updateAgent, updateTaskStatus } from './agent.service';
export { CHARACTER_SETUPS, CHARACTER_SPECIALTY_OPTIONS, appendTelemetryEvent, applyRelationshipDrift, buildCharacterArtifacts, compileCharacterLayer, computeCharacterStats, deriveVoiceModifiers, detectBanViolation, getDefaultCharacterLayer, getSetupStatDefinitions, getSpecialtyOptions, loadCharacterArtifacts, loadCharacterLayer, loadCompiledCharacterLayer, loadTelemetryEvents, normalizeCharacterBlueprint, parseCharacterBlueprint, parseCharacterSeed, saveCharacterLayer } from './character.service';

// Workspace Service
export { agentWorkspaceService } from "./agent-workspace.service";
export type {
  WorkspaceTemplate,
} from "./agent-templates";
// Note: TemplateVariable is also exported from unified.store.ts - using that one
export {
  GIZZI_TEMPLATE,
  ALLTERNIT_STANDARD_TEMPLATE,
  ALLTERNIT_MINIMAL_TEMPLATE,
  WORKSPACE_TEMPLATES,
  listTemplates,
  getTemplate,
  substituteTemplateVariables,
  buildVariablesFromInput,
} from "./agent-templates";
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
  // Note: TemplateVariable is exported from agent-templates.ts
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
// ============================================================================
// Permission and Question Store
export type {
  PendingPermissionRequest,
  PermissionDecision,
  Question,
  PendingQuestionRequest,
  QuestionAnswer,
} from "./permission-store";
export {
  usePermissionStore,
  usePendingPermissions,
  usePermissionActions,
  useQuestionStore,
  usePendingQuestions,
  useQuestionActions,
} from "./permission-store";

export type {
  AssistantBlockKind,
  StreamEvent,
  ToolLifecycleState,
  RunStatus,
  TimelineCitation,
  TextTimelineBlock,
  ReasoningTimelineBlock,
  ToolTimelineBlock,
  ArtifactTimelineBlock,
  CitationTimelineBlock,
  AssistantTimelineBlock,
  AssistantTurn,
  ConversationTimelineState,
  ProviderStreamAdapter,
} from "./timeline-stream";

export {
  createConversationTimelineState,
  reduceStreamEvent,
} from "./timeline-stream";
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

export { filesApi, type FilesApiError } from './files-api';
export {
  useToolRegistryStore,
  useToolsByCategory,
  useFilteredTools,
  useEnabledToolCount,
  useToolCategories,
  type Tool,
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

  // Note: AgentWorkflow and WorkflowStep are exported from agent-templates.specialist.ts
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
// Mode-Specific Session Stores (Independent per Surface)
// ============================================================================

// Chat, Code, and Cowork each have isolated session stores.
// Sessions do NOT sync between modes - this is by design (like Claude Desktop).
// Use these for all NEW code.
//
// Store instances are exported from:
//   - @/views/chat/ChatSessionStore        (useChatSessionStore, useActiveChatSession, etc.)
//   - @/views/code/CodeSessionStore        (useCodeSessionStore, useActiveCodeSession, etc.)
//   - @/views/cowork/CoworkStore           (useCoworkStore)

export type {
  ModeSession,
  ModeSessionMessage,
  MessageRole,
  CreateModeSessionOptions,
  SendMessageOptions,
  ModeSessionState,
  StreamingSessionState,
} from "./mode-session-store";

export {
  createModeSessionStore,
} from "./mode-session-store";

// Backend API Layer (used by mode-specific stores)
import {
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
};

// ============================================================================
// Specialist Templates (Agency-Agents Inspired)
// ============================================================================

export {
  SPECIALIST_TEMPLATES,
  getTemplateById,
  getTemplatesByCategory,
  searchTemplates,
  getBuiltInTemplates,
  createAgentFromTemplate,
  type SpecialistTemplate,
  type AgentCategory,
  // Note: AgentWorkflow and WorkflowStep are exported from agent-templates.specialist.ts
  type TechnicalDeliverable,
  type SuccessMetric,
} from './agent-templates.specialist';

// ============================================================================
// Import/Export Service
// ============================================================================

export {
  exportAgent,
  exportAgentToString,
  downloadAgentFile,
  importAgentFromString,
  importAgentFromObject,
  importAgentFromFile,
  validateAgentConfig,
  getSupportedVersions,
  getCurrentVersion,
  migrateExportData,
  type AgentExportData,
  type AgentImportResult,
} from './agent-template-io';

export function useConversationReplies(_chatId?: string) {
  return { replies: [], isLoading: false, error: null };
}

export function useUserMessages(_chatId?: string) {
  return { messages: [], isLoading: false };
}
