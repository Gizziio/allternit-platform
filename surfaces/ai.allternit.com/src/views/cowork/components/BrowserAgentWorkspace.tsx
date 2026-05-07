"use client";

import { useCallback, useRef, useState } from "react";
import type { CoworkAgent, AgentTask } from "./WorkflowPipeline";

interface BrowserAgentWorkspaceProps {
  agent: CoworkAgent | null;
  sessionId: string;
  onBack?: () => void;
  onTakeover?: (sessionId: string) => void;
  onReleaseTakeover?: (sessionId: string) => void;
}

function TaskBadge({ tasks }: { tasks: AgentTask[] }) {
  const done = tasks.filter((t) => t.status === "completed").length;
  const running = tasks.filter((t) => t.status === "running").length;
  const failed = tasks.filter((t) => t.status === "failed").length;
  const total = tasks.length;

  return (
    <div style={{ display: "flex", gap: 8, fontSize: 11, alignItems: "center" }}>
      <span style={{ color: "#64748b" }}>{total} tasks</span>
      {running > 0 && (
        <span style={{ color: "#3b82f6", fontWeight: 600 }}>{running} running</span>
      )}
      {done > 0 && (
        <span style={{ color: "#10b981", fontWeight: 600 }}>{done} done</span>
      )}
      {failed > 0 && (
        <span style={{ color: "#ef4444", fontWeight: 600 }}>{failed} failed</span>
      )}
    </div>
  );
}

export function BrowserAgentWorkspace({
  agent,
  sessionId,
  onBack,
  onTakeover,
  onReleaseTakeover,
}: BrowserAgentWorkspaceProps) {
  const [isTakeover, setIsTakeover] = useState(false);
  const [isSingleMode, setIsSingleMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleTakeover = useCallback(async () => {
    await fetch(`/api/v1/cowork/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "takeover" }),
    });
    setIsTakeover(true);
    onTakeover?.(sessionId);
  }, [sessionId, onTakeover]);

  const handleRelease = useCallback(async () => {
    await fetch(`/api/v1/cowork/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "running" }),
    });
    setIsTakeover(false);
    onReleaseTakeover?.(sessionId);
  }, [sessionId, onReleaseTakeover]);

  const screenshots = agent?.screenshotUrl ? [agent.screenshotUrl] : [];

  if (!agent) {
    return (
      <div style={containerStyle}>
        <div style={{ color: "#94a3b8", fontSize: 14 }}>No agent selected</div>
      </div>
    );
  }

  if (isTakeover) {
    return (
      <div style={{ ...containerStyle, border: "1.5px solid #10b981" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px" }}>
          <button onClick={handleRelease} style={successBtnStyle}>
            ← Give back to Agent
          </button>
          <span style={{ fontSize: 12, color: "#64748b" }}>Manual control active</span>
        </div>
        <div
          style={{
            flex: 1,
            background: "#0f172a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#94a3b8",
            fontSize: 14,
          }}
        >
          Browser takeover active — agent is paused
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {onBack && (
            <button onClick={onBack} style={ghostBtnStyle}>←</button>
          )}
          <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{agent.name}</span>
          <TaskBadge tasks={agent.tasks} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => {
              setIsSingleMode(!isSingleMode);
              scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
            }}
            style={ghostBtnStyle}
            title="Toggle single/grid view"
          >
            ⊞
          </button>
        </div>
      </div>

      {screenshots.length === 1 ? (
        <div style={{ flex: 1, position: "relative", cursor: "pointer" }} onClick={handleTakeover}>
          <img
            src={screenshots[0]}
            alt={`${agent.name} view`}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
          <div style={takeoverOverlayStyle}>
            <button style={successBtnStyle}>
              ✋ Take Control
            </button>
          </div>
        </div>
      ) : screenshots.length > 1 ? (
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            padding: isSingleMode ? 0 : 8,
            overflowY: "auto",
          }}
        >
          {screenshots.map((src, i) => (
            <div
              key={i}
              onClick={handleTakeover}
              style={{
                position: "relative",
                cursor: "pointer",
                borderRadius: 8,
                overflow: "hidden",
                width: isSingleMode ? "100%" : "calc(50% - 8px)",
                height: isSingleMode ? "100%" : "calc(50% - 8px)",
              }}
            >
              <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              <div style={takeoverOverlayStyle}>
                <button style={successBtnStyle}>✋ Take Control</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>
          {agent.tasks.filter((t) => t.status === "running").length > 0
            ? "Agent is working — no screenshot yet"
            : "Agent is idle"}
        </div>
      )}

      {screenshots.length > 1 && (
        <div style={{ position: "absolute", bottom: 12, right: 12, display: "flex", gap: 4, zIndex: 10 }}>
          <button
            style={ghostBtnStyle}
            onClick={() => scrollRef.current?.scrollBy({ top: -200, behavior: "smooth" })}
          >
            ↑
          </button>
          <button
            style={ghostBtnStyle}
            onClick={() => scrollRef.current?.scrollBy({ top: 200, behavior: "smooth" })}
          >
            ↓
          </button>
        </div>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: "100%",
  height: "100%",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  overflow: "hidden",
  position: "relative",
};

const ghostBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  background: "white",
  cursor: "pointer",
  fontSize: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const successBtnStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 20,
  border: "1px solid #10b981",
  background: "#10b981",
  color: "white",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const takeoverOverlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,0.25)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  opacity: 0,
  transition: "opacity 0.2s",
};
