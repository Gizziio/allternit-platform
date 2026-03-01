/**
 * Tool Hooks System
 * 
 * Provides preToolUse and postToolUse hooks for:
 * - Tool confirmation dialogs
 * - Tool execution audit logging
 * - Tool result post-processing
 * - Access control and routing
 * 
 * Based on the kernel pattern from integration/kernel/index.ts
 */

import { useCallback } from "react";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

// ============================================================================
// Types
// ============================================================================

export type ToolDecision = "allow" | "deny" | "confirm";

export interface ToolContext {
  toolName: string;
  toolCallId: string;
  sessionId: string;
  arguments: Record<string, unknown>;
  timestamp: string;
}

export interface ToolRoutingResult {
  decision: ToolDecision;
  reason?: string;
  modifiedArgs?: Record<string, unknown>;
}

export type PreToolUseFunction = (
  context: ToolContext
) => Promise<ToolRoutingResult> | ToolRoutingResult;

export type PostToolUseFunction = (
  context: ToolContext,
  result: unknown,
  error?: string
) => Promise<void> | void;

export interface PendingToolConfirmation {
  toolCallId: string;
  sessionId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  description: string;
  requestedAt: string;
  resolve: (decision: ToolRoutingResult) => void;
  reject: (reason: Error) => void;
}

export interface ToolHooksState {
  // Registered hooks (using plain objects instead of Maps for Immer compatibility)
  preToolHooks: Record<string, PreToolUseFunction>;
  postToolHooks: Record<string, PostToolUseFunction>;
  
  // Pending confirmations
  pendingConfirmations: PendingToolConfirmation[];
  
  // Audit log
  toolExecutions: ToolExecutionRecord[];
}

export interface ToolExecutionRecord {
  id: string;
  toolName: string;
  sessionId: string;
  toolCallId: string;
  arguments: Record<string, unknown>;
  status: "pending" | "confirmed" | "denied" | "executing" | "completed" | "failed";
  requestedAt: string;
  confirmedAt?: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
  confirmedBy?: string;
}

interface ToolHooksActions {
  // Hook registration
  registerPreToolUse: (name: string, fn: PreToolUseFunction) => void;
  unregisterPreToolUse: (name: string) => void;
  registerPostToolUse: (name: string, fn: PostToolUseFunction) => void;
  unregisterPostToolUse: (name: string) => void;
  
  // Tool routing
  routeToolUse: (context: ToolContext) => Promise<ToolRoutingResult>;
  executePostToolHooks: (context: ToolContext, result: unknown, error?: string) => Promise<void>;
  
  // Confirmation flow
  requestConfirmation: (context: ToolContext, description: string) => Promise<ToolRoutingResult>;
  confirmTool: (toolCallId: string, modifiedArgs?: Record<string, unknown>) => void;
  denyTool: (toolCallId: string, reason?: string) => void;
  dismissConfirmation: (toolCallId: string) => void;
  
  // Audit logging
  logToolExecution: (record: Omit<ToolExecutionRecord, "id">) => string;
  updateToolExecution: (id: string, updates: Partial<ToolExecutionRecord>) => void;
  getExecutionsForSession: (sessionId: string) => ToolExecutionRecord[];
  
  // Query
  getPendingConfirmationsForSession: (sessionId: string) => PendingToolConfirmation[];
  hasPendingConfirmations: (sessionId: string) => boolean;
}

// ============================================================================
// Store
// ============================================================================

