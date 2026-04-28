"use client";

import React from "react";
import type {
  ExtensionSidepanelHistoryDetailViewProps,
  ExtensionSidepanelHistoricalEvent,
} from "./ExtensionSidepanelShell.types";
import {
  BACKGROUND,
  TEXT,
  BORDER,
  RADIUS,
  MODE_COLORS,
  TYPOGRAPHY,
  ANIMATION,
} from "@/design/allternit.tokens";

const browser = MODE_COLORS.browser;

function ReflectionGrid({
  reflection,
}: {
  reflection: {
    evaluation_previous_goal?: string;
    memory?: string;
    next_goal?: string;
  };
}) {
  const items = [
    { icon: "☑️", label: "eval", value: reflection.evaluation_previous_goal },
    { icon: "🧠", label: "memory", value: reflection.memory },
    { icon: "🎯", label: "goal", value: reflection.next_goal },
  ].filter((item): item is { icon: string; label: string; value: string } =>
    Boolean(item.value)
  );

  if (items.length === 0) return null;

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "14px 1fr",
          gap: "4px 8px",
        }}
      >
        {items.map((item) => (
          <React.Fragment key={item.label}>
            <span style={{ fontSize: 11 }}>{item.icon}</span>
            <span
              style={{
                fontSize: 11,
                color: TEXT.secondary,
                lineHeight: 1.4,
              }}
            >
              {item.value}
            </span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function EventCard({ event }: { event: ExtensionSidepanelHistoricalEvent }) {
  if (event.type === "step") {
    return (
      <div
        style={{
          borderRadius: RADIUS.md,
          border: `1px solid ${BORDER.subtle}`,
          background: BACKGROUND.secondary,
          padding: 10,
          borderLeft: `2px solid ${browser.accent}`,
        }}
      >
        <div
          style={{
            marginBottom: 8,
            fontSize: 11,
            fontWeight: TYPOGRAPHY.weight.semibold,
            letterSpacing: "0.05em",
            color: TEXT.primary,
          }}
        >
          Step #{(event.stepIndex ?? 0) + 1}
        </div>

        {event.reflection && <ReflectionGrid reflection={event.reflection} />}

        {event.action && (
          <div>
            <div
              style={{
                marginBottom: 4,
                fontSize: 11,
                fontWeight: TYPOGRAPHY.weight.semibold,
                color: TEXT.primary,
              }}
            >
              Action
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ color: browser.accent, fontSize: 14, marginTop: 2 }}>
                ⚡
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 12,
                    color: TEXT.secondary,
                    marginBottom: 2,
                    wordBreak: "break-all",
                  }}
                >
                  <span style={{ fontWeight: TYPOGRAPHY.weight.medium, color: TEXT.primary }}>
                    {event.action.name}
                  </span>
                  {event.action.name !== "done" && (
                    <span style={{ marginLeft: 6, opacity: 0.7 }}>
                      {JSON.stringify(event.action.input)}
                    </span>
                  )}
                </p>
                <p
                  style={{
                    fontSize: 11,
                    color: TEXT.tertiary,
                    wordBreak: "break-all",
                  }}
                >
                  {event.action.output}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (event.type === "observation") {
    return (
      <div
        style={{
          borderRadius: RADIUS.md,
          border: `1px solid ${BORDER.subtle}`,
          background: BACKGROUND.secondary,
          padding: 10,
          borderLeft: `2px solid #4ade80`,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <span style={{ color: "#4ade80", fontSize: 14, marginTop: 2 }}>👁</span>
          <span style={{ fontSize: 11, color: TEXT.secondary, lineHeight: 1.4 }}>
            {event.content}
          </span>
        </div>
      </div>
    );
  }

  if (event.type === "retry") {
    return (
      <div
        style={{
          borderRadius: RADIUS.md,
          border: `1px solid rgba(251,191,36,0.3)`,
          background: "rgba(251,191,36,0.08)",
          padding: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
          <span style={{ color: "#fbbf24", fontSize: 12, marginTop: 2 }}>↻</span>
          <span style={{ fontSize: 12, color: "#fbbf24" }}>
            {event.message} ({event.attempt}/{event.maxAttempts})
          </span>
        </div>
      </div>
    );
  }

  if (event.type === "error") {
    return (
      <div
        style={{
          borderRadius: RADIUS.md,
          border: `1px solid rgba(248,113,113,0.3)`,
          background: "rgba(248,113,113,0.08)",
          padding: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
          <span style={{ color: "#f87171", fontSize: 12, marginTop: 2 }}>✕</span>
          <span style={{ fontSize: 12, color: "#f87171" }}>{event.message}</span>
        </div>
      </div>
    );
  }

  if (event.type === "user_takeover") {
    return (
      <div
        style={{
          borderRadius: RADIUS.md,
          border: `1px solid ${BORDER.subtle}`,
          background: BACKGROUND.secondary,
          padding: 10,
        }}
      >
        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: TEXT.tertiary }}>
          User Takeover
        </span>
        <p style={{ fontSize: 12, color: TEXT.secondary, marginTop: 4 }}>
          {event.message || "Agent paused for user input."}
        </p>
      </div>
    );
  }

  return null;
}

export function BrowserExtensionHistoryDetail({
  session,
  sessionId,
  onBack,
}: ExtensionSidepanelHistoryDetailViewProps) {
  if (!session) {
    return (
      <div className="flex flex-col h-full">
        <header
          className="flex items-center gap-2 border-b px-3 py-2"
          style={{ borderColor: BORDER.subtle }}
        >
          <button
            onClick={onBack}
            className="inline-flex size-7 items-center justify-center rounded-md transition-colors hover:opacity-80"
            style={{ color: TEXT.tertiary }}
            aria-label="Back"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
          </button>
          <h2 className="flex-1 text-sm font-medium">Session Detail</h2>
        </header>
        <div className="flex-1 flex items-center justify-center opacity-50">
          <p className="text-sm">Session not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header
        className="flex items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: BORDER.subtle }}
      >
        <button
          onClick={onBack}
          className="inline-flex size-7 items-center justify-center rounded-md transition-colors hover:opacity-80"
          style={{ color: TEXT.tertiary }}
          aria-label="Back"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-medium truncate">{session.task}</h2>
          <p className="text-[11px] opacity-50">
            {session.status === "completed" ? "Completed" : "Failed"} ·{" "}
            {session.history.length} events
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {session.history.map((event, i) => (
          <EventCard key={i} event={event} />
        ))}
      </div>
    </div>
  );
}
