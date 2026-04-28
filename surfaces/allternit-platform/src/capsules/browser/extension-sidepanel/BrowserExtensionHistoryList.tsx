"use client";

import React from "react";
import type { ExtensionSidepanelHistoryListViewProps } from "./ExtensionSidepanelShell.types";

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function BrowserExtensionHistoryList({
  sessions,
  onSelect,
  onBack,
  onDeleteSession,
  onClearSessions,
}: ExtensionSidepanelHistoryListViewProps) {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={onBack}
          className="inline-flex size-7 items-center justify-center rounded-md transition-colors hover:opacity-80"
          style={{ color: "var(--muted-foreground)" }}
          aria-label="Back"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <h2 className="flex-1 text-sm font-medium">Session History</h2>
        {sessions.length > 0 && onClearSessions && (
          <button
            onClick={onClearSessions}
            className="text-xs opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: "var(--destructive)" }}
          >
            Clear all
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center opacity-50">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2">
              <path d="M3 5v5h5" />
              <path d="M3.5 10a9 9 0 1 0 2.2-4.8L3 10" />
              <path d="M12 7v5l3 2" />
            </svg>
            <p className="text-sm">No sessions yet</p>
            <p className="text-xs mt-1">Run a task to see it here</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => onSelect(session.id)}
                className="w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors hover:opacity-80"
              >
                <div
                  className="mt-0.5 size-2 rounded-full shrink-0"
                  style={{
                    background:
                      session.status === "completed"
                        ? "#22c55e"
                        : "var(--destructive)",
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{session.task}</p>
                  <p className="text-[11px] opacity-50 mt-0.5">
                    {session.history.length} events · {timeAgo(session.createdAt)}
                  </p>
                </div>
                {onDeleteSession && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="shrink-0 opacity-40 hover:opacity-100 transition-opacity mt-0.5"
                    style={{ color: "var(--muted-foreground)" }}
                    aria-label="Delete session"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 7h16" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M6 7 7 19a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
                      <path d="M9 7V4h6v3" />
                    </svg>
                  </button>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