export const useToolHooksStore = create<ToolHooksState & ToolHooksActions>()(
  immer((set, get) => ({
    // Initial state
    preToolHooks: {},
    postToolHooks: {},
    pendingConfirmations: [],
    toolExecutions: [],

    // -------------------------------------------------------------------------
    // Hook Registration
    // -------------------------------------------------------------------------

    registerPreToolUse: (name, fn) => {
      set((state) => {
        state.preToolHooks[name] = fn;
      });
    },

    unregisterPreToolUse: (name) => {
      set((state) => {
        delete state.preToolHooks[name];
      });
    },

    registerPostToolUse: (name, fn) => {
      set((state) => {
        state.postToolHooks[name] = fn;
      });
    },

    unregisterPostToolUse: (name) => {
      set((state) => {
        delete state.postToolHooks[name];
      });
    },

    // -------------------------------------------------------------------------
    // Tool Routing
    // -------------------------------------------------------------------------

    routeToolUse: async (context) => {
      const { preToolHooks, requestConfirmation } = get();
      
      // Run through all pre-tool hooks
      for (const [name, fn] of Object.entries(preToolHooks)) {
        try {
          const result = await fn(context);
          
          // If any hook denies, stop immediately
          if (result.decision === "deny") {
            return result;
          }
          
          // If any hook requires confirmation, request it
          if (result.decision === "confirm") {
            return requestConfirmation(context, result.reason || `${name} requires confirmation`);
          }
          
          // Allow continues to next hook
        } catch (error) {
          console.error(`Pre-tool hook "${name}" failed:`, error);
          // Continue to next hook on error
        }
      }
      
      // All hooks passed
      return { decision: "allow" };
    },

    executePostToolHooks: async (context, result, error) => {
      const { postToolHooks } = get();
      
      for (const fn of Object.values(postToolHooks)) {
        try {
          await fn(context, result, error);
        } catch (err) {
          console.error(`Post-tool hook failed:`, err);
        }
      }
    },

    // -------------------------------------------------------------------------
    // Confirmation Flow
    // -------------------------------------------------------------------------

    requestConfirmation: async (context, description) => {
      return new Promise((resolve, reject) => {
        const confirmation: PendingToolConfirmation = {
          toolCallId: context.toolCallId,
          sessionId: context.sessionId,
          toolName: context.toolName,
          arguments: context.arguments,
          description,
          requestedAt: new Date().toISOString(),
          resolve,
          reject,
        };

        set((state) => {
          state.pendingConfirmations.push(confirmation);
        });
      });
    },

    confirmTool: (toolCallId, modifiedArgs) => {
      set((state) => {
        const index = state.pendingConfirmations.findIndex(
          (c) => c.toolCallId === toolCallId
        );
        
        if (index !== -1) {
          const confirmation = state.pendingConfirmations[index];
          confirmation.resolve({
            decision: "allow",
            modifiedArgs,
          });
          state.pendingConfirmations.splice(index, 1);
        }
      });
    },

    denyTool: (toolCallId, reason) => {
      set((state) => {
        const index = state.pendingConfirmations.findIndex(
          (c) => c.toolCallId === toolCallId
        );
        
        if (index !== -1) {
          const confirmation = state.pendingConfirmations[index];
          confirmation.resolve({
            decision: "deny",
            reason: reason || "User denied tool execution",
          });
          state.pendingConfirmations.splice(index, 1);
        }
      });
    },

    dismissConfirmation: (toolCallId) => {
      set((state) => {
        const index = state.pendingConfirmations.findIndex(
          (c) => c.toolCallId === toolCallId
        );
        
        if (index !== -1) {
          const confirmation = state.pendingConfirmations[index];
          confirmation.reject(new Error("Confirmation dismissed"));
          state.pendingConfirmations.splice(index, 1);
        }
      });
    },

    // -------------------------------------------------------------------------
    // Audit Logging
    // -------------------------------------------------------------------------

    logToolExecution: (record) => {
      const id = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      
      set((state) => {
        state.toolExecutions.push({
          ...record,
          id,
        });
      });
      
      return id;
    },

    updateToolExecution: (id, updates) => {
      set((state) => {
        const execution = state.toolExecutions.find((e) => e.id === id);
        if (execution) {
          Object.assign(execution, updates);
        }
      });
    },

    getExecutionsForSession: (sessionId) => {
      return get().toolExecutions.filter((e) => e.sessionId === sessionId);
    },

    // -------------------------------------------------------------------------
    // Query
    // -------------------------------------------------------------------------

    getPendingConfirmationsForSession: (sessionId) => {
      return get().pendingConfirmations.filter((c) => c.sessionId === sessionId);
    },

    hasPendingConfirmations: (sessionId) => {
      return get().pendingConfirmations.some((c) => c.sessionId === sessionId);
    },
  }))
);

// ============================================================================
// Built-in Hooks
// ============================================================================

/**
 * Create a confirmation hook for tools that require user confirmation
 */
export function createConfirmationHook(
  shouldConfirm: (toolName: string, args: Record<string, unknown>) => boolean
): PreToolUseFunction {
  return (context: ToolContext): ToolRoutingResult => {
    if (shouldConfirm(context.toolName, context.arguments)) {
      return {
        decision: "confirm",
        reason: `The tool "${context.toolName}" requires confirmation`,
      };
    }
    return { decision: "allow" };
  };
}

/**
 * Create an audit logging hook
 */
export function createAuditHook(): PostToolUseFunction {
  return (context: ToolContext, result: unknown, error?: string) => {
    const store = useToolHooksStore.getState();
    
    // Find existing execution record or create new one
    const existing = store.toolExecutions.find(
      (e) => e.toolCallId === context.toolCallId
    );
    
    if (existing) {
      store.updateToolExecution(existing.id, {
        status: error ? "failed" : "completed",
        completedAt: new Date().toISOString(),
        result,
        error,
      });
    }
  };
}

// ============================================================================
// React Hooks
// ============================================================================

/**
 * Hook to get pending tool confirmations for a session
 */
export function usePendingToolConfirmations(sessionId: string) {
  const store = useToolHooksStore();
  
  return {
    confirmations: store.getPendingConfirmationsForSession(sessionId),
    hasPending: store.hasPendingConfirmations(sessionId),
    confirmTool: store.confirmTool,
    denyTool: store.denyTool,
    dismissConfirmation: store.dismissConfirmation,
  };
}

/**
 * Hook to get tool execution history for a session
 */
export function useToolExecutionHistory(sessionId: string) {
  const store = useToolHooksStore();
  
  return {
    executions: store.getExecutionsForSession(sessionId),
  };
}

/**
 * Hook to register tool hooks (for use in components)
 */
export function useToolHooks() {
  const store = useToolHooksStore();
  
  return {
    registerPreToolUse: useCallback(
      (name: string, fn: PreToolUseFunction) => {
        store.registerPreToolUse(name, fn);
        return () => store.unregisterPreToolUse(name);
      },
      [store]
    ),
    registerPostToolUse: useCallback(
      (name: string, fn: PostToolUseFunction) => {
        store.registerPostToolUse(name, fn);
        return () => store.unregisterPostToolUse(name);
      },
      [store]
    ),
  };
}

// ============================================================================
// Initialize Default Hooks
// ============================================================================

// Register audit logging hook
useToolHooksStore.getState().registerPostToolUse("audit", createAuditHook());
