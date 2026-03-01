"use client";

import { useCallback, useMemo, useState } from "react";
import { railsApi, useUnifiedStore } from "@/lib/agents";
import type { LedgerEvent, LogEntry, MailMessage } from "@/lib/agents";
import { useTelemetrySnapshot } from "@/lib/telemetry/useTelemetrySnapshot";

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "https://app.a2r.dev";

export function useMonitorData(threadId: string | null) {
  const mailMessages = useUnifiedStore((state) => state.mailMessages);
  const ledgerEvents = useUnifiedStore((state) => state.ledgerEvents);
  const logs = useUnifiedStore((state) => state.logs);
  const getSessionAnalytics = useUnifiedStore((state) => state.getSessionAnalytics);

  const analytics = threadId ? getSessionAnalytics(threadId) : null;

  const messages = useMemo<MailMessage[]>(() => {
    if (!threadId) return [];
    return mailMessages.filter((msg) => msg.thread_id === threadId);
  }, [mailMessages, threadId]);

  const relevantEvents = useMemo<LedgerEvent[]>(() => {
    if (!threadId) return [];
    return ledgerEvents
      .filter((event) => {
        const payload = event.payload as Record<string, unknown>;
        if (!payload || typeof payload !== "object") return false;
        return payload["thread_id"] === threadId || payload["mail_thread_id"] === threadId;
      })
      .slice(-4)
      .reverse();
  }, [ledgerEvents, threadId]);

  const relevantLogs = useMemo<LogEntry[]>(() => {
    if (!threadId) return [];
    return logs.filter((log) => log.threadId === threadId).slice(-4);
  }, [logs, threadId]);

  const telemetry = useTelemetrySnapshot(threadId);

  return { analytics, messages, relevantEvents, relevantLogs, telemetry };
}

export function useMonitorShare(threadId: string | null) {
  const [shareId, setShareId] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const shareMonitor = useCallback(async () => {
    if (!threadId) return null;
    if (shareId) return shareId;
    setIsSharing(true);
    try {
      const assetRef = `monitor:${threadId}:${Date.now()}`;
      const response = await railsApi.mail.share(threadId, assetRef, "Live monitor share");
      setShareId(response.share_id);
      return response.share_id;
    } catch (error) {
      console.error("Failed to share monitor", error);
      return null;
    } finally {
      setIsSharing(false);
    }
  }, [threadId, shareId]);

  const monitorLink = threadId ? buildMonitorLink(threadId, shareId) : "";

  return { shareId, isSharing, shareMonitor, monitorLink };
}

export function buildMonitorLink(threadId: string, shareId: string | null) {
  if (shareId) {
    return `${BASE_URL}/mail/share/${shareId}`;
  }
  return `${BASE_URL}/mail/monitor/${threadId}`;
}
