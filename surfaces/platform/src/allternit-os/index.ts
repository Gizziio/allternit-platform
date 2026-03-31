/**
 * A2rchitect Super-Agent OS
 * 
 * Main entry point for the Super-Agent OS infrastructure.
 */

// ============================================================================
// Core Components
// ============================================================================

export { A2rCanvas } from './components/A2rCanvas';
export { A2rConsole, A2rConsoleToggle } from './components/A2rConsole';
export { 
  A2rChatIntegration,
  MessageRenderer,
  QuickLaunchButtons,
  useA2rChatIntegration,
  useStreamingMessage,
} from './components/A2rChatIntegration';

// ============================================================================
// Main A2rOS System
// ============================================================================

export { 
  A2rOS, 
  A2rOSProvider,
  A2rOSHeader,
  A2rQuickActions,
  A2rOSStatusBar,
  useA2rCommandPalette,
} from './A2rOS';
export type { A2rOSConfig, A2rOSProps } from './A2rOS';

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
  A2rProgram,
  A2rProgramType,
  A2rProgramStatus,
  A2rProgramState,
  LaunchProgramRequest,
  ProgramEvent,
  A2rProgramUri,
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
  parseA2rUri as parseProgramUri,
  buildA2rUri as buildProgramUri,
  launchWorkflowBuilder,
  type ProgramLaunchRequest,
  type LaunchOptions,
  type ParsedA2rUri as ParsedProgramUri,
} from './utils/ProgramLauncher';

// ============================================================================
// URI Helpers
// ============================================================================

export {
  parseA2rUri,
  buildA2rUri,
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
  
  // A2R Rails
  A2RRailsClient,
  useA2RRails,
  
  // A2R Rails WebSocket
  A2RRailsWebSocketBridge,
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
