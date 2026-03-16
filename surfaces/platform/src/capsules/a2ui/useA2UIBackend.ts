// ============================================================================
// useA2UIBackend - Backend-Connected A2UI Hook
// ============================================================================
// This hook connects A2UI components to the backend API
// Handles action execution, data model persistence, and session management
// ============================================================================

import { useState, useCallback, useEffect, useRef } from "react";
import { a2uiApi, type A2UISession, type A2UIActionResponse } from "@/integration/a2ui-client";
import type { A2UIPayload } from "./a2ui.types";

export interface UseA2UIBackendOptions {
  /** Initial A2UI payload (for new sessions) */
  initialPayload?: A2UIPayload;
  /** Existing session ID (to resume) */
  sessionId?: string;
  /** Chat ID this A2UI belongs to */
  chatId: string;
  /** Message ID this A2UI was generated in */
  messageId?: string;
  /** Agent ID that generated this A2UI */
  agentId?: string;
  /** Callback when action is executed */
  onActionComplete?: (response: A2UIActionResponse) => void;
  /** Callback when data model changes */
  onDataModelChange?: (dataModel: Record<string, unknown>) => void;
  /** Auto-save data model changes */
  autoSave?: boolean;
}

export interface UseA2UIBackendReturn {
  /** Current A2UI payload */
  payload: A2UIPayload | null;
  /** Current data model */
  dataModel: Record<string, unknown>;
  /** Session ID */
  sessionId: string | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Execute an action */
  executeAction: (actionId: string, payload?: Record<string, unknown>) => Promise<A2UIActionResponse>;
  /** Update data model */
  updateDataModel: (path: string, value: unknown) => void;
  /** Set data model directly */
  setDataModel: (dataModel: Record<string, unknown>) => void;
  /** Refresh session from backend */
  refresh: () => Promise<void>;
  /** Delete session */
  delete: () => Promise<void>;
}

/**
 * Backend-connected A2UI hook
 * 
 * Usage:
 * ```tsx
 * const a2ui = useA2UIBackend({
 *   chatId: "chat-123",
 *   initialPayload: payloadFromAgent,
 *   onActionComplete: (res) => console.log(res),
 * });
 * 
 * // In component
 * <A2UIRenderer
 *   payload={a2ui.payload}
 *   onAction={a2ui.executeAction}
 * />
 * ```
 */
export function useA2UIBackend(options: UseA2UIBackendOptions): UseA2UIBackendReturn {
  const [sessionId, setSessionId] = useState<string | null>(options.sessionId || null);
  const [payload, setPayload] = useState<A2UIPayload | null>(options.initialPayload || null);
  const [dataModel, setDataModelState] = useState<Record<string, unknown>>(
    options.initialPayload?.dataModel || {}
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const autoSave = options.autoSave !== false;
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize session on mount
  useEffect(() => {
    if (options.sessionId) {
      // Load existing session
      loadSession(options.sessionId);
    } else if (options.initialPayload && !sessionId) {
      // Create new session
      createSession();
    }
  }, []);

  // Load session from backend
  const loadSession = async (sid: string) => {
    try {
      setLoading(true);
      setError(null);
      const session = await a2uiApi.getSession(sid);
      setSessionId(session.id);
      setPayload(session.payload);
      setDataModelState(session.dataModel);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load session"));
    } finally {
      setLoading(false);
    }
  };

  // Create new session
  const createSession = async () => {
    if (!options.initialPayload) return;

    try {
      setLoading(true);
      setError(null);
      const session = await a2uiApi.createSession(options.chatId, options.initialPayload, {
        messageId: options.messageId,
        agentId: options.agentId,
      });
      setSessionId(session.id);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to create session"));
    } finally {
      setLoading(false);
    }
  };

  // Execute action
  const executeAction = useCallback(
    async (actionId: string, actionPayload?: Record<string, unknown>): Promise<A2UIActionResponse> => {
      if (!sessionId) {
        throw new Error("No active session");
      }

      try {
        setLoading(true);
        setError(null);

        const response = await a2uiApi.executeAction({
          sessionId,
          actionId,
          payload: actionPayload,
          dataModel,
          context: {
            chatId: options.chatId,
            messageId: options.messageId,
          },
        });

        // Update local state if response includes changes
        if (response.payload) {
          setPayload(response.payload);
        }

        if (response.dataModelUpdates) {
          const newDataModel = { ...dataModel, ...response.dataModelUpdates };
          setDataModelState(newDataModel);
          options.onDataModelChange?.(newDataModel);
        }

        options.onActionComplete?.(response);
        return response;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Action failed");
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [sessionId, dataModel, options.chatId, options.messageId]
  );

  // Update data model (with path)
  const updateDataModel = useCallback(
    (path: string, value: unknown) => {
      const parts = path.split(".");
      const newDataModel = { ...dataModel };
      let current: Record<string, unknown> = newDataModel;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        current[part] = { ...(current[part] as Record<string, unknown>) };
        current = current[part] as Record<string, unknown>;
      }

      current[parts[parts.length - 1]] = value;
      setDataModelState(newDataModel);
      options.onDataModelChange?.(newDataModel);

      // Auto-save to backend
      if (autoSave && sessionId) {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          a2uiApi.updateDataModel(sessionId, newDataModel).catch(console.error);
        }, 500);
      }
    },
    [dataModel, sessionId, autoSave]
  );

  // Set data model directly
  const setDataModel = useCallback(
    (newDataModel: Record<string, unknown>) => {
      setDataModelState(newDataModel);
      options.onDataModelChange?.(newDataModel);

      // Auto-save to backend
      if (autoSave && sessionId) {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          a2uiApi.updateDataModel(sessionId, newDataModel).catch(console.error);
        }, 500);
      }
    },
    [sessionId, autoSave]
  );

  // Refresh session
  const refresh = useCallback(async () => {
    if (!sessionId) return;
    await loadSession(sessionId);
  }, [sessionId]);

  // Delete session
  const deleteSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      await a2uiApi.deleteSession(sessionId);
      setSessionId(null);
      setPayload(null);
      setDataModelState({});
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to delete session"));
    }
  }, [sessionId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    payload,
    dataModel,
    sessionId,
    loading,
    error,
    executeAction,
    updateDataModel,
    setDataModel,
    refresh,
    delete: deleteSession,
  };
}

export default useA2UIBackend;
