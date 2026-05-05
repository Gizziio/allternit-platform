/**
 * Agent Chat Integration
 * 
 * Integrates tool system components into the chat flow:
 * - ToolQuestionDisplay: Shows pending ask_user questions
 * - ToolConfirmation: Shows tool confirmation dialogs
 * - ToolCallVisualization: Enhanced tool call display
 */

import React from "react";
import { ToolCallVisualization } from "./ToolCallVisualization";
import { ToolConfirmation } from "./ToolConfirmation";
import { ToolQuestionDisplay } from "./AskUserQuestion";
import { useToolCallAccent } from "./ToolCallVisualization";

interface AgentChatIntegrationProps {
  sessionId: string;
  surface?: "chat" | "cowork" | "code" | "browser" | "design";
  children?: React.ReactNode;
}

/**
 * Container that integrates all tool UI components into chat
 * Place this inside the chat panel to show:
 * - Pending questions from ask_user tool
 * - Tool confirmation dialogs
 */
export function AgentChatIntegration({
  sessionId,
  surface = "chat",
  children,
}: AgentChatIntegrationProps) {
  const accentColor = useToolCallAccent(surface);

  return (
    <div style={{ position: "relative", height: "100%" }}>
      {/* Main chat content */}
      <div style={{ height: "100%" }}>{children}</div>

      {/* Tool Confirmation Overlay */}
      <ToolConfirmation sessionId={sessionId} accentColor={accentColor} />

      {/* Pending Questions Overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: 24,
          right: 24,
          zIndex: 50,
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto" }}>
          <ToolQuestionDisplay
            sessionId={sessionId}
            accentColor={accentColor}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Enhanced Message Item with ToolCallVisualization
 * Use this to replace the default tool call rendering
 */
interface EnhancedMessageItemProps {
  message: {
    id: string;
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    timestamp: string;
    toolCalls?: Array<{
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    }>;
    toolCallId?: string;
  };
  surface?: "chat" | "cowork" | "code" | "browser" | "design";
  isStreaming?: boolean;
}

export function EnhancedMessageItem({
  message,
  surface = "chat",
  isStreaming = false,
}: EnhancedMessageItemProps) {
  const accentColor = useToolCallAccent(surface);

  // For tool result messages
  if (message.role === "tool") {
    return (
      <div
        style={{
          display: "flex",
          gap: 12,
          paddingLeft: 44,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            border: "1px solid rgba(121,196,124,0.3)",
            background: "rgba(121,196,124,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#79C47C",
          }}
        >
          ✓
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              borderRadius: 16,
              border: "1px solid rgba(121,196,124,0.2)",
              background: "rgba(121,196,124,0.05)",
              padding: 12,
            }}
          >
            <pre
              style={{
                margin: 0,
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                color: "#a8998c",
                overflow: "auto",
                maxHeight: 150,
              }}
            >
              {message.content}
            </pre>
          </div>
          <span
            style={{
              fontSize: 10,
              color: "#7a6b5d",
              paddingLeft: 8,
              marginTop: 4,
              display: "block",
            }}
          >
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>
    );
  }

  // Regular message with potential tool calls
  return (
    <div>
      {/* Message content here - caller should render the message */}
      
      {/* Tool Calls */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div
          style={{
            marginTop: 8,
            paddingLeft: 44,
          }}
        >
          <ToolCallVisualization
            toolCalls={message.toolCalls as any}
            isLoading={isStreaming}
            accentColor={accentColor}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Hook to get tool-related state for a session
 */
export function useAgentChatIntegration(sessionId: string) {
  const accentColor = useToolCallAccent("chat");

  return {
    accentColor,
    components: {
      ToolCallVisualization,
      ToolConfirmation,
      ToolQuestionDisplay,
    },
  };
}

export default AgentChatIntegration;
