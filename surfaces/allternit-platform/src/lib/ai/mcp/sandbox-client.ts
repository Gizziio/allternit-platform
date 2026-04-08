/**
 * MCP Apps Sandbox Client
 * 
 * Client-side utilities for the sandbox proxy architecture:
 * - Create sandboxed iframe via proxy
 * - Manage postMessage bridge through sandbox
 * - Handle CSP violations and blocked actions
 */

import type { McpAppResourceCsp, McpAppResourcePermissions } from "./apps";

const SANDBOX_API_ROUTE = "/api/mcp/sandbox";

export interface SandboxConfig {
  html: string;
  csp?: McpAppResourceCsp;
  permissions?: McpAppResourcePermissions;
  allow?: string;
  toolCallId: string;
  connectorId: string;
}

export interface SandboxInstance {
  iframe: HTMLIFrameElement;
  destroy: () => void;
  onMessage: (callback: (event: MessageEvent) => void) => () => void;
  sendMessage: (message: unknown) => void;
  isReady: () => boolean;
}

interface SandboxResponse {
  sandboxUrl: string;
  blobUrl?: string;
}

/**
 * Create a sandboxed iframe using the proxy route
 */
export async function createSandbox(
  config: SandboxConfig,
  container: HTMLElement
): Promise<SandboxInstance> {
  // Create an iframe to load the sandbox proxy
  const iframe = document.createElement("iframe");
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  iframe.style.background = "transparent";
  iframe.sandbox = "allow-scripts allow-same-origin";

  // Generate allow attribute from permissions
  const allowAttribute = generateAllowAttribute(config.permissions);
  if (allowAttribute) {
    iframe.allow = allowAttribute;
  }

  // Append to container first
  container.appendChild(iframe);

  // Fetch the sandbox HTML from the API
  const response = await fetch(SANDBOX_API_ROUTE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(`Failed to create sandbox: ${error.error || response.statusText}`);
  }

  // Get the sandbox HTML
  const sandboxHTML = await response.text();

  // Write the sandbox HTML to the iframe
  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    throw new Error("Failed to access iframe document");
  }

  iframeDoc.open();
  iframeDoc.write(sandboxHTML);
  iframeDoc.close();

  // Track ready state
  let isReady = false;
  const messageCallbacks: Set<(event: MessageEvent) => void> = new Set();

  // Handle messages from the sandbox
  const handleMessage = (event: MessageEvent) => {
    // Only accept messages from our sandbox iframe
    if (event.source !== iframe.contentWindow) {
      return;
    }

    // Check for ready signal
    if (
      event.data?.type === "mcp-sandbox-ready" &&
      event.data?.toolCallId === config.toolCallId
    ) {
      isReady = true;
    }

    // Forward to registered callbacks
    messageCallbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error("[SandboxClient] Message callback error:", error);
      }
    });
  };

  window.addEventListener("message", handleMessage);

  return {
    iframe,
    destroy: () => {
      window.removeEventListener("message", handleMessage);
      messageCallbacks.clear();
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    },
    onMessage: (callback) => {
      messageCallbacks.add(callback);
      return () => {
        messageCallbacks.delete(callback);
      };
    },
    sendMessage: (message) => {
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage(message, "*");
      }
    },
    isReady: () => isReady,
  };
}

/**
 * Generate iframe allow attribute from permissions
 */
function generateAllowAttribute(permissions?: McpAppResourcePermissions): string {
  const directives: string[] = [];

  if (permissions?.camera) {
    directives.push("camera");
  }
  if (permissions?.microphone) {
    directives.push("microphone");
  }
  if (permissions?.geolocation) {
    directives.push("geolocation");
  }
  if (permissions?.clipboardWrite) {
    directives.push("clipboard-write");
  }

  return directives.join("; ");
}

/**
 * Check if the sandbox API is available
 */
export async function isSandboxAvailable(): Promise<boolean> {
  try {
    const response = await fetch(SANDBOX_API_ROUTE, {
      method: "GET",
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Log CSP violation for analytics
 */
export function logCspViolation(
  toolCallId: string,
  connectorId: string,
  violation: {
    blockedURI: string;
    violatedDirective: string;
  }
): void {
  console.warn("[MCP Sandbox] CSP Violation:", {
    toolCallId,
    connectorId,
    ...violation,
    timestamp: new Date().toISOString(),
  });

  // Could also send to analytics endpoint
  // fetch('/api/analytics/csp-violation', { method: 'POST', body: JSON.stringify({...}) });
}

/**
 * Log blocked action for security auditing
 */
export function logBlockedAction(
  toolCallId: string,
  connectorId: string,
  action: {
    type: string;
    [key: string]: unknown;
  }
): void {
  console.warn("[MCP Sandbox] Blocked Action:", {
    toolCallId,
    connectorId,
    ...action,
    timestamp: new Date().toISOString(),
  });
}
