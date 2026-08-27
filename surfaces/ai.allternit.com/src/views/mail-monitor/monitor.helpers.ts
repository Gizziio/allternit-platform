// @ts-nocheck
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUnifiedStore } from "@/lib/agents";
import type { LedgerEvent, LogEntry, SessionAnalytics } from "@/lib/agents";
import { useTelemetrySnapshot } from "@/lib/telemetry/useTelemetrySnapshot";

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('Monitor.helpers');

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "https://app.allternit.dev";

// ============================================================================
// Shared, pure derivation helpers
//
// These exist because the real data model has no first-class "review status"
// or "reservation" object attached to a thread — see AGENT_ACTIVITY_WEB_PHASE_1_NOTES.md.
// `relevantEvents` (ledgerEvents filtered by payload.thread_id / mail_thread_id)
// is the only signal, and `event_type` is a free-form string, so status here is
// a best-effort heuristic (substring match on event_type), not a guaranteed field.
// ============================================================================

export function filterEventsForThread(events: LedgerEvent[], threadId: string): LedgerEvent[] {
  return events.filter((event) => {
    const payload = event.payload as Record<string, unknown>;
    if (!payload || typeof payload !== "object") return false;
    return payload["thread_id"] === threadId || payload["mail_thread_id"] === threadId;
  });
}

// External agent email (agent_email_routes.rs) is bridged into Rails Mail
// under reserved thread-id prefixes: inbound mail lands on
// `mail:email-in-<agent>`, outbound approval-gated sends on
// `mail:email-out-<uuid>`. Anything else is internal agent-to-agent mail.
export type ExternalEmailThreadKind = "inbound" | "outbound";

export function externalEmailThreadKind(threadId: string): ExternalEmailThreadKind | null {
  if (threadId.startsWith("mail:email-in-")) return "inbound";
  if (threadId.startsWith("mail:email-out-")) return "outbound";
  return null;
}

// The backend emits `ReviewDecision` for an approve/reject resolution
// (rails/src/mail/mail.rs:decide_review). It contains the substring
// "review", so a naive /review/i match misclassifies it as a request.
// Decision events must be excluded from review-request matching.
function isDecisionEvent(eventType: string): boolean {
  return /decide/i.test(eventType) || eventType === "ReviewDecision";
}

function isReviewRequestEvent(eventType: string): boolean {
  return /review/i.test(eventType) && !isDecisionEvent(eventType);
}

export type AgentActivityReviewKind = "code-diff" | "decision";

export interface AgentActivityReview {
  kind: AgentActivityReviewKind;
  ask: string;
  diffRef?: string;
  requestedAt: string;
}

/**
 * decide() is strictly boolean (see rails.service.ts) — there is no 3-way
 * decision in the real API. A review is only "code-diff" typed when the
 * requestReview event's payload actually carried a diff_ref; otherwise it's
 * rendered as a plain decision ask.
 */
export function deriveThreadReview(events: LedgerEvent[]): AgentActivityReview | null {
  const sorted = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const requested = sorted.find((event) => isReviewRequestEvent(event.event_type));
  if (!requested) return null;

  const decided = sorted.find((event) => isDecisionEvent(event.event_type));
  if (decided && new Date(decided.timestamp).getTime() > new Date(requested.timestamp).getTime()) {
    return null; // a later decide() event means this ask is already resolved
  }

  const payload = (requested.payload && typeof requested.payload === "object"
    ? requested.payload
    : {}) as Record<string, unknown>;
  const diffRef = (payload["diff_ref"] as string) || (payload["diffRef"] as string) || undefined;
  const note = (payload["note"] as string) || (payload["notes_ref"] as string) || undefined;

  return {
    kind: diffRef ? "code-diff" : "decision",
    diffRef,
    ask: note || (diffRef ? `Code changes ready for review: ${diffRef}` : "Agent is requesting a decision on this thread."),
    requestedAt: requested.timestamp,
  };
}

export function hasGuardActivity(events: LedgerEvent[]): boolean {
  return events.some((event) => /guard/i.test(event.event_type));
}

export function hasReservationActivity(events: LedgerEvent[]): boolean {
  return events.some((event) => /reserve/i.test(event.event_type));
}

// ============================================================================
// Client-side "archived" tracking
//
// MailThread (rails.service.ts) has no archived flag — archive() actually
// takes (threadId, path, reason), which reads like "release a reserved path"
// rather than "hide this thread from my inbox." We still call the real
// endpoint (no invented backend behavior), but the Review/Archived tab filter
// is driven by this local marker since the server has nothing to read back.
// ============================================================================

const ARCHIVED_STORAGE_KEY = "agent-activity:archived-thread-ids";

function readArchivedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(ARCHIVED_STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeArchivedIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ARCHIVED_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // best-effort only
  }
}

export function isThreadArchivedLocally(threadId: string): boolean {
  return readArchivedIds().has(threadId);
}

export function setThreadArchivedLocally(threadId: string, archived: boolean): void {
  const ids = readArchivedIds();
  if (archived) ids.add(threadId);
  else ids.delete(threadId);
  writeArchivedIds(ids);
}

