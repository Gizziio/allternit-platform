/**
 * useCapsule Hook
 * 
 * High-level React hook for capsule management.
 * Combines Redux state with bridge connectivity.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import type { ThunkDispatch } from '@reduxjs/toolkit';
import type { Capsule, CapsuleEvent } from '../store/slices/mcpAppsSlice';
import {
  fetchCapsule,
  createCapsule,
  deleteCapsule,
  updateCapsuleState,
  sendCapsuleEvent,
  setActiveCapsule,
  addEvent,
  setConnectionStatus,
  selectCapsuleById,
  selectCapsuleEvents,
  selectActiveCapsule,
  selectMcpAppsLoading,
  selectMcpAppsError,
  type CreateCapsuleRequest,
} from '../store/slices/mcpAppsSlice';
import type { ToolUISurface } from '../components/CapsuleFrame';

export interface UseCapsuleOptions {
  capsuleId?: string;
  autoConnect?: boolean;
}

export interface UseCapsuleReturn {
  // Data
  capsule: Capsule | null;
  events: CapsuleEvent[];
  activeCapsule: Capsule | null;
  
  // State
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  
  // Actions
  create: (request: CreateCapsuleRequest) => Promise<Capsule>;
  remove: (id: string) => Promise<void>;
  activate: (id: string) => void;
  setState: (state: 'pending' | 'active' | 'error' | 'closed') => Promise<void>;
  sendEvent: (eventType: string, payload?: unknown) => Promise<void>;
  refresh: () => Promise<void>;
  reconnect: () => void;
}

// Type for the Redux dispatch that includes thunks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppDispatch = ThunkDispatch<any, any, any>;

export function useCapsule(options: UseCapsuleOptions = {}): UseCapsuleReturn {
  const { capsuleId, autoConnect = true } = options;
  const dispatch = useDispatch<AppDispatch>();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Selectors
  const capsule = useSelector((state: any) =>
    capsuleId ? selectCapsuleById(state, capsuleId) : null
  );
  const events = useSelector((state: any) =>
    capsuleId ? selectCapsuleEvents(state, capsuleId) : []
  );
  const activeCapsule = useSelector(selectActiveCapsule);
  const isLoading = useSelector(selectMcpAppsLoading);
  const error = useSelector(selectMcpAppsError);

  // Derived state
  const isConnected = useMemo(() => {
    return !!eventSourceRef.current && eventSourceRef.current.readyState === EventSource.OPEN;
  }, [eventSourceRef.current?.readyState]);

  // Connect to event stream
  const connectEventStream = useCallback(() => {
    if (!capsuleId) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    dispatch(setConnectionStatus('connecting'));

    const eventSource = new EventSource(`/api/v1/mcp-apps/capsules/${capsuleId}/stream`);

    eventSource.onopen = () => {
      dispatch(setConnectionStatus('connected'));
      reconnectAttemptsRef.current = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        dispatch(addEvent(data));
      } catch (err) {
        console.error('[useCapsule] Failed to parse event:', err);
      }
    };

    eventSource.onerror = () => {
      dispatch(setConnectionStatus('disconnected'));
      eventSource.close();

      // Exponential backoff reconnect
      reconnectAttemptsRef.current++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);

      reconnectTimerRef.current = setTimeout(() => {
        if (autoConnect) {
          connectEventStream();
        }
      }, delay);
    };

    eventSourceRef.current = eventSource;
  }, [capsuleId, dispatch, autoConnect]);

  // Disconnect from event stream
  const disconnectEventStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    dispatch(setConnectionStatus('disconnected'));
  }, [dispatch]);

  // Actions
  const create = useCallback(
    async (request: CreateCapsuleRequest): Promise<Capsule> => {
      const result = await dispatch(createCapsule(request));
      if (createCapsule.fulfilled.match(result)) {
        return result.payload;
      }
      throw new Error(result.payload as string);
    },
    [dispatch]
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      await dispatch(deleteCapsule(id));
    },
    [dispatch]
  );

  const activate = useCallback(
    (id: string) => {
      dispatch(setActiveCapsule(id));
    },
    [dispatch]
  );

  const setState = useCallback(
    async (state: 'pending' | 'active' | 'error' | 'closed'): Promise<void> => {
      if (!capsuleId) return;
      await dispatch(updateCapsuleState({ id: capsuleId, state }));
    },
    [dispatch, capsuleId]
  );

  const sendEvent = useCallback(
    async (eventType: string, payload?: unknown): Promise<void> => {
      if (!capsuleId) return;
      await dispatch(sendCapsuleEvent({ id: capsuleId, event_type: eventType, payload }));
    },
    [dispatch, capsuleId]
  );

  const refresh = useCallback(async (): Promise<void> => {
    if (!capsuleId) return;
    await dispatch(fetchCapsule(capsuleId));
  }, [dispatch, capsuleId]);

  const reconnect = useCallback((): void => {
    disconnectEventStream();
    reconnectAttemptsRef.current = 0;
    connectEventStream();
  }, [disconnectEventStream, connectEventStream]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && capsuleId) {
      refresh();
      connectEventStream();
    }

    return () => {
      disconnectEventStream();
    };
  }, [autoConnect, capsuleId, refresh, connectEventStream, disconnectEventStream]);

  return {
    // Data
    capsule,
    events,
    activeCapsule,

    // State
    isLoading,
    error,
    isConnected,

    // Actions
    create,
    remove,
    activate,
    setState,
    sendEvent,
    refresh,
    reconnect,
  };
}

export default useCapsule;
