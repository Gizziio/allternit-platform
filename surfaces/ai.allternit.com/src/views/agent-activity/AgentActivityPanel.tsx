"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { railsApi } from "@/lib/agents";
import { isRailsApiEnabled } from "@/lib/env";
import { useMonitorThreads } from "@/views/mail-monitor/monitor.helpers";
import { AgentActivityListView, type AgentActivityTab } from "./AgentActivityListView";

export interface AgentActivityPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Quick-access slide-over (bell icon target). Renders AgentActivityListView
 * in compact mode and layers the mockup's keyboard shortcuts (j/k/Enter/1/2/a/Esc)
 * on top, scoped to while the panel is open.
 *
 * No dedicated sheet/drawer primitive exists in this codebase for shell-chrome
 * overlays (ConsoleDrawer is scoped to the Code view's console tabs; Dialog is
 * a centered modal) — this hand-rolls a slide-over the same way
 * ConversationMonitorOverlay/SearchOverlay already do, just positioned per
 * mockup-v3.html (top-right, under the bell) instead of centered.
 */
export function AgentActivityPanel({ open, onClose }: AgentActivityPanelProps) {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const { threads, refresh, setThreadArchived } = useMonitorThreads();
  const [tab, setTab] = useState<AgentActivityTab>("all");
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const visible = useMemo(() => {
    if (tab === "archived") return threads.filter((t) => t.archived);
    if (tab === "review") return threads.filter((t) => !t.archived && t.review);
    return threads.filter((t) => !t.archived);
  }, [threads, tab]);

  useEffect(() => {
    if (!open) {
      setFocusedId(null);
      return;
    }
    if (!focusedId && visible.length > 0) setFocusedId(visible[0].threadId);
  }, [open, visible, focusedId]);

  useEffect(() => {
    if (!open || !focusedId || !panelRef.current) return;
    const el = panelRef.current.querySelector<HTMLButtonElement>(
      `[data-thread-id="${CSS.escape(focusedId)}"]`
    );
    el?.focus();
  }, [open, focusedId]);

  const navigateToThread = (threadId: string) => {
    onClose();
    navigate(`/agent-activity/${threadId}`);
  };

  useEffect(() => {
    if (!open) return;

    const handleKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      const index = focusedId ? visible.findIndex((t) => t.threadId === focusedId) : -1;

      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        const next = visible[Math.min(visible.length - 1, index + 1)];
        if (next) setFocusedId(next.threadId);
      } else if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        const prev = visible[Math.max(0, index - 1)];
        if (prev) setFocusedId(prev.threadId);
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (focusedId) navigateToThread(focusedId);
      } else if (event.key === "1" || event.key === "2") {
        const focusedThread = visible.find((t) => t.threadId === focusedId);
        if (focusedThread?.review) {
          event.preventDefault();
          // Rails mail is served only by the Rust allternit-api (:8013) —
          // skip when disabled by flag instead of firing a request that 404s.
          if (isRailsApiEnabled()) {
            railsApi.mail.decide(focusedThread.threadId, event.key === "1").then(refresh);
          }
        }
      } else if (event.key === "a") {
        const focusedThread = visible.find((t) => t.threadId === focusedId);
        if (focusedThread) {
          event.preventDefault();
          const next = !focusedThread.archived;
          if (isRailsApiEnabled()) {
            railsApi.mail
              .archive(focusedThread.threadId, focusedThread.threadId, next ? "Archived from Agent Activity" : "Unarchived")
              .catch(() => {})
              .finally(() => setThreadArchived(focusedThread.threadId, next));
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [open, visible, focusedId, refresh, setThreadArchived, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1200]">
      <div
        role="button"
        tabIndex={0}
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: "var(--shell-overlay-backdrop)" }}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="absolute top-14 right-4 w-[400px] max-w-[92vw] h-[560px] max-h-[calc(100%-4rem)] rounded-2xl border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-2xl flex flex-col overflow-hidden"
      >
        <AgentActivityListView
          variant="panel"
          onNavigateThread={navigateToThread}
          activeTab={tab}
          onTabChange={(next) => {
            setTab(next);
            setFocusedId(null);
          }}
        />
        <div className="border-t border-solid border-[var(--border-subtle)] px-4 py-1.5 text-[10px] font-mono text-[var(--text-tertiary)] flex flex-wrap gap-x-3 gap-y-0.5 shrink-0">
          <span><kbd>↑↓</kbd>/<kbd>j k</kbd> navigate</span>
          <span><kbd>Enter</kbd> open</span>
          <span><kbd>1</kbd> approve</span>
          <span><kbd>2</kbd> deny</span>
          <span><kbd>a</kbd> archive</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