// ============================================================================
// Single-thread data (existing — used by the detail view)
// ============================================================================

export interface MonitorData {
  analytics: SessionAnalytics | null;
  messages: MailMessage[];
  relevantEvents: LedgerEvent[];
  relevantLogs: LogEntry[];
  telemetry: {
    snapshot: import("@/lib/telemetry/schema").TelemetrySnapshot | null;
    loading: boolean;
    error: string | null;
  };
}

export function useMonitorData(threadId: string | null): MonitorData {
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
    return filterEventsForThread(ledgerEvents, threadId).slice(-4).reverse();
  }, [ledgerEvents, threadId]);

  const relevantLogs = useMemo<LogEntry[]>(() => {
    if (!threadId) return [];
    return logs.filter((log) => log.threadId === threadId).slice(-4);
  }, [logs, threadId]);

  const telemetry = useTelemetrySnapshot(threadId);

  return { analytics, messages, relevantEvents, relevantLogs, telemetry };
}

function useMonitorShare(threadId: string | null): void {
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

export function buildMonitorLink(threadId: string, shareId: string | null): string {
  if (shareId) {
    return `${BASE_URL}/mail/share/${shareId}`;
  }
  // Real route (routes.tsx): /agent-activity/:threadId — this used to point at
  // /mail/monitor/:threadId, which was never registered anywhere.
  return `${BASE_URL}/agent-activity/${threadId}`;
}

// ============================================================================
// Thread-list data (new — used by the panel and the full list page)
// ============================================================================

export interface AgentActivityThreadSummary {
  threadId: string;
  topic: string;
  createdAt: string;
  lastActivityAt: string;
  lastMessage: MailMessage | null;
  preview: string;
  unread: boolean;
  relevantEvents: LedgerEvent[];
  review: AgentActivityReview | null;
  hasGuardActivity: boolean;
  hasReservationActivity: boolean;
  archived: boolean;
}

export interface UseMonitorThreadsResult {
  threads: AgentActivityThreadSummary[];
  unreadCount: number;
  reviewCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setThreadArchived: (threadId: string, archived: boolean) => void;
}

/**
 * Thread-list variant of useMonitorData. Uses the real GET /mail/threads
 * endpoint (issue #16); the old POST /mail/inbox route does not exist on the
 * backend. Previews and unread state are derived from the thread summary and
 * ledger events — there is no global "all messages" fetch in this phase.
 */
export function useMonitorThreads(): UseMonitorThreadsResult {
  const mailThreads = useUnifiedStore((state) => state.mailThreads);
  const fetchMailThreads = useUnifiedStore((state) => state.fetchMailThreads);
  const ledgerEvents = useUnifiedStore((state) => state.ledgerEvents);
  const fetchLedgerEvents = useUnifiedStore((state) => state.fetchLedgerEvents);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archivedTick, setArchivedTick] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchMailThreads(), fetchLedgerEvents(200)]);
    } catch (err) {
      logger.error({ err }, "Failed to load agent activity threads");
      setError(err instanceof Error ? err.message : "Failed to load agent activity");
    } finally {
      setLoading(false);
    }
  }, [fetchMailThreads, fetchLedgerEvents]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setThreadArchived = useCallback((threadId: string, archived: boolean) => {
    setThreadArchivedLocally(threadId, archived);
    setArchivedTick((tick) => tick + 1);
  }, []);

  const threads = useMemo<AgentActivityThreadSummary[]>(() => {
    const summaries = mailThreads.map((thread): AgentActivityThreadSummary => {
      const relevantEvents = filterEventsForThread(ledgerEvents, thread.thread_id);
      const lastEvent = relevantEvents.length
        ? [...relevantEvents].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )[0]
        : null;
      const lastActivityAt =
        [lastEvent?.timestamp, thread.created_at]
          .filter((value): value is string => Boolean(value))
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? thread.created_at;

      return {
        threadId: thread.thread_id,
        topic: thread.topic || thread.thread_id,
        createdAt: thread.created_at,
        lastActivityAt,
        lastMessage: null,
        preview: lastEvent ? lastEvent.event_type : "No activity yet.",
        unread: false,
        relevantEvents,
        review: deriveThreadReview(relevantEvents),
        hasGuardActivity: hasGuardActivity(relevantEvents),
        hasReservationActivity: hasReservationActivity(relevantEvents),
        archived: isThreadArchivedLocally(thread.thread_id),
      };
    });

    return summaries.sort(
      (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
    );
    // archivedTick is a deliberate dependency: it forces recompute after
    // setThreadArchived writes to localStorage, which mailThreads can't see.
  }, [mailThreads, ledgerEvents, archivedTick]);

  const unreadCount = useMemo(
    () => threads.filter((thread) => thread.unread && !thread.archived).length,
    [threads]
  );
  const reviewCount = useMemo(
    () => threads.filter((thread) => thread.review && !thread.archived).length,
    [threads]
  );

  return { threads, unreadCount, reviewCount, loading, error, refresh, setThreadArchived };
}
