"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import type { UIPart } from "@/lib/ai/rust-stream-adapter";

/**
 * Model context passed from MCP App to host for next turn
 */
export interface McpAppModelContext {
  [key: string]: unknown;
}

/**
 * Message sent from MCP App to chat thread
 */
export interface McpAppMessage {
  role: "user" | "assistant";
  parts: UIPart[];
  timestamp: number;
}

/**
 * Context value for MCP Apps host integration
 */
interface McpAppHostContextValue {
  /**
   * Send a message from an MCP App into the chat thread
   */
  sendMessage: (message: Omit<McpAppMessage, "timestamp">) => void;
  /**
   * Update the model context for the next turn
   */
  updateModelContext: (context: McpAppModelContext) => void;
  /**
   * Get the current model context
   */
  getModelContext: () => McpAppModelContext;
  /**
   * Subscribe to messages from MCP Apps
   */
  subscribeToMessages: (
    callback: (message: McpAppMessage) => void
  ) => () => void;
  /**
   * Subscribe to context updates
   */
  subscribeToContextUpdates: (
    callback: (context: McpAppModelContext) => void
  ) => () => void;
}

const McpAppHostContext = createContext<McpAppHostContextValue | null>(null);

/**
 * Provider for MCP Apps host integration
 * Manages app-originated messages and model context
 */
export function McpAppHostProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const modelContextRef = useRef<McpAppModelContext>({});
  const messageSubscribersRef = useRef<Set<(message: McpAppMessage) => void>>(
    new Set()
  );
  const contextSubscribersRef = useRef<
    Set<(context: McpAppModelContext) => void>
  >(new Set());

  const sendMessage = useCallback(
    (message: Omit<McpAppMessage, "timestamp">) => {
      const fullMessage: McpAppMessage = {
        ...message,
        timestamp: Date.now(),
      };

      // Notify all subscribers
      messageSubscribersRef.current.forEach((callback) => {
        try {
          callback(fullMessage);
        } catch (error) {
          console.error("[McpAppHost] Message subscriber error:", error);
        }
      });
    },
    []
  );

  const updateModelContext = useCallback(
    (context: McpAppModelContext) => {
      modelContextRef.current = {
        ...modelContextRef.current,
        ...context,
      };

      // Notify all subscribers
      contextSubscribersRef.current.forEach((callback) => {
        try {
          callback(modelContextRef.current);
        } catch (error) {
          console.error("[McpAppHost] Context subscriber error:", error);
        }
      });
    },
    []
  );

  const getModelContext = useCallback(() => {
    return modelContextRef.current;
  }, []);

  const subscribeToMessages = useCallback(
    (callback: (message: McpAppMessage) => void) => {
      messageSubscribersRef.current.add(callback);
      return () => {
        messageSubscribersRef.current.delete(callback);
      };
    },
    []
  );

  const subscribeToContextUpdates = useCallback(
    (callback: (context: McpAppModelContext) => void) => {
      contextSubscribersRef.current.add(callback);
      return () => {
        contextSubscribersRef.current.delete(callback);
      };
    },
    []
  );

  return (
    <McpAppHostContext.Provider
      value={{
        sendMessage,
        updateModelContext,
        getModelContext,
        subscribeToMessages,
        subscribeToContextUpdates,
      }}
    >
      {children}
    </McpAppHostContext.Provider>
  );
}

/**
 * Hook to access MCP App host context
 */
export function useMcpAppHost(): McpAppHostContextValue {
  const context = useContext(McpAppHostContext);
  if (!context) {
    throw new Error(
      "useMcpAppHost must be used within an McpAppHostProvider"
    );
  }
  return context;
}

/**
 * Hook for MCP App frames to send messages to the chat thread
 */
export function useMcpAppMessenger(): {
  sendMessage: (role: "user" | "assistant", content: unknown[]) => void;
} {
  const context = useContext(McpAppHostContext);

  const sendMessage = useCallback(
    (role: "user" | "assistant", content: unknown[]) => {
      // Convert content parts to UIParts
      const parts: UIPart[] = content.map((part): UIPart => {
        if (typeof part === "string") {
          return { type: "text", text: part };
        }
        if (
          part &&
          typeof part === "object" &&
          "type" in part &&
          part.type === "text" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return { type: "text", text: part.text };
        }
        return { type: "text", text: String(part) };
      });

      if (context) {
        context.sendMessage({ role, parts });
      } else {
        // Fallback: emit custom event for backwards compatibility
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("mcp-app:user-message", {
              detail: { role, content, parts },
            })
          );
        }
      }
    },
    [context]
  );

  return { sendMessage };
}

/**
 * Hook for MCP Apps to update model context
 */
export function useMcpAppModelContext(): {
  updateContext: (context: Record<string, unknown>) => void;
  getContext: () => Record<string, unknown>;
} {
  const context = useContext(McpAppHostContext);

  const updateContext = useCallback(
    (newContext: Record<string, unknown>) => {
      if (context) {
        context.updateModelContext(newContext);
      } else {
        console.warn(
          "[McpAppHost] updateContext called without provider"
        );
      }
    },
    [context]
  );

  const getContext = useCallback(() => {
    if (context) {
      return context.getModelContext();
    }
    return {};
  }, [context]);

  return { updateContext, getContext };
}

/**
 * Hook for chat components to subscribe to MCP App messages
 */
export function useMcpAppMessageSubscription(
  callback: (message: McpAppMessage) => void
): void {
  const context = useContext(McpAppHostContext);

  React.useEffect(() => {
    if (!context) return;
    return context.subscribeToMessages(callback);
  }, [context, callback]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
