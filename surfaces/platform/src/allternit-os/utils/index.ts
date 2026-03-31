/**
 * A2rchitect Super-Agent OS - Utilities Index
 * 
 * Central export point for all utility modules.
 */

// Export Utilities
export {
  exportToMarkdown,
  exportToHTML,
  exportToPDF,
  downloadMarkdown,
  downloadHTML,
  exportPresentationToMarkdown,
  exportPresentationToPDF,
  exportToCSV,
  exportToJSON,
  exportToExcelHTML,
  downloadCSV,
  downloadJSON,
  downloadExcel,
  useExport,
  type ExportOptions,
  type DataGridExportOptions,
} from './ExportUtilities';

// File System Watcher
export {
  FileSystemWatcher,
  AssetManagerSync,
  useFileSystemWatcher,
  useAssetManagerSync,
  type FileChangeType,
  type FileChangeEvent,
  type WatcherOptions,
} from './FileSystemWatcher';

// Launch Protocol
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
  launchWorkflowBuilder,
  parseLaunchCommands,
  executeLaunchCommands,
  processAgentMessage,
  wrapLaunchCommand,
  useLaunchProtocol,
  type LaunchCommand,
} from './launchProtocol';

// Program Launcher
export {
  programLauncher,
  useProgramLauncher,
  parseA2rUri,
  buildA2rUri,
  launchResearchDoc as launchResearchDocFromLauncher,
  launchDataGrid as launchDataGridFromLauncher,
  launchPresentation as launchPresentationFromLauncher,
  launchCodePreview as launchCodePreviewFromLauncher,
  launchAssetManager as launchAssetManagerFromLauncher,
  type ProgramLaunchRequest,
  type LaunchOptions,
  type LaunchQueueItem,
  type ParsedA2rUri,
} from './ProgramLauncher';
