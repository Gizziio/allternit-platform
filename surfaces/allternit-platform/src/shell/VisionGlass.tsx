import React, { useState, useEffect } from "react";
import { execEvents } from "../integration/execution/exec.events";
import type { ToolCall } from "../integration/execution/exec.types";

export interface VisionAction {
  id: string;
  x: number;
  y: number;
  type: "click" | "type" | "hover";
  label?: string;
}

function extractPoint(args: unknown): { x: number; y: number } | null {
  if (typeof args !== 'object' || args === null) return null;
  const a = args as Record<string, unknown>;
  if (typeof a.x === "number" && typeof a.y === "number") return { x: a.x, y: a.y };
  if (Array.isArray(a) && a.length >= 2 && a.every((v) => typeof v === "number")) {
    return { x: a[0], y: a[1] };
  }
  if (Array.isArray(a.position) && a.position.length >= 2) {
    return { x: a.position[0], y: a.position[1] };
  }
  if (Array.isArray(a.point) && a.point.length >= 2) {
    return { x: a.point[0], y: a.point[1] };
  }
  if (Array.isArray(a.start_box) && a.start_box.length >= 2) {
    return { x: a.start_box[0], y: a.start_box[1] };
  }
  return null;
}

function mapToolType(toolName: string): VisionAction["type"] {
  const name = toolName.toLowerCase();
  if (name.includes("type") || name.includes("keyboard")) return "type";
  if (name.includes("hover") || name.includes("move")) return "hover";
  return "click";
}

function labelForCall(call: ToolCall): string {
  const args = call.args ? JSON.stringify(call.args) : "";
  return `${call.toolName}${args ? " " + args.slice(0, 64) : ""}`;
}

export function VisionGlass(): JSX.Element {
  const [actions, setActions] = useState<VisionAction[]>([]);

  useEffect(() => {
    const handleAction = (event: CustomEvent<{ type: string; action: VisionAction }>): void => {
      if (event.detail?.type === "vision_target") {
        const action = event.detail.action;
        setActions(prev => [...prev, action]);
        setTimeout(() => {
          setActions(prev => prev.filter(a => a.id !== action.id));
        }, 3000);
      }
    };

    const unsubTool = execEvents.on("onToolCall", (call) => {
      const point = extractPoint(call.args);
      if (!point) return;
      const action: VisionAction = {
        id: call.id || `tool_${Date.now()}`,
        x: point.x,
        y: point.y,
        type: mapToolType(call.toolName),
        label: labelForCall(call),
      };
      setActions((prev) => [...prev, action]);
      setTimeout(() => {
        setActions((prev) => prev.filter((a) => a.id !== action.id));
      }, 3000);
    });

    window.addEventListener("allternit:vision_action", handleAction as EventListener);
    return () => {
      window.removeEventListener("allternit:vision_action", handleAction as EventListener);
      unsubTool();
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999 }}>
      {actions.map(action => (
        <div key={action.id} style={{
          position: "absolute",
          left: action.x,
          top: action.y,
          width: 40, height: 40,
          marginLeft: -20, marginTop: -20,
          borderRadius: "50%",
          border: "2px solid var(--shell-vision-target)",
          boxShadow: "0 0 20px var(--shell-vision-target)",
          animation: "allternit-pulse 1.5s infinite"
        }}>
          {action.label && (
            <div style={{
              position: "absolute", top: 45, left: "50%", transform: "translateX(-50%)",
              background: "var(--shell-vision-label-bg)", color: "var(--shell-vision-label-fg)", padding: "4px 8px",
              borderRadius: 6, fontSize: 10, whiteSpace: "nowrap"
            }}>
              {action.label}
            </div>
          )}
        </div>
      ))}
      <style>{`
        @keyframes allternit-pulse {
          0% { transform: scale(0.8); opacity: 0.8; }
          50% { transform: scale(1.2); opacity: 0.4; }
          100% { transform: scale(0.8); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
