/**
 * allternit Super-Agent OS
 * 
 * Main entry point for the Super-Agent OS infrastructure.
 */

// ============================================================================
// Core Components
// ============================================================================

export { AllternitCanvas } from './components/AllternitCanvas';
export { AllternitConsole, AllternitConsoleToggle } from './components/AllternitConsole';
export { 
  AllternitChatIntegration,
  MessageRenderer,
  QuickLaunchButtons,
  useAllternitChatIntegration,
  useStreamingMessage,
} from './components/AllternitChatIntegration';

// ============================================================================
// Main AllternitOS System
// ============================================================================

export { 
  AllternitOS, 
  AllternitOSProvider,
  AllternitOSHeader,
  AllternitQuickActions,
  AllternitOSStatusBar,
  useAllternitCommandPalette,
} from './AllternitOS';
export type { AllternitOSConfig, AllternitOSProps } from './AllternitOS';

// ============================================================================
// State Management
// ============================================================================

export {
  useSidecarStore,
  useActiveProgram,
  useProgram,
  useProgramState,
  useAllPrograms,
  selectActiveProgram,
  selectProgramCount,
  selectHasPrograms,
} from './stores/useSidecarStore';

// ============================================================================
// Types
// ============================================================================

export type {
  AllternitProgram,
  AllternitProgramType,
  AllternitProgramStatus,
  AllternitProgramState,
  LaunchProgramRequest,
  ProgramEvent,
  AllternitProgramUri,
  ResearchDocState,
  ResearchDocSection,
  ResearchDocCitation,
  ResearchDocEvidence,
  DataGridState,
  DataGridColumn,
  DataGridRow,
  DataGridVisualization,
  PresentationState,
  PresentationSlide,
  PresentationTheme,
  CodePreviewState,
  CodePreviewFile,
  AssetManagerState,
  AssetManagerItem,
  ImageStudioState,
  ImageStudioLayer,
  AudioStudioState,
  AudioStudioVoice,
  AudioStudioSegment,
  TelephonyState,
  TelephonyCall,
  OrchestratorState,
  OrchestratorAgent,
  OrchestratorTaskGraph,
  StreamingChunk,
  Agent,
  TaskNode,
} from './types/programs';

// ============================================================================
// Utilities
// ============================================================================

export {
  launchResearchDoc,
  launchDataGrid,
  launchPresentation,
  launchCodePreview,
  launchAssetManager,
  launchImageStudio,
  launchAudioStudio,
  launchTelephony,
  launchOrchestrator,
  parseLaunchCommands,
  executeLaunchCommands,
  processAgentMessage,
  wrapLaunchCommand,
  useLaunchProtocol,
} from './utils/launchProtocol';

export {
  programLauncher,
  useProgramLauncher,
  parseAllternitUri as parseProgramUri,
  buildAllternitUri as buildProgramUri,
  launchWorkflowBuilder,
  type ProgramLaunchRequest,
  type LaunchOptions,
  type ParsedAllternitUri as ParsedProgramUri,
} from './utils/ProgramLauncher';

// ============================================================================
// URI Helpers
// ============================================================================

export {
  parseAllternitUri,
  buildAllternitUri,
} from './types/programs';

// ============================================================================
// Hooks
// ============================================================================

export {
  useAgentRuntime,
  useChatWithPrograms,
  useProgramStreaming,
} from './hooks/useAgentRuntime';

export type {
  AgentRuntimeOptions,
  AgentRuntime,
  ChatMessage,
} from './hooks/useAgentRuntime';

// ============================================================================
// Kernel Integration
// ============================================================================

export {
  // Kernel Bridge
  KernelWebSocketBridge,
  KernelElectronBridge,
  KernelMockBridge,
  createKernelBridge,
  useKernelBridge,
  kernelBridge,
  
  // Allternit Rails
  AllternitRailsClient,
  useAllternitRails,
  
  // Allternit Rails WebSocket
  AllternitRailsWebSocketBridge,
  useRailsWebSocket,
  railsWebSocketBridge,
  
  // Orchestrator
  OrchestratorEngine,
  decomposeTask,
  useOrchestrator,
  
  // Agent Tools
  AGENT_TOOLS,
  handleToolCall,
  useAgentTools,
} from './kernel';

export type {
  KernelBridgeOptions,
  KernelBridge,
  KernelBackend,
  AgentConfig,
  ExecutionPlan,
  ToolContext,
  WihState,
  
  // Rails WebSocket Types
  RailsMessage,
  RailsMessageType,
  ConnectionState,
} from './kernel';

// Kernel Protocol
export {
  KernelProtocolHandler,
  kernelProtocol,
  detectLaunchDirectives,
  useKernelProtocol,
} from './kernel';

export type {
  KernelMessageType as ProtocolMessageType,
  KernelMessage as ProtocolMessage,
} from './kernel';

// ============================================================================
// Services (File System, Python Execution)
// ============================================================================

export {
  FileSystemService,
  useFileSystem,
  fileSystemService,
} from './services/FileSystemService';

export type {
  DriveEntry,
  FileUpload,
  DriveSearchResult,
  DriveStats,
  FileSystemBackend,
  FileSystemEvent,
} from './services/FileSystemService';

export {
  PythonExecutionBridge,
  usePythonExecution,
  generateVisualizationCode,
} from './services/PythonExecutionService';

export type {
  PythonExecutionRequest,
  PythonExecutionResult,
  VisualizationLibrary,
} from './services/PythonExecutionService';

export {
  WorkspaceService,
  useWorkspaceService,
  initWorkspaceService,
  getWorkspaceService,
} from './services/WorkspaceService';

export type {
  WorkspaceConfig,
  WihWorkItem,
} from './services/WorkspaceService';

// ============================================================================
// Legacy File System (deprecated, use FileSystemService)
// ============================================================================

export {
  FileSystemWatcher,
  AssetManagerSync,
  useFileSystemWatcher,
  useAssetManagerSync,
} from './utils/FileSystemWatcher';

export type {
  FileChangeType,
  FileChangeEvent,
  WatcherOptions,
} from './utils/FileSystemWatcher';

// ============================================================================
// Program Components (for advanced use)
// ============================================================================

export { ResearchDocProgram } from './programs/ResearchDocProgram';
export { DataGridProgram } from './programs/DataGridProgram';
export { PresentationProgram } from './programs/PresentationProgram';
export { CodePreviewProgram } from './programs/CodePreviewProgram';
export { AssetManagerProgram } from './programs/AssetManagerProgram';
export {
  ImageStudioProgram,
  AudioStudioProgram,
  TelephonyProgram,
  BrowserProgram,
} from './programs/OtherPrograms';

export { OrchestratorProgram } from './programs/OrchestratorProgram';
export { WorkflowBuilderProgram } from './programs/WorkflowBuilderProgram';
export { CitationManager } from './programs/BrowserScreenshotCitations';
