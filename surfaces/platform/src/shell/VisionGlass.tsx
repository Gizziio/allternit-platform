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

function extractPoint(args: any): { x: number; y: number } | null {
  if (!args) return null;
  if (typeof args.x === "number" && typeof args.y === "number") return { x: args.x, y: args.y };
  if (Array.isArray(args) && args.length >= 2 && args.every((v) => typeof v === "number")) {
    return { x: args[0], y: args[1] };
  }
  if (Array.isArray(args.position) && args.position.length >= 2) {
    return { x: args.position[0], y: args.position[1] };
  }
  if (Array.isArray(args.point) && args.point.length >= 2) {
    return { x: args.point[0], y: args.point[1] };
  }
  if (Array.isArray(args.start_box) && args.start_box.length >= 2) {
    return { x: args.start_box[0], y: args.start_box[1] };
  }
  return null;
}

function mapToolType(toolName: string): VisionAction["type"] {
  const name = toolName.toLowerCase();
  if (name.includes("type") || name.includes("keyboard")) return "type";
  if (name.includes("hover") || name.includes("move")) return "hover";
  return "click";
}

function labelForCall(call: ToolCall) {
  const args = call.args ? JSON.stringify(call.args) : "";
  return `${call.toolName}${args ? " " + args.slice(0, 64) : ""}`;
}

export function VisionGlass() {
  const [actions, setActions] = useState<VisionAction[]>([]);

  useEffect(() => {
    const handleAction = (event: any) => {
      if (event.detail?.type === "vision_target") {
        setActions(prev => [...prev, event.detail.action]);
        setTimeout(() => {
          setActions(prev => prev.filter(a => a.id !== event.detail.action.id));
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

    window.addEventListener("a2r:vision_action", handleAction);
    return () => {
      window.removeEventListener("a2r:vision_action", handleAction);
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
          animation: "a2r-pulse 1.5s infinite"
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
        @keyframes a2r-pulse {
          0% { transform: scale(0.8); opacity: 0.8; }
          50% { transform: scale(1.2); opacity: 0.4; }
          100% { transform: scale(0.8); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
