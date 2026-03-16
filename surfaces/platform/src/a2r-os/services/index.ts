/**
 * A2rchitect Super-Agent OS - Services Module
 * 
 * Production-ready services for kernel integration, filesystem, and execution.
 */

export * from './FileSystemService';
export * from './PythonExecutionService';
export * from './WorkspaceService';

// Re-export singletons
export { fileSystemService } from './FileSystemService';

// Default exports
export { FileSystemService } from './FileSystemService';
export { PythonExecutionBridge as PythonExecutionService } from './PythonExecutionService';
