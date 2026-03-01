// ============================================================================
// Chat-Browser Bridge - Option B: Open A2UI in Browser
// ============================================================================
// Provides buttons and utilities to open A2UI content in browser tabs
// ============================================================================

"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBrowserStore } from "@/capsules/browser/browser.store";
import type { A2UIPayload } from "@/capsules/a2ui/a2ui.types";
import {
  ExternalLink,
  Maximize2,
  Copy,
  MoreHorizontal,
  Globe,
  LayoutGrid,
  Terminal,
} from "lucide-react";

// ============================================================================
// Props
// ============================================================================

interface OpenInBrowserButtonProps {
  /** A2UI payload to open */
  payload: A2UIPayload;
  /** Title for the new tab */
  title?: string;
  /** Source/agent identifier */
  source?: string;
  /** Button variant */
  variant?: "default" | "secondary" | "outline" | "ghost";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
  /** Show label or just icon */
  showLabel?: boolean;
  /** Callback after opening */
  onOpen?: (tabId: string) => void;
  /** Additional CSS class */
  className?: string;
}

interface ChatBrowserBridgeProps {
  /** Current chat/thread ID */
  chatId: string;
  /** Current message ID */
  messageId: string;
  /** Available A2UI payloads in this message */
  payloads?: Array<{
    payload: A2UIPayload;
    title?: string;
  }>;
}

// ============================================================================
// Open in Browser Button
// ============================================================================

export function OpenInBrowserButton({
  payload,
  title = "Chat App",
  source,
  variant = "secondary",
  size = "sm",
  showLabel = true,
  onOpen,
  className,
}: OpenInBrowserButtonProps) {
  const { addA2UITab } = useBrowserStore();

  const handleOpen = () => {
    const tabId = addA2UITab(payload, title, source);
    onOpen?.(tabId);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            onClick={handleOpen}
            className={className}
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            {showLabel && "Open in Browser"}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Open this app in a new browser tab</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Pop Out Button (for inline A2UI)
// ============================================================================

export function PopOutButton({
  payload,
  title = "Chat App",
  source,
  onOpen,
}: OpenInBrowserButtonProps) {
  const { addA2UITab } = useBrowserStore();

  const handlePopOut = () => {
    const tabId = addA2UITab(payload, title, source);
    onOpen?.(tabId);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handlePopOut}
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Pop out to browser tab</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Message Action Buttons
// ============================================================================

export function MessageA2UIActions({
  payload,
  title,
  source,
  onOpen,
}: OpenInBrowserButtonProps) {
  const { addA2UITab, addTab } = useBrowserStore();

  const handleOpenInBrowser = () => {
    const tabId = addA2UITab(payload, title || "Chat App", source);
    onOpen?.(tabId);
  };

  const handleDuplicate = () => {
    addA2UITab(payload, `${title || "Chat App"} (Copy)`, source);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleOpenInBrowser}>
          <ExternalLink className="w-4 h-4 mr-2" />
          Open in Browser
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDuplicate}>
          <Copy className="w-4 h-4 mr-2" />
          Duplicate
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// Chat-Browser Bridge Menu
// ============================================================================

export function ChatBrowserBridge({
  chatId,
  messageId,
  payloads = [],
}: ChatBrowserBridgeProps) {
  const { addA2UITab, addTab, tabs } = useBrowserStore();

  // Find existing tabs from this chat
  const chatTabs = tabs.filter(
    (t) =>
      t.contentType === "a2ui" &&
      (t as { source?: string }).source?.startsWith(`chat-${chatId}`)
  );

  const openAllInBrowser = () => {
    payloads.forEach(({ payload, title }, idx) => {
      setTimeout(() => {
        addA2UITab(payload, title || `App ${idx + 1}`, `chat-${chatId}`);
      }, idx * 100);
    });
  };

  const openWebPage = (url: string) => {
    addTab(url);
  };

  return (
    <div className="flex items-center gap-2">
      {payloads.length === 1 ? (
        <OpenInBrowserButton
          payload={payloads[0].payload}
          title={payloads[0].title}
          source={`chat-${chatId}`}
        />
      ) : payloads.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm">
              <ExternalLink className="w-4 h-4 mr-1" />
              Open Apps ({payloads.length})
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={openAllInBrowser}>
              <LayoutGrid className="w-4 h-4 mr-2" />
              Open All in Browser
            </DropdownMenuItem>
            <div className="h-px bg-border my-1" />
            {payloads.map(({ payload, title }, idx) => (
              <DropdownMenuItem
                key={idx}
                onClick={() =>
                  addA2UITab(payload, title || `App ${idx + 1}`, `chat-${chatId}`)
                }
              >
                <LayoutGrid className="w-4 h-4 mr-2" />
                {title || `App ${idx + 1}`}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {chatTabs.length > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <Globe className="w-4 h-4 mr-1" />
                {chatTabs.length} tab{chatTabs.length !== 1 ? "s" : ""} open
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{chatTabs.length} browser tabs from this chat</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

// ============================================================================
// Quick Link Buttons
// ============================================================================

interface QuickLinkProps {
  url: string;
  title?: string;
  icon?: React.ReactNode;
}

export function QuickBrowserLink({ url, title, icon }: QuickLinkProps) {
  const { addTab } = useBrowserStore();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => addTab(url, title)}
      className="text-muted-foreground"
    >
      {icon || <Globe className="w-4 h-4 mr-1" />}
      {title || "Open Link"}
    </Button>
  );
}

// ============================================================================
// Hook: useChatBrowserActions
// ============================================================================

export function useChatBrowserActions() {
  const {
    addTab,
    addA2UITab,
    addMiniappTab,
    setActiveTab,
    tabs,
  } = useBrowserStore();

  return {
    // Open web URL
    openWeb: (url: string, title?: string) => {
      const tabId = addTab(url, title);
      return tabId;
    },

    // Open A2UI payload
    openA2UI: (payload: A2UIPayload, title?: string, source?: string) => {
      const tabId = addA2UITab(payload, title, source);
      return tabId;
    },

    // Open miniapp
    openMiniapp: (manifest: unknown, capsuleId: string) => {
      // Note: Need proper MiniappManifest type
      const tabId = addMiniappTab(manifest as any, capsuleId);
      return tabId;
    },

    // Switch to browser view
    switchToBrowser: (tabId?: string) => {
      if (tabId) {
        setActiveTab(tabId);
      }
      // Navigate to browser view - this would need to be implemented
      // based on your navigation system
    },

    // Get tabs created from chat
    getChatTabs: (chatId: string) => {
      return tabs.filter(
        (t) =>
          t.contentType === "a2ui" &&
          (t as { source?: string }).source?.includes(chatId)
      );
    },

    // Current tabs count
    tabCount: tabs.length,
  };
}

// ============================================================================
// Export All
// ============================================================================

export default {
  OpenInBrowserButton,
  PopOutButton,
  MessageA2UIActions,
  ChatBrowserBridge,
  QuickBrowserLink,
  useChatBrowserActions,
};
