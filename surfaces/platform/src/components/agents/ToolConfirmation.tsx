/**
 * Tool Confirmation Component
 * 
 * Displays when a tool requires user confirmation before execution.
 * Integrates with the tool-hooks.ts system.
 */

import React from "react";
import { AlertTriangle, Check, X, Terminal, FileText, Globe, Database, Settings } from "lucide-react";
import {
  usePendingToolConfirmations,
  PendingToolConfirmation,
} from "@/lib/agents/tools/tool-hooks";
import { useToolRegistryStore } from "@/lib/agents/tool-registry.store";

interface ToolConfirmationProps {
  sessionId: string;
  accentColor?: string;
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  execute_command: <Terminal size={18} />,
  read_file: <FileText size={18} />,
  write_file: <FileText size={18} />,
  ask_user: <Settings size={18} />,
  schedule_job: <Settings size={18} />,
  default: <Settings size={18} />,
};

export function ToolConfirmation({
  sessionId,
  accentColor = "#D4956A",
}: ToolConfirmationProps) {
  const { confirmations, confirmTool, denyTool, hasPending } =
    usePendingToolConfirmations(sessionId);
  const { tools } = useToolRegistryStore();

  if (!hasPending || confirmations.length === 0) {
    return null;
  }

  // Show the first pending confirmation
  const confirmation = confirmations[0];
  const toolInfo = tools[confirmation.toolName];
  const icon = TOOL_ICONS[confirmation.toolName] || TOOL_ICONS.default;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 400,
        maxWidth: "calc(100vw - 48px)",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.1)",
        background: "linear-gradient(180deg, #2B2520 0%, #1a1714 100%)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
        zIndex: 1000,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: `linear-gradient(90deg, ${accentColor}15, transparent)`,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `${accentColor}20`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: accentColor,
          }}
        >
          <AlertTriangle size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f6eee7" }}>
            Confirm Tool Execution
          </div>
          <div style={{ fontSize: 11, color: "#7a6b5d", marginTop: 2 }}>
            {confirmations.length > 1
              ? `${confirmations.length} tools pending confirmation`
              : "This tool requires your approval"}
          </div>
        </div>
      </div>

      {/* Tool Info */}
      <div style={{ padding: "16px 20px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: 12,
            borderRadius: 10,
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ color: accentColor }}>{icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#f6eee7" }}>
              {toolInfo?.name || confirmation.toolName}
            </div>
            {toolInfo?.description && (
              <div style={{ fontSize: 11, color: "#7a6b5d", marginTop: 2 }}>
                {toolInfo.description}
              </div>
            )}
          </div>
        </div>

        {/* Arguments Preview */}
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#9f8a78",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 8,
            }}
          >
            Arguments
          </div>
          <pre
            style={{
              margin: 0,
              padding: 12,
              borderRadius: 8,
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.06)",
              fontSize: 11,
              color: "#a8998c",
              fontFamily: "monospace",
              overflow: "auto",
              maxHeight: 120,
            }}
          >
            {JSON.stringify(confirmation.arguments, null, 2)}
          </pre>
        </div>

        {/* Description */}
        {confirmation.description && (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 8,
              background: `${accentColor}10`,
              border: `1px solid ${accentColor}30`,
              fontSize: 12,
              color: "#d1c3b4",
            }}
          >
            {confirmation.description}
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          gap: 10,
          padding: "12px 20px 20px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          onClick={() => denyTool(confirmation.toolCallId, "User denied")}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "10px 16px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent",
            color: "#a8998c",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <X size={16} />
          Deny
        </button>
        <button
          onClick={() => confirmTool(confirmation.toolCallId)}
          style={{
            flex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "10px 16px",
            borderRadius: 10,
            border: `1px solid ${accentColor}`,
            background: accentColor,
            color: "#1a1714",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <Check size={16} />
          Allow & Execute
        </button>
      </div>
    </div>
  );
}

/**
 * Inline tool confirmation for embedding in chat
 */
export function InlineToolConfirmation({
  confirmation,
  onConfirm,
  onDeny,
  accentColor = "#D4956A",
}: {
  confirmation: PendingToolConfirmation;
  onConfirm: () => void;
  onDeny: () => void;
  accentColor?: string;
}) {
  const { tools } = useToolRegistryStore();
  const toolInfo = tools[confirmation.toolName];
  const icon = TOOL_ICONS[confirmation.toolName] || TOOL_ICONS.default;

  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${accentColor}30`,
        background: `${accentColor}08`,
        padding: 14,
        marginTop: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: `${accentColor}20`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: accentColor,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#f6eee7" }}>
            {toolInfo?.name || confirmation.toolName}
          </div>
          <div style={{ fontSize: 11, color: "#7a6b5d" }}>
            Requires confirmation
          </div>
        </div>
      </div>

      <div
        style={{
          padding: 10,
          borderRadius: 8,
          background: "rgba(0,0,0,0.2)",
          fontSize: 11,
          color: "#a8998c",
          fontFamily: "monospace",
          marginBottom: 12,
          overflow: "auto",
          maxHeight: 80,
        }}
      >
        {JSON.stringify(confirmation.arguments, null, 2)}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onDeny}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent",
            color: "#a8998c",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Deny
        </button>
        <button
          onClick={onConfirm}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 8,
            border: `1px solid ${accentColor}`,
            background: accentColor,
            color: "#1a1714",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Allow
        </button>
      </div>
    </div>
  );
}

export default ToolConfirmation;
