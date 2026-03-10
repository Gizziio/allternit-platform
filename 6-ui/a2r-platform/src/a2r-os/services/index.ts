/**
 * A2rchitect Super-Agent OS - Services Module
 * 
 * Production-ready services for kernel integration, filesystem, and execution.
 */

export * from './FileSystemService';
export * from './PythonExecutionService';
export * from './A2RRailsWebSocketBridge';
export * from './WorkspaceService';

// Re-export singletons
export { fileSystemService } from './FileSystemService';
export { pythonExecutionService } from './PythonExecutionService';
export { a2rRailsWebSocketBridge } from './A2RRailsWebSocketBridge';

// Default exports
export { FileSystemService } from './FileSystemService';
export { PythonExecutionService } from './PythonExecutionService';
export { A2RRailsWebSocketBridge } from './A2RRailsWebSocketBridge';
