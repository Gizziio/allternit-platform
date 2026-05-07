import { z } from 'zod';

/**
 * ToolDefinition - First-class contract for agent tools
 */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  /**
   * Optional execute function for local tools.
   * If omitted, the tool is considered "external" or handled by the harness.
   */
  execute?: (args: any, context: any) => Promise<any>;
}

/**
 * DeferredToolDefinition - Tools that are known but not yet "active" in the context window.
 * The model can "discover" these via tool_search and then "activate" them.
 */
export interface DeferredToolDefinition extends Omit<ToolDefinition, 'execute'> {
  id: string;
  category?: string;
  tags?: string[];
}

/**
 * ToolActivationRequest - Emitted when a model wants to "install" a deferred tool.
 */
export interface ToolActivationRequest {
  toolId: string;
  reason?: string;
}

/**
 * ToolRegistrySnapshot - For session persistence/rehydration
 */
export interface ToolRegistrySnapshot {
  activeToolNames: string[];
  discoveredToolIds: string[];
  sessionPolicies: Record<string, ToolPolicy>;
}

export type ToolPolicy = 'allow' | 'require_approval' | 'deny';

/**
 * Tool Lifecycle Events
 */
export type ToolLifecycleEvent = 
  | { type: 'tool.registered'; tool: ToolDefinition | DeferredToolDefinition }
  | { type: 'tool.discovered'; toolId: string; metadata?: any }
  | { type: 'tool.activated'; toolId: string }
  | { type: 'tool.called'; toolName: string; callId: string; input: any }
  | { type: 'tool.completed'; toolName: string; callId: string; output: any }
  | { type: 'tool.failed'; toolName: string; callId: string; error: string };
