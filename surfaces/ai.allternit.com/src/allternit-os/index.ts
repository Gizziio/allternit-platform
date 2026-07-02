// @ts-nocheck
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
export { default as AllternitChatIntegration } from './components/AllternitChatIntegration';

// ============================================================================
// Main AllternitOS System
// ============================================================================

export { default as AllternitOS, AllternitOSProvider } from './AllternitOS';
export type { AllternitOSConfig } from './AllternitOS';

// ============================================================================
// State Management
// ============================================================================

export {
  useSidecarStore,
  useActiveProgram,
} from './stores/useSidecarStore';

// ============================================================================
// Types
// ============================================================================

export type {
  AllternitProgram,
  AllternitProgramType,
  AllternitProgramState,
  LaunchProgramRequest,
  ProgramEvent,
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
  CodePreviewState,
  CodePreviewFile,
  AssetManagerState,
  AssetManagerItem,
  OrchestratorState,
  OrchestratorAgent,
  OrchestratorTaskGraph,
  StreamingChunk,
  TaskNode,
} from './types/programs';

// ============================================================================
// Utilities
// ============================================================================

export {
  parseLaunchCommands,
  executeLaunchCommands,
  wrapLaunchCommand,
  useLaunchProtocol,
} from './utils/launchProtocol';

export {
  programLauncher,
} from './utils/ProgramLauncher';

// ============================================================================
// URI Helpers
// ============================================================================



// ============================================================================
// Hooks
// ============================================================================

export { default as useAgentRuntime } from './hooks/useAgentRuntime';

// ============================================================================
// Kernel Integration
// ============================================================================

export {
  // Allternit Rails
  useAllternitRails,
  
  // Allternit Rails WebSocket
  AllternitRailsWebSocketBridge,
  useRailsWebSocket,
  
  // Orchestrator
  OrchestratorEngine,
  decomposeTask,
} from './kernel';

export type {
  AgentConfig,
  ExecutionPlan,
  TaskNode,
} from './kernel';

export type {
  KernelMessageType as ProtocolMessageType,
  KernelMessage as ProtocolMessage,
} from './kernel/KernelProtocol';

export {
  useKernelProtocol,
} from './kernel/KernelProtocol';



// ============================================================================
// Services (File System, Python Execution)
// ============================================================================

export { default as FileSystemService, useFileSystem } from './services/FileSystemService';

export type {
  DriveEntry,
  FileUpload,
} from './services/FileSystemService';

export { usePythonExecution } from './services/PythonExecutionService';

export type {
  VisualizationLibrary,
} from './services/PythonExecutionService';

export { WorkspaceService, initWorkspaceService } from './services/WorkspaceService';

export type {
  WorkspaceConfig,
} from './services/WorkspaceService';

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
export { default as CitationManager } from './programs/BrowserScreenshotCitations';
