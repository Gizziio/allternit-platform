/**
 * MCP Apps / Interactive Capsules
 * 
 * This package provides the protocol and runtime for MCP Apps,
 * enabling tools to return interactive UI surfaces with bidirectional
 * communication between the tool and the host.
 * 
 * @example
 * ```typescript
 * import { 
 *   createCapsule, 
 *   validateToolUISurface,
 *   MCPMessageType 
 * } from '@a2r/mcp-apps';
 * 
 * // Create a new capsule
 * const capsule = createCapsule({
 *   type: 'data-visualization',
 *   toolId: 'chart-tool',
 *   surface: {
 *     html: '<div id="chart"></div>',
 *     css: '#chart { width: 100%; }',
 *     permissions: [
 *       { type: 'tool:invoke', resource: 'update-data' }
 *     ]
 *   }
 * });
 * ```
 */

// Export all types
export * from './types/index.js';

// Export permissions system
export * from './permissions.js';

// Package metadata
export const PACKAGE_VERSION = '0.1.0';
export const PROTOCOL_VERSION = '1.0.0';

// Re-export commonly used items for convenience
export {
  CapsuleState,
  CapsulePermissionType,
  MCPMessageType,
  createMCPMessage,
  createToolInvokeMessage,
  createToolInvokeResponse,
  createHandshakeRequest,
  validateMCPMessage,
  validateCreateCapsuleRequest,
  validateToolUISurface,
  isValidMCPMessage,
  isValidCapsuleState,
} from './types/index.js';
