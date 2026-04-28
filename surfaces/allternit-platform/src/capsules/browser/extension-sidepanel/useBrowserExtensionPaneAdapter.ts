"use client";

import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  useBrowserAgentStore,
  type PageAgentActivity,
  type PageAgentHistoricalEvent,
  type PageAgentSessionRecord,
  type PageAgentStatus,
} from "../browserAgent.store";
import { useActiveTab, useBrowserStore } from "../browser.store";
import type {
  ExtensionSidepanelAdapter,
  ExtensionSidepanelConfig,
  ExtensionSidepanelActivity,
  ExtensionSidepanelHistoricalEvent,
  ExtensionSidepanelSessionRecord,
  ExtensionSidepanelStatus,
} from "./ExtensionSidepanelShell.types";
import {
  listSessions,
  saveSession as saveSessionToDB,
  deleteSession as deleteSessionFromDB,
  clearSessions as clearSessionsFromDB,
} from "./sessionStorage";

function mapStatus(status: PageAgentStatus): ExtensionSidepanelStatus {
  if (status === "running") return "running";
  if (status === "completed") return "completed";
  if (status === "error") return "error";
  return "idle";
}

function mapActivity(activity: PageAgentActivity | null): ExtensionSidepanelActivity | null {
  if (!activity) return null;
  return activity as ExtensionSidepanelActivity;
}

function mapHistory(
  history: PageAgentHistoricalEvent[]
): ExtensionSidepanelHistoricalEvent[] {
  return history as ExtensionSidepanelHistoricalEvent[];
}

function mapSessions(
  sessions: PageAgentSessionRecord[]
): ExtensionSidepanelSessionRecord[] {
  return sessions.map((s) => ({
    id: s.id,
    task: s.task,
    history: mapHistory(s.history),
    status: s.status,
    createdAt: s.createdAt,
  }));
}

const DEFAULT_CONFIG: ExtensionSidepanelConfig = {
  permissionMode: "act",
  language: "en-US",
  runtimeLabel: "Platform Browser",
  apiKey: undefined,
  baseURL: undefined,
  model: undefined,
  maxSteps: null,
  systemInstruction: null,
  experimentalLlmsTxt: false,
};

export function useBrowserExtensionPaneAdapter(): {
  adapter: ExtensionSidepanelAdapter;
  config: ExtensionSidepanelConfig;
} {
  const activeTab = useActiveTab();

  const pageAgentStatus = useBrowserAgentStore((s) => s.pageAgentStatus);
  const pageAgentHistory = useBrowserAgentStore((s) => s.pageAgentHistory);
  const pageAgentActivity = useBrowserAgentStore((s) => s.pageAgentActivity);
  const goal = useBrowserAgentStore((s) => s.goal);
  const pageAgentSessions = useBrowserAgentStore((s) => s.pageAgentSessions);
  const runPageAgentGoal = useBrowserAgentStore((s) => s.runPageAgentGoal);
  const stopPageAgent = useBrowserAgentStore((s) => s.stopPageAgent);
  const deletePageAgentSession = useBrowserAgentStore((s) => s.deletePageAgentSession);
  const clearPageAgentSessions = useBrowserAgentStore((s) => s.clearPageAgentSessions);

  const [config, setConfig] = useState<ExtensionSidepanelConfig>(DEFAULT_CONFIG);
  const [dbSessions, setDbSessions] = useState<PageAgentSessionRecord[]>([]);
  const [dbLoaded, setDbLoaded] = useState(false);

  // Load sessions from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;
    listSessions().then((sessions) => {
      if (!cancelled) {
        setDbSessions(sessions);
        setDbLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Merge in-memory sessions with DB sessions (in-memory takes precedence)
  const mergedSessions = useMemo(() => {
    const memoryIds = new Set(pageAgentSessions.map((s) => s.id));
    const filteredDb = dbSessions.filter((s) => !memoryIds.has(s.id));
    return [...pageAgentSessions, ...filteredDb];
  }, [pageAgentSessions, dbSessions]);

  // Persist completed sessions to IndexedDB
  const prevStatusRef = React.useRef(pageAgentStatus);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = pageAgentStatus;

    if (
      prev === "running" &&
      (pageAgentStatus === "completed" || pageAgentStatus === "error") &&
      pageAgentHistory.length > 0 &&
      goal
    ) {
      const session: PageAgentSessionRecord = {
        id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sessionId: null,
        task: goal,
        status: pageAgentStatus,
        history: pageAgentHistory,
        createdAt: Date.now(),
      };
      saveSessionToDB(session).then(() => {
        setDbSessions((prev) => [session, ...prev]);
      });
    }
  }, [pageAgentStatus, pageAgentHistory, goal]);

  const pageLabel = activeTab?.title || "New Tab";
  const hostLabel = useMemo(() => {
    try {
      if (!activeTab) return "";
      if ("url" in activeTab && activeTab.url) {
        return new URL(activeTab.url).hostname;
      }
      return "";
    } catch {
      return "";
    }
  }, [activeTab]);

  const activeTabId = useBrowserStore((s) => s.activeTabId);
  const setPageAgentTargetTabId = useBrowserAgentStore((s) => s.setPageAgentTargetTabId);

  const execute = useCallback(
    (task: string) => {
      if (activeTabId) {
        setPageAgentTargetTabId(activeTabId);
      }
      runPageAgentGoal(task, {
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        model: config.model,
        language: config.language as "en-US" | "zh-CN" | null,
        maxSteps: config.maxSteps,
        systemInstruction: config.systemInstruction,
        experimentalLlmsTxt: config.experimentalLlmsTxt,
      });
    },
    [runPageAgentGoal, config, activeTabId, setPageAgentTargetTabId]
  );

  const stop = useCallback(() => {
    setPageAgentTargetTabId(null);
    stopPageAgent();
  }, [stopPageAgent, setPageAgentTargetTabId]);

  const configure = useCallback(
    (next: Partial<ExtensionSidepanelConfig>) => {
      setConfig((prev) => ({ ...prev, ...next }));
    },
    []
  );

  const deleteSession = useCallback(
    async (id: string) => {
      deletePageAgentSession(id);
      await deleteSessionFromDB(id);
      setDbSessions((prev) => prev.filter((s) => s.id !== id));
    },
    [deletePageAgentSession]
  );

  const clearSessions = useCallback(async () => {
    clearPageAgentSessions();
    await clearSessionsFromDB();
    setDbSessions([]);
  }, [clearPageAgentSessions]);

  const adapter: ExtensionSidepanelAdapter = useMemo(
    () => ({
      status: mapStatus(pageAgentStatus),
      history: mapHistory(pageAgentHistory),
      activity: mapActivity(pageAgentActivity),
      currentTask: goal,
      sessions: mapSessions(mergedSessions),
      pageLabel,
      hostLabel,
      config,
      execute,
      stop,
      configure,
      deleteSession,
      clearSessions,
    }),
    [
      pageAgentStatus,
      pageAgentHistory,
      pageAgentActivity,
      goal,
      mergedSessions,
      pageLabel,
      hostLabel,
      config,
      execute,
      stop,
      configure,
      deleteSession,
      clearSessions,
    ]
  );

  return { adapter, config };
}
