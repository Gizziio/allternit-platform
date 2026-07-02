"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { AllternitRailsClient } from './AllternitRailsClient';
import type { DagState, BusMessage, LedgerEvent } from './rails-bridge.types';

export interface UseAllternitRailsOptions {
  workspaceId: string;
  baseUrl?: string;
  autoPoll?: boolean;
  pollInterval?: number;
  onError?: (error: Error) => void;
}

export interface UseAllternitRailsReturn {
  client: AllternitRailsClient;
  isConnected: boolean;
  dags: DagState[];
  messages: BusMessage[];
  events: LedgerEvent[];
  refresh: () => Promise<void>;
  sendMessage: (message: Omit<BusMessage, 'id' | 'status' | 'created_at'>) => Promise<number>;
  createSession: (name: string) => Promise<{ id: string; name: string }>;
  createTerminalSession: (name: string) => Promise<{ id: string; name: string }>;
  createPane: (sessionId: string, name: string, command?: string) => Promise<{ id: string }>;
}

export function useAllternitRails(options: UseAllternitRailsOptions): UseAllternitRailsReturn {
  const { workspaceId, baseUrl, autoPoll = true, pollInterval = 5000, onError } = options;
  
  const clientRef = useRef(new AllternitRailsClient({ workspaceId, baseUrl, onError }));
  const [isConnected, setIsConnected] = useState(false);
  const isConnectedRef = useRef(false);
  
  const [dags, setDags] = useState<DagState[]>([]);
  const [messages, setMessages] = useState<BusMessage[]>([]);
  const [events, setEvents] = useState<LedgerEvent[]>([]);

  // Update client config when dependencies change
  useEffect(() => {
    clientRef.current.updateConfig({ workspaceId, baseUrl, onError });
  }, [workspaceId, baseUrl, onError]);

  const checkHealth = useCallback(async () => {
    const healthy = await clientRef.current.healthCheck();
    if (healthy !== isConnectedRef.current) {
      isConnectedRef.current = healthy;
      setIsConnected(healthy);
    }
    return healthy;
  }, []);

  const refresh = useCallback(async () => {
    const healthy = await checkHealth();
    if (!healthy) return;

    try {
      const [dagsData, messagesData, eventsData] = await Promise.all([
        clientRef.current.listDags(),
        clientRef.current.pollPendingMessages(),
        clientRef.current.getLedgerEvents(),
      ]);

      setDags(dagsData);
      setMessages(messagesData);
      setEvents(eventsData);
    } catch (err) {
      if (onError) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }, [checkHealth, onError]);
  const sendMessage = useCallback(async (
    message: Omit<BusMessage, 'id' | 'status' | 'created_at'>
  ): Promise<number> => {
    const id = await clientRef.current.sendBusMessage(message);
    await refresh();
    return id;
  }, [refresh]);

  const createSession = useCallback(async (name: string) => {
    const session = await clientRef.current.createTerminalSession(name);
    await refresh();
    return session;
  }, [refresh]);

  const createPane = useCallback(async (sessionId: string, name: string, command?: string) => {
    const pane = await clientRef.current.createPane(sessionId, name, command);
    await refresh();
    return pane;
  }, [refresh]);

  useEffect(() => {
    const poll = async () => {
      if (autoPoll) {
        await refresh();
      } else {
        await checkHealth();
      }
    };

    poll();

    let interval: NodeJS.Timeout | null = null;
    if (autoPoll) {
      interval = setInterval(refresh, pollInterval);
    } else {
      interval = setInterval(checkHealth, pollInterval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoPoll, pollInterval, refresh, checkHealth]);
  return {
    client: clientRef.current,
    isConnected,
    dags,
    messages,
    events,
    refresh,
    sendMessage,
    createSession,
    createTerminalSession: createSession,
    createPane,
  };
}
