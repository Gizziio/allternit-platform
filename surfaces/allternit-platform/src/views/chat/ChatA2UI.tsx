// ============================================================================
// Chat A2UI Integration - Option A: Inline A2UI in Chat
// ============================================================================
// Renders A2UI payloads directly within chat messages
// ============================================================================

"use client";

import React, { useCallback, useState } from "react";
import { A2UIRenderer } from "@/capsules/a2ui/A2UIRenderer";
import type { A2UIPayload } from "@/capsules/a2ui/a2ui.types";
import { useBrowserStore } from "@/capsules/browser/browser.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowSquareOut,
  ArrowsOut,
  X,
} from '@phosphor-icons/react';

// ============================================================================
// Types
// ============================================================================

export interface ChatA2UIPart {
  type: "a2ui";
  payload: A2UIPayload;
  title?: string;
  source?: string; // Agent ID that generated this
  actions?: Array<{
    label: string;
    action: string;
    payload?: unknown;
  }>;
}

export interface ChatA2UIMessage {
  id: string;
  role: "assistant";
  text: string;
  a2ui?: ChatA2UIPart;
}

// ============================================================================
// Inline A2UI Renderer
// ============================================================================

interface MessageA2UIProps {
  part: ChatA2UIPart;
  messageId: string;
  onAction?: (messageId: string, actionId: string, payload: unknown) => void;
}

export function MessageA2UI({ part, messageId, onAction }: MessageA2UIProps) {
  const { addA2UITab } = useBrowserStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [dataModel, setDataModel] = useState<Record<string, unknown>>(
    () => part.payload.dataModel || {}
  );

  // Handle actions from A2UI components
  const handleAction = useCallback(
    (actionId: string, payload?: Record<string, unknown>) => {
      console.log("[ChatA2UI] Action triggered:", actionId, payload);

      // Check if this is a known action from the part definition
      const definedAction = part.actions?.find((a) => a.action === actionId);

      if (definedAction) {
        // Call the external handler
        onAction?.(messageId, actionId, {
          ...(definedAction.payload || {}),
          ...(payload || {}),
          _dataModel: dataModel,
        });
      } else {
        // Fallback: just call the handler with the payload
        onAction?.(messageId, actionId, payload);
      }
    },
    [part.actions, messageId, onAction, dataModel]
  );

  // Open this A2UI in browser tab
  const handleOpenInBrowser = () => {
    const tabId = addA2UITab(
      {
        ...part.payload,
        dataModel, // Include current data model state
      },
      part.title || "Chat App",
      part.source
    );
    console.log("[ChatA2UI] Opened in browser tab:", tabId);
  };

  if (!isExpanded) {
    return (
      <Card className="my-2 border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-sm text-muted-foreground">
                {part.title || "Interactive App"} (collapsed)
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(true)}
            >
              <ArrowsOut className="w-4 h-4 mr-1" />
              Expand
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="my-2 overflow-hidden border-primary/20">
      <CardHeader className="py-3 px-4 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            {part.title || "Interactive App"}
            {part.source && (
              <span className="text-xs text-muted-foreground font-normal">
                via {part.source}
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleOpenInBrowser}
              title="Open in Browser"
            >
              <ArrowSquareOut size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(false)}
              title="Collapse"
            >
              <X size={16} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[600px] overflow-auto">
          <A2UIRenderer
            payload={part.payload}
            initialDataModel={dataModel}
            onAction={handleAction}
            onDataModelChange={setDataModel}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// A2UI Action Buttons
// ============================================================================

interface A2UIActionButtonsProps {
  actions: Array<{
    label: string;
    action: string;
    payload?: unknown;
    variant?: "primary" | "secondary" | "ghost";
  }>;
  onAction: (action: string, payload: unknown) => void;
}

export function A2UIActionButtons({ actions, onAction }: A2UIActionButtonsProps) {
  // Map A2UI variant names to Button component variants
  const variantMap: Record<string, "default" | "secondary" | "destructive" | "outline" | "ghost"> = {
    primary: "default",
    secondary: "secondary",
    destructive: "destructive",
    outline: "outline",
    ghost: "ghost",
    link: "ghost",
  };

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {actions.map((action, idx) => (
        <Button
          key={idx}
          variant={variantMap[action.variant || "secondary"] || "secondary"}
          size="sm"
          onClick={() => onAction(action.action, action.payload)}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

// ============================================================================
// Chat-Browser Bridge
// ============================================================================

// Hook for managing A2UI interactions in chat
export function useChatA2UI() {
  const { addA2UITab, addTab } = useBrowserStore();

  // Send A2UI action to agent
  const sendAction = useCallback(
    async (
      chatId: string,
      messageId: string,
      actionId: string,
      payload: unknown
    ) => {
      // This would typically call your API to send the action to the agent
      console.log("[useChatA2UI] Sending action:", {
        chatId,
        messageId,
        actionId,
        payload,
      });

      // Example API call:
      // await fetch('/api/chat/action', {
      //   method: 'POST',
      //   body: JSON.stringify({ chatId, messageId, actionId, payload }),
      // });

      return { success: true };
    },
    []
  );

  // Open A2UI in browser (Option B)
  const openInBrowser = useCallback(
    (payload: A2UIPayload, title?: string, source?: string) => {
      return addA2UITab(payload, title || "Chat App", source);
    },
    [addA2UITab]
  );

  // Open URL in browser
  const openURL = useCallback(
    (url: string, title?: string) => {
      addTab(url, title);
    },
    [addTab]
  );

  return {
    sendAction,
    openInBrowser,
    openURL,
  };
}

// ============================================================================
// Type Guards
// ============================================================================

export function isA2UIPart(part: unknown): part is ChatA2UIPart {
  return (
    typeof part === "object" &&
    part !== null &&
    "type" in part &&
    (part as ChatA2UIPart).type === "a2ui" &&
    "payload" in part
  );
}
