// @ts-nocheck
import React, { useEffect, useState } from "react";
import { execEvents } from "../integration/execution/exec.events";
import type { ToolCall } from "../integration/execution/exec.types";
import { cn } from "@/lib/utils";

function VoiceOrbWidget() {
  const [state, setState] = useState<"idle" | "active">("idle");
  const [lastMessage, setLastMessage] = useState<string>("Idle");

  useEffect(() => {
    const unsubStart = execEvents.subscribe("onRunStart", () => {
      setState("active");
      setLastMessage("Listening…");
    });
    const unsubLog = execEvents.subscribe("onLog", (log) => {
      if (log.message) setLastMessage(log.message);
    });
    const unsubComplete = execEvents.subscribe("onRunComplete", () => {
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
    <div className="pointer-events-auto flex flex-col items-center gap-2">
      <div 
        className={cn(
          "size-16 rounded-full border border-solid border-[var(--shell-floating-border)] transition-all duration-300",
          state === "active" 
            ? "bg-[radial-gradient(circle_at_30%_30%,var(--status-info),color-mix(in_srgb,var(--status-info)_18%,transparent))] shadow-[0_0_24px_var(--status-info)] animate-[allternit-orb-pulse_1.6s_ease-in-out_infinite]" 
            : "bg-[radial-gradient(circle_at_30%_30%,var(--surface-floating),color-mix(in_srgb,var(--surface-panel)_35%,transparent))] shadow-[var(--shadow-lg)]"
        )}
      />
      <div className="px-2.5 py-1 text-[12px] rounded-full bg-[var(--shell-vision-label-bg)] text-[var(--shell-vision-label-fg)] max-w-[220px] text-center whitespace-nowrap overflow-hidden text-ellipsis">
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
    const unsubTool = execEvents.subscribe("onToolCall", (call) => {
      setLastTool(call);
    });
    return () => unsubTool();
  }, []);

  return (
    <div className="pointer-events-auto p-[10px_12px] rounded-[14px] bg-[var(--shell-floating-bg)] border border-solid border-[var(--shell-floating-border)] shadow-[var(--shadow-lg)] min-w-[220px]">
      <div className="text-[12px] font-bold opacity-60 uppercase">
        Allternit Vision
      </div>
      {lastTool ? (
        <div className="mt-1.5">
          <div className="text-[12px] font-semibold">{lastTool.toolName}</div>
          <div className="text-[12px] opacity-70 mt-0.5">{lastTool.status.toUpperCase()}</div>
        </div>
      ) : (
        <div className="text-[12px] opacity-60 mt-1.5">No tool calls yet.</div>
      )}
    </div>
  );
}

export function LegacyWidgetsLayer(): React.ReactNode {
  // Voice presence and vision widgets removed - now handled by VoicePresence component
  return null;
}
