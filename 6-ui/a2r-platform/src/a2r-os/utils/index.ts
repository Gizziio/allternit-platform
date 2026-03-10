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
  useFileSystemWatcher,
  useAssetManagerSync,
  scanFolder,
  type FileSystemWatcherOptions,
  type FileSystemEvent,
} from './FileSystemWatcher';

// Launch Protocol
export {
  handleA2rLaunchUri,
  useLaunchProtocol,
  registerProgramLauncher,
  type LaunchHandler,
} from './launchProtocol';

// Program Launcher
export {
  programLauncher,
  useProgramLauncher,
  parseA2rUri,
  buildA2rUri,
  launchResearchDoc,
  launchDataGrid,
  launchPresentation,
  launchCodePreview,
  launchAssetManager,
  launchOrchestrator,
  launchWorkflowBuilder,
  type ProgramLaunchRequest,
  type LaunchOptions,
  type LaunchQueueItem,
  type ParsedA2rUri,
} from './ProgramLauncher';
