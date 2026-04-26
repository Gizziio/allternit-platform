/**
 * Allternit Runtime Bridge - Wrappers
 * 
 * Wrapper modules for tool execution and file operations.
 */

// Tool Wrapper
export {
  wrapToolExecution,
  createWrappedToolExecutor,
  wrapToolSet,
  wrapToolPolicy,
  isHighRiskTool,
  HIGH_RISK_TOOLS,
  type ToolWrapperOptions,
  type ToolAuditLog,
  type WrappedToolResult,
} from './tool-wrapper.js';

// File Wrapper
export {
  wrapFileOpen,
  wrapFileRead,
  wrapFileWrite,
  wrapFileDelete,
  createWrappedFileOperations,
  isProtectedPath,
  PROTECTED_PATH_PATTERNS,
  type FileWrapperOptions,
  type FileAuditLog,
  type WrappedFileResult,
  type FileOperation,
} from './file-wrapper.js';
