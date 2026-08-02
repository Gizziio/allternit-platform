"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/time";
import { useMonitorThreads, type AgentActivityThreadSummary } from "@/views/mail-monitor/monitor.helpers";

export type AgentActivityTab = "all" | "review" | "archived";
type ThreadStatus = "review" | "active" | "archived";

const STATUS_LABEL: Record<ThreadStatus, string> = {
  review: "Needs review",
  active: "Active",
  archived: "Archived",
};

function statusOf(thread: AgentActivityThreadSummary): ThreadStatus {
  if (thread.archived) return "archived";
  if (thread.review) return "review";
  return "active";
}

export interface AgentActivityListViewProps {
  /** `page` renders full chrome (header, description, wide layout); `panel` renders compact for the slide-over. */
  variant: "panel" | "page";
  /** Panel variant uses this to close itself before navigating; page variant ignores it. */
  onNavigateThread?: (threadId: string) => void;
  /** Controlled tab state — lets AgentActivityPanel keep its keyboard-nav filtered list in sync with what's rendered. Uncontrolled (internal state) when omitted. */
  activeTab?: AgentActivityTab;
  onTabChange?: (tab: AgentActivityTab) => void;
}

export function AgentActivityListView({ variant, onNavigateThread, activeTab, onTabChange }: AgentActivityListViewProps) {
  const navigate = useNavigate();
  const { threads, loading, error, reviewCount } = useMonitorThreads();
  const [internalTab, setInternalTab] = useState<AgentActivityTab>("all");
  const tab = activeTab ?? internalTab;
  const setTab = onTabChange ?? setInternalTab;

  const visible = useMemo(() => {
    if (tab === "archived") return threads.filter((t) => t.archived);
    if (tab === "review") return threads.filter((t) => !t.archived && t.review);
    return threads.filter((t) => !t.archived);
  }, [threads, tab]);

  const handleOpen = (threadId: string) => {
    if (onNavigateThread) onNavigateThread(threadId);
    else navigate(`/agent-activity/${threadId}`);
  };

  const isPage = variant === "page";

  return (
    <div className={cn("flex flex-col", isPage ? "h-full w-full overflow-hidden bg-[var(--bg-elevated)]" : "h-full")}>
      <div
        className={cn(
          "flex items-center justify-between gap-3 border-b border-solid border-[var(--border-subtle)] shrink-0",
          isPage ? "px-8 py-6" : "px-4 py-3"
        )}
      >
        <div className="min-w-0">
          <h1
            className={cn("font-semibold m-0 truncate", isPage ? "text-2xl" : "text-[13px]")}
            style={isPage ? { fontFamily: "var(--font-serif)" } : undefined}
          >
            Agent Activity
          </h1>
          {isPage && (
            <p className="m-0 mt-1 text-sm text-[var(--text-secondary)]">
              Threads across every agent — review requests, guarded work, and routine updates.
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5 rounded-lg bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] p-0.5 shrink-0">
          {(["all", "review", "archived"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer border-none transition-colors",
                tab === t
                  ? "bg-[var(--text-primary)] text-[var(--bg-elevated)]"
                  : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--border-subtle)]"
              )}
            >
              {t === "all" ? "All" : t === "review" ? `Review${reviewCount ? ` ${reviewCount}` : ""}` : "Archived"}
            </button>
          ))}
        </div>
      </div>

      <div className={cn("flex-1 overflow-y-auto min-h-0", isPage && "w-full max-w-4xl mx-auto")}>
        {loading && threads.length === 0 ? (
          <div className="p-6 text-sm text-[var(--text-secondary)]">Loading agent activity…</div>
        ) : error ? (
          <div className="p-6 text-sm" style={{ color: "var(--status-error)" }}>
            {error}
          </div>
        ) : visible.length === 0 ? (
          <div className="p-6 text-sm text-[var(--text-secondary)]">
            {tab === "archived" ? "No archived threads." : tab === "review" ? "Nothing needs review right now." : "No agent activity yet."}
          </div>
        ) : (
          <ul className="list-none m-0 p-0 divide-y divide-solid divide-[var(--border-subtle)]">
            {visible.map((thread) => (
              <AgentActivityRow key={thread.threadId} thread={thread} onOpen={() => handleOpen(thread.threadId)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AgentActivityRow({
  thread,
  onOpen,
}: {
  thread: AgentActivityThreadSummary;
  onOpen: () => void;
}) {
  const status = statusOf(thread);
  const dotColor =
    status === "review" ? "var(--status-warning)" : status === "archived" ? "var(--ui-text-muted)" : "var(--status-info)";

  return (
    <li>
      <button
        type="button"
        data-thread-id={thread.threadId}
        onClick={onOpen}
        className="w-full flex items-start gap-2.5 px-4 py-2.5 text-left bg-transparent border-none cursor-pointer hover:bg-[var(--border-subtle)]/30 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-primary)] focus-visible:-outline-offset-2"
      >
        <span className="mt-1.5 size-2 rounded-full shrink-0" style={{ background: dotColor }} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <span className={cn("truncate text-[13px]", thread.unread ? "font-bold" : "font-medium")}>{thread.topic}</span>
            {thread.unread && (
              <span className="size-1.5 rounded-full shrink-0" style={{ background: "var(--accent-primary)" }} aria-hidden="true" />
            )}
            <span className="sr-only">
              {STATUS_LABEL[status]}
              {thread.unread ? ", unread" : ""}
            </span>
            <span className="ml-auto shrink-0 text-[11px] font-mono text-[var(--text-tertiary)]">
              {formatRelativeTime(thread.lastActivityAt)}
            </span>
          </span>
          <span className="block truncate text-[12px] text-[var(--text-secondary)] mt-0.5">{thread.preview}</span>
          {(thread.review || thread.hasGuardActivity || thread.hasReservationActivity || thread.archived) && (
            <span className="flex flex-wrap gap-1 mt-1">
              {thread.review && <RowTag bg="var(--status-warning-bg)" color="var(--status-warning)">Needs review</RowTag>}
              {thread.hasGuardActivity && (
                <RowTag bg="var(--status-error-bg)" color="var(--status-error)">⛔ Guard activity</RowTag>
              )}
              {thread.hasReservationActivity && (
                <RowTag bg="var(--border-subtle)" color="var(--text-tertiary)">🔒 Reserved</RowTag>
              )}
              {thread.archived && (
                <RowTag bg="var(--border-subtle)" color="var(--text-tertiary)">📦 Archived</RowTag>
              )}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

function RowTag({ children, bg, color }: { children: ReactNode; bg: string; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold leading-none"
      style={{ background: bg, color }}
    >
      {children}
    </span>
  );
}
