/**
 * Gizzi Code - Main Entry Point
 * 
 * Workspace-aware AI assistant framework
 */

// Core State Management
export {
  AppStateStore,
  getGlobalStore,
  setGlobalStore,
  useAppStateStore,
  useAppStateSelector,
  useAppStateActions,
} from './state/AppStateStore';

export type {
  UserPreferences,
  UserSession,
  ConnectionStatus,
  AppState,
  AppError,
} from './state/AppStateStore';

// Workspace State (NEW)
export {
  WorkspaceStateStore,
  getWorkspaceStore,
  setWorkspaceStore,
} from './state/WorkspaceStateStore';

// Workspace Types (NEW)
export type {
  WorkspaceFile,
  TrustTier,
  ScheduledTask,
  ToolDefinition,
  ContextPack,
  WorkspaceSession,
  MessageRole,
} from './workspace/types';

// Workspace Loader (NEW)
export {
  loadWorkspace,
  executeStartupTasks,
  enhanceSessionWithWorkspace,
} from './workspace/loader';

export type {
  FileSystem,
  LoadWorkspaceOptions,
  LoadedWorkspace,
} from './workspace/loader';

// Context Pack Builder (NEW)
export {
  buildContextPack,
  buildSystemPrompt,
  parseSoulMd,
  parseHeartbeatMd,
  classifyFile,
  getStartupTasks,
  requiresPermission,
  shouldRefreshContext,
} from './context/pack-builder';

export type { BuildContextPackOptions } from './context/pack-builder';

// Message Types
export type {
  Message,
  MessageRole,
  UserMessage,
  AssistantMessage,
  SystemMessage,
  TypedMessage,
  MessageThread,
  Attachment,
  AttachmentMimeType,
  MessageStatus,
} from './types/message';

export {
  MESSAGE_ROLES,
  isUserMessage,
  isAssistantMessage,
  isSystemMessage,
  isMessageRole,
  createMessage,
} from './types/message';

// React Hooks
export {
  useTerminalSize,
} from './hooks/useTerminalSize';

export {
  useExitOnCtrlCD,
} from './hooks/useExitOnCtrlCD';

export {
  useKeybinding,
} from './hooks/useKeybinding';

// Task Scheduler (NEW)
export {
  TaskScheduler,
  taskScheduler,
} from './scheduler/TaskScheduler';

export type {
  TaskFrequency,
  ScheduledTask,
  SchedulerJob,
} from './scheduler/TaskScheduler';

// Workspace Watcher (NEW)
export {
  WorkspaceWatcher,
  getWorkspaceWatcher,
  stopAllWatchers,
  workspaceWatcher,
} from './watcher/WorkspaceWatcher';

export type {
  FileChange,
  WatcherOptions,
} from './watcher/WorkspaceWatcher';

// Version
export const VERSION = '1.0.1';
