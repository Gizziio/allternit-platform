import React, { useEffect, useState } from "react";
import { execEvents } from "../integration/execution/exec.events";
import type { ToolCall } from "../integration/execution/exec.types";

function VoiceOrbWidget() {
  const [state, setState] = useState<"idle" | "active">("idle");
  const [lastMessage, setLastMessage] = useState<string>("Idle");

  useEffect(() => {
    const unsubStart = execEvents.on("onRunStart", () => {
      setState("active");
      setLastMessage("Listening…");
    });
    const unsubLog = execEvents.on("onLog", (log) => {
      if (log.message) setLastMessage(log.message);
    });
    const unsubComplete = execEvents.on("onRunComplete", () => {
      setState("idle");
      setLastMessage("Idle");
    });
    return () => {
      unsubStart();
      unsubLog();
      unsubComplete();
    };
  }, []);

  return (
    <div style={{ pointerEvents: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: "50%",
        background: state === "active"
          ? "radial-gradient(circle at 30% 30%, var(--status-info), color-mix(in srgb, var(--status-info) 18%, transparent))"
          : "radial-gradient(circle at 30% 30%, var(--surface-floating), color-mix(in srgb, var(--surface-panel) 35%, transparent))",
        boxShadow: state === "active"
          ? "0 0 24px var(--status-info)"
          : "var(--shadow-lg)",
        border: "1px solid var(--shell-floating-border)",
        animation: state === "active" ? "allternit-orb-pulse 1.6s ease-in-out infinite" : "none",
      }} />
      <div style={{
        padding: "4px 10px",
        fontSize: 11,
        borderRadius: 999,
        background: "var(--shell-vision-label-bg)",
        color: "var(--shell-vision-label-fg)",
        maxWidth: 220,
        textAlign: "center",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>
        {lastMessage}
      </div>
      <style>{`
        @keyframes allternit-orb-pulse {
          0% { transform: scale(0.95); opacity: 0.9; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}

function VisionWidget() {
  const [lastTool, setLastTool] = useState<ToolCall | null>(null);

  useEffect(() => {
    const unsubTool = execEvents.on("onToolCall", (call) => {
      setLastTool(call);
    });
    return () => unsubTool();
  }, []);

  return (
    <div style={{
      pointerEvents: "auto",
      padding: "10px 12px",
      borderRadius: 14,
      background: "var(--shell-floating-bg)",
      border: "1px solid var(--shell-floating-border)",
      boxShadow: "var(--shadow-lg)",
      minWidth: 220,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, textTransform: "uppercase" }}>
        Allternit Vision
      </div>
      {lastTool ? (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{lastTool.toolName}</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{lastTool.status.toUpperCase()}</div>
        </div>
      ) : (
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>No tool calls yet.</div>
      )}
    </div>
  );
}

export function LegacyWidgetsLayer() {
  // Voice presence and vision widgets removed - now handled by VoicePresence component
  return null;
}
