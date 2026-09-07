"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Archive, ShareNetwork, Warning, Lock } from "@phosphor-icons/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/time";
import { railsApi, useUnifiedStore } from "@/lib/agents";
import { isRailsApiEnabled } from "@/lib/env";

// Rails mail actions (/api/rails/mail/*) are served only by the Rust
// allternit-api (:8013) — not publicly reachable from the deployed web
// surface. When NEXT_PUBLIC_ALLTERNIT_RAILS_API is unset (default), the
// handlers below fail closed with this deliberate message.
const RAILS_API_DISABLED_MESSAGE =
  "Mail actions are disabled in this deployment (the Rails API is not publicly reachable; set NEXT_PUBLIC_ALLTERNIT_RAILS_API=1 where the gateway is reachable).";

import type { LedgerEvent, MailMessage } from "@/lib/agents";
import {
  useMonitorData,
  deriveThreadReview,
  hasGuardActivity,
  hasReservationActivity,
  isThreadArchivedLocally,
  setThreadArchivedLocally,
  buildMonitorLink,
  externalEmailThreadKind,
} from "@/views/mail-monitor/monitor.helpers";

export interface AgentActivityDetailViewProps {
  threadId: string;
}

export function AgentActivityDetailView({ threadId }: AgentActivityDetailViewProps) {
  const navigate = useNavigate();
  const mailThreads = useUnifiedStore((state) => state.mailThreads);
  const fetchMailMessages = useUnifiedStore((state) => state.fetchMailMessages);
  const fetchLedgerEvents = useUnifiedStore((state) => state.fetchLedgerEvents);
  const ackMessage = useUnifiedStore((state) => state.ackMessage);

  const monitor = useMonitorData(threadId || null);
  const messages: MailMessage[] = monitor?.messages ?? [];
  const relevantEvents: LedgerEvent[] = monitor?.relevantEvents ?? [];

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [decisionPending, setDecisionPending] = useState(false);
  const [archived, setArchived] = useState(() => isThreadArchivedLocally(threadId));
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [emailDelivery, setEmailDelivery] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const thread = useMemo(() => mailThreads.find((t) => t.thread_id === threadId), [mailThreads, threadId]);
  const topic = thread?.topic || threadId;
  const externalEmail = externalEmailThreadKind(threadId);

  const refresh = useCallback(async () => {
    if (!threadId) return;
    setLoading(true);
    setLoadError(null);
    try {
      await Promise.all([fetchMailMessages(threadId), fetchLedgerEvents(200)]);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load this thread");
    } finally {
      setLoading(false);
    }
  }, [threadId, fetchMailMessages, fetchLedgerEvents]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Ground "unread" clearing in the real ack() action rather than only a
  // client-side flag — opening the full thread is the natural "I've read
  // this" signal.
  useEffect(() => {
    const unacked = messages.filter((msg) => !msg.acknowledged);
    if (unacked.length === 0) return;
    unacked.forEach((msg) => {
      ackMessage(threadId, msg.message_id).catch(() => {
        // best-effort; unread state will simply persist until next open
      });
    });
    // Only run once per distinct set of unread message ids for this thread.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, messages.map((m) => m.message_id).join(","), ackMessage]);

  const review = useMemo(() => deriveThreadReview(relevantEvents), [relevantEvents]);
  const guardActive = hasGuardActivity(relevantEvents);
  const reservationActive = hasReservationActivity(relevantEvents);

  const handleDecide = async (approve: boolean) => {
    setDecisionPending(true);
    setActionError(null);
    setEmailDelivery(null);
    try {
      if (!isRailsApiEnabled()) throw new Error(RAILS_API_DISABLED_MESSAGE);
      const result = await railsApi.mail.decide(threadId, approve, undefined);
      // Outbound agent-email threads report the provider-side outcome on the
      // decide response (rails/mod.rs mail_decide) — surface it inline.
      if (result?.email) {
        setEmailDelivery(
          result.email.actioned
            ? `External email ${result.email.status === "sent" ? "sent to the provider" : "rejected at the provider"}.`
            : `Decision recorded, but the email action failed: ${result.email.error ?? "unknown error"}`,
        );
      }
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to record decision");
    } finally {
      setDecisionPending(false);
    }
  };

  const handleArchiveToggle = async () => {
    const next = !archived;
    setActionError(null);
    try {
      if (!isRailsApiEnabled()) throw new Error(RAILS_API_DISABLED_MESSAGE);
      // archive() takes (threadId, path, reason) — there's no thread-level
      // "hide from inbox" concept server-side, so we pass the thread id as
      // the path and track the archived/unarchived state locally (see
      // monitor.helpers.ts and AGENT_ACTIVITY_WEB_PHASE_1_NOTES.md).
      await railsApi.mail.archive(threadId, threadId, next ? "Archived from Agent Activity" : "Unarchived from Agent Activity");
      setThreadArchivedLocally(threadId, next);
      setArchived(next);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update archive state");
    }
  };

  const handleShare = async () => {
    setSharing(true);
    setActionError(null);
    try {
      if (!isRailsApiEnabled()) throw new Error(RAILS_API_DISABLED_MESSAGE);
      const assetRef = `agent-activity:${threadId}:${Date.now()}`;
      const response = await railsApi.mail.share(threadId, assetRef, "Shared from Agent Activity");
      setShareLink(buildMonitorLink(threadId, response.share_id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to share thread");
    } finally {
      setSharing(false);
    }
  };

  const handleSendReply = async () => {
    const body = replyText.trim();
    if (!body) return;
    setSending(true);
    setActionError(null);
    try {
      if (!isRailsApiEnabled()) throw new Error(RAILS_API_DISABLED_MESSAGE);
      await railsApi.mail.send({ thread_id: threadId, body_ref: body });
      setReplyText("");
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-[var(--bg-elevated)] text-[var(--text-primary)] overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-solid border-[var(--border-subtle)] shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate("/agent-activity")} aria-label="Back to Agent Activity">
          <ArrowLeft size={18} />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-lg font-semibold m-0 truncate">{topic}</h1>
            {externalEmail && (
              <span
                className="shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold leading-none"
                style={{ background: "var(--status-info-bg)", color: "var(--status-info)" }}
              >
                ✉ external email {externalEmail === "inbound" ? "· inbound" : "· outbound"}
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-[var(--text-tertiary)] m-0">{threadId}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleShare} disabled={sharing}>
            <ShareNetwork size={14} className="mr-1.5" /> {sharing ? "Sharing…" : "Share"}
          </Button>
          <Button variant={archived ? "secondary" : "outline"} size="sm" onClick={handleArchiveToggle}>
            <Archive size={14} className="mr-1.5" /> {archived ? "Unarchive" : "Archive"}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-3xl mx-auto px-6 py-6 flex flex-col gap-4">
          {shareLink && (
            <div className="text-xs rounded-lg border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 flex items-center gap-2">
              <span className="text-[var(--text-secondary)]">Share link:</span>
              <code className="truncate flex-1">{shareLink}</code>
              <button
                type="button"
                className="text-[var(--accent-primary)] font-semibold cursor-pointer bg-transparent border-none"
                onClick={() => navigator.clipboard?.writeText(shareLink)}
              >
                Copy
              </button>
            </div>
          )}

          {actionError && (
            <div className="text-xs rounded-lg border border-solid px-3 py-2" style={{ borderColor: "var(--status-error)", color: "var(--status-error)", background: "var(--status-error-bg)" }}>
              {actionError}
            </div>
          )}

          {emailDelivery && (
            <div className="text-xs rounded-lg border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-[var(--text-secondary)]">
              {emailDelivery}
            </div>
          )}

          {(guardActive || reservationActive) && (
            <div className="flex flex-col gap-2">
              {relevantEvents
                .filter((event) => /guard/i.test(event.event_type) || /reserve/i.test(event.event_type))
                .map((event) => (
                  <LedgerEventCard key={event.event_id} event={event} />
                ))}
            </div>
          )}

          {review && (
            <Card className="border" style={{ borderColor: "var(--status-warning)" }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--status-warning)" }}>
                  Review requested · {review.kind === "code-diff" ? "code diff" : "decision (no diff)"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {review.kind === "code-diff" ? (
                  <div className="font-mono text-[12px] text-[var(--text-secondary)]">📄 {review.diffRef}</div>
                ) : (
                  <p className="text-[13px] m-0">{review.ask}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleDecide(true)}
                    disabled={decisionPending}
                    style={{ color: "var(--status-success)" }}
                    variant="outline"
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleDecide(false)}
                    disabled={decisionPending}
                    style={{ color: "var(--status-error)" }}
                    variant="outline"
                  >
                    Deny
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border">
            <CardHeader>
              <CardTitle className="text-[13px] font-semibold">Messages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading && messages.length === 0 ? (
                <p className="text-xs text-muted-foreground">Loading messages…</p>
              ) : loadError ? (
                <p className="text-xs" style={{ color: "var(--status-error)" }}>{loadError}</p>
              ) : messages.length === 0 ? (
                <p className="text-xs text-muted-foreground">No messages yet.</p>
              ) : (
                messages.map((msg) => (
                  <div key={msg.message_id} className="rounded-lg border border-muted/30 p-3">
                    <div className="flex items-center justify-between text-[12px] uppercase tracking-wide text-muted-foreground">
                      <span>{msg.from_agent}</span>
                      <span>{formatRelativeTime(msg.timestamp)}</span>
                    </div>
                    <p className="text-[12px] text-foreground whitespace-pre-wrap">{msg.body}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendReply();
                }
              }}
              placeholder="Reply in this thread…"
              className="flex-1 px-3 py-2 rounded-lg border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            />
            <Button onClick={handleSendReply} disabled={sending || !replyText.trim()}>
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LedgerEventCard({ event }: { event: LedgerEvent }) {
  const isGuard = /guard/i.test(event.event_type);
  const payload = event.payload && typeof event.payload === "object" ? (event.payload as Record<string, unknown>) : null;
  const entries = payload
    ? Object.entries(payload).filter(([key]) => key !== "thread_id" && key !== "mail_thread_id")
    : [];

  return (
    <div
      className="flex gap-2 items-start text-[12px] rounded-lg border border-solid px-3 py-2"
      style={{
        borderColor: isGuard ? "var(--status-error)" : "var(--border-default)",
        background: isGuard ? "var(--status-error-bg)" : "var(--bg-elevated)",
      }}
    >
      {isGuard ? <Warning size={14} style={{ color: "var(--status-error)" }} className="mt-0.5 shrink-0" /> : <Lock size={14} className="mt-0.5 shrink-0 text-[var(--text-tertiary)]" />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold" style={{ color: isGuard ? "var(--status-error)" : "var(--text-primary)" }}>
            {event.event_type}
          </span>
          <span className="text-[11px] font-mono text-[var(--text-tertiary)] shrink-0">{formatRelativeTime(event.timestamp)}</span>
        </div>
        {entries.length > 0 ? (
          <div className="mt-1 text-[var(--text-secondary)] space-y-0.5">
            {entries.map(([key, value]) => (
              <div key={key}>
                <span className="text-[var(--text-tertiary)]">{key}: </span>
                {typeof value === "string" ? value : JSON.stringify(value)}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
