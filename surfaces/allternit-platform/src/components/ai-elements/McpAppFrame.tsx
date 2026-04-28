"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AppBridge,
  PostMessageTransport,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import type {
  CallToolResult,
  ListPromptsResult,
  ListResourceTemplatesResult,
  ListResourcesResult,
  ListToolsResult,
  Tool,
  ReadResourceResult,
} from "@modelcontextprotocol/sdk/types.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import {
  ArrowsInSimple,
  CircleNotch,
  Warning,
} from "@phosphor-icons/react";

import { requestMcpAppBridge } from "@/lib/ai/mcp/app-bridge-api";
import {
  coerceMcpAppToolResult,
  type McpAppBridgeDisplayMode,
} from "@/lib/ai/mcp/apps";
import {
  useMcpAppMessenger,
  useMcpAppModelContext,
} from "@/lib/ai/mcp/app-context";
import {
  createSandbox,
  isSandboxAvailable,
  logCspViolation,
  logBlockedAction,
  type SandboxInstance,
} from "@/lib/ai/mcp/sandbox-client";
import type { McpAppUIPart } from "@/lib/ai/rust-stream-adapter-extended";
import { cn } from "@/lib/utils";
import { openInBrowser } from '@/lib/openInBrowser';

const BLANK_DOCUMENT = "<!doctype html><html><head></head><body></body></html>";
const DEFAULT_FRAME_HEIGHT = 420;
const MIN_FRAME_HEIGHT = 320;
const MAX_INLINE_FRAME_HEIGHT = 720;

const SANDBOX_FLAGS = [
  "allow-downloads",
  "allow-forms",
  "allow-popups",
  "allow-popups-to-escape-sandbox",
  "allow-scripts",
].join(" ");

// Feature flag: enable sandbox proxy (can be controlled via env or config)
const ENABLE_SANDBOX_PROXY = process.env.NEXT_PUBLIC_MCP_SANDBOX_PROXY === "true" || true;

function clampInlineFrameHeight(height?: number): number {
  if (!Number.isFinite(height)) {
    return DEFAULT_FRAME_HEIGHT;
  }

  return Math.max(
    MIN_FRAME_HEIGHT,
    Math.min(MAX_INLINE_FRAME_HEIGHT, Math.ceil(height ?? DEFAULT_FRAME_HEIGHT)),
  );
}

function getHostTheme(): McpUiHostContext["theme"] {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return "light";
  }

  const root = document.documentElement;
  const dataTheme = root.getAttribute("data-theme");
  if (dataTheme === "dark" || dataTheme === "light") {
    return dataTheme;
  }

  if (root.classList.contains("dark")) {
    return "dark";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getHostPlatform(): McpUiHostContext["platform"] {
  if (typeof navigator === "undefined") {
    return "web";
  }

  const mobilePattern =
    /Android|iPhone|iPad|iPod|IEMobile|BlackBerry|Opera Mini/i;
  return mobilePattern.test(navigator.userAgent) ? "mobile" : "web";
}

function buildHostContext(
  part: McpAppUIPart,
  displayMode: McpAppBridgeDisplayMode,
  frameHeight: number,
): McpUiHostContext {
  const viewportWidth =
    typeof window === "undefined" ? 1280 : window.innerWidth;
  const viewportHeight =
    typeof window === "undefined" ? DEFAULT_FRAME_HEIGHT : window.innerHeight;
  const displayPlatform = getHostPlatform();
  const supportsHover =
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover)").matches;
  const locale =
    typeof navigator === "undefined" ? undefined : navigator.language;
  const userAgent =
    typeof navigator === "undefined" ? undefined : navigator.userAgent;

  return {
    toolInfo: part.tool
      ? {
          id: part.toolCallId,
          tool: part.tool as Tool,
        }
      : undefined,
    theme: getHostTheme(),
    displayMode,
    availableDisplayModes: ["inline", "fullscreen"],
    containerDimensions:
      displayMode === "fullscreen"
        ? {
            maxWidth: viewportWidth,
            maxHeight: viewportHeight,
          }
        : {
            maxWidth: viewportWidth,
            height: frameHeight,
          },
    locale,
    timeZone:
      typeof Intl === "undefined"
        ? undefined
        : Intl.DateTimeFormat().resolvedOptions().timeZone,
    userAgent,
    platform: displayPlatform,
    deviceCapabilities: {
      touch:
        typeof navigator === "undefined"
          ? false
          : navigator.maxTouchPoints > 0,
      hover: supportsHover,
    },
    safeAreaInsets: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
  };
}

function getFullscreenPaddingStyle(): React.CSSProperties {
  return {
    paddingTop: "max(1rem, env(safe-area-inset-top))",
    paddingRight: "max(1rem, env(safe-area-inset-right))",
    paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
    paddingLeft: "max(1rem, env(safe-area-inset-left))",
  };
}



export function McpAppFrame({ part }: { part: McpAppUIPart }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const bridgeRef = useRef<AppBridge | null>(null);
  const sandboxRef = useRef<SandboxInstance | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [frameHtml, setFrameHtml] = useState(BLANK_DOCUMENT);
  const [frameHeight, setFrameHeight] = useState(DEFAULT_FRAME_HEIGHT);
  const [displayMode, setDisplayMode] =
    useState<McpAppBridgeDisplayMode>("inline");
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [useSandbox, setUseSandbox] = useState(false);

  // MCP App host integration hooks
  const { sendMessage } = useMcpAppMessenger();
  const { updateContext } = useMcpAppModelContext();

  // Check if sandbox is available on mount
  useEffect(() => {
    if (!ENABLE_SANDBOX_PROXY) {
      return;
    }
    
    isSandboxAvailable().then((available) => {
      if (available) {
        setUseSandbox(true);
      }
    });
  }, []);

  const frameTitle = `${part.title} from ${part.connectorName}`;
  const isFullscreen = displayMode === "fullscreen";
  const isInteractiveDocument = frameHtml === part.html;

  const hostCapabilities = useMemo(
    () => ({
      openLinks: {},
      serverTools: {},
      serverResources: {},
      logging: {},
      sandbox:
        part.permissions || part.csp
          ? {
              ...(part.permissions ? { permissions: part.permissions } : {}),
              ...(part.csp ? { csp: part.csp } : {}),
            }
          : undefined,
    }),
    [part.csp, part.permissions],
  );

  // Initialize bridge (for both direct and sandbox modes)
  useEffect(() => {
    // If using sandbox, the bridge is managed differently
    if (useSandbox) {
      return;
    }

    const iframe = iframeRef.current;
    const frameWindow = iframe?.contentWindow;

    if (!iframe || !frameWindow) {
      return;
    }

    let disposed = false;

    setIsDismissed(false);
    setHasError(false);
    setIsLoaded(false);
    setDisplayMode("inline");
    setFrameHeight(DEFAULT_FRAME_HEIGHT);
    setFrameHtml(BLANK_DOCUMENT);

    const bridge = new AppBridge(
      null,
      {
        name: "allternit",
        version: "1.0.0",
      },
      hostCapabilities,
      {
        hostContext: buildHostContext(part, "inline", DEFAULT_FRAME_HEIGHT),
      },
    );

    bridgeRef.current = bridge;

    bridge.onsizechange = ({ height }: { height?: number }) => {
      if (disposed || displayMode === "fullscreen") {
        return;
      }

      setFrameHeight(clampInlineFrameHeight(height));
    };

    bridge.oninitialized = () => {
      if (disposed) {
        return;
      }

      void bridge.sendToolInput({
        arguments: part.toolInput ?? {},
      });

      if (part.toolResult !== undefined) {
        void bridge.sendToolResult(
          coerceMcpAppToolResult(part.toolResult) as CallToolResult,
        );
      }
    };

    bridge.onopenlink = async ({ url }: { url: string }) => {
      openInBrowser(url);
      return {};
    };

    bridge.onmessage = async (params: {
      role: "user";
      content: unknown[];
    }) => {
      // Send app-originated message to chat thread
      sendMessage(params.role, params.content);
      return {};
    };

    bridge.onupdatemodelcontext = async (params: Record<string, unknown>) => {
      // Update model context for next turn
      updateContext(params);
      return {};
    };

    bridge.onrequestteardown = () => {
      if (disposed) {
        return;
      }

      setIsDismissed(true);
    };

    bridge.onrequestdisplaymode = async ({
      mode,
    }: {
      mode: McpAppBridgeDisplayMode;
    }) => {
      const nextMode: McpAppBridgeDisplayMode =
        mode === "fullscreen" ? "fullscreen" : "inline";

      if (!disposed) {
        setDisplayMode(nextMode);
      }

      return { mode: nextMode };
    };

    bridge.onloggingmessage = (params: {
      level: string;
      data?: unknown;
    }) => {
      console.debug("[mcp-app]", params.level, params.data);
    };

    bridge.oncalltool = async (params: {
      name: string;
      arguments?: Record<string, unknown>;
    }) =>
      requestMcpAppBridge<CallToolResult>({
        action: "tools/call",
        connectorId: part.connectorId,
        params: {
          name: params.name,
          arguments: params.arguments,
        },
      });

    bridge.onlistresources = async (params?: {
      cursor?: string;
      _meta?: Record<string, unknown>;
    }) =>
      requestMcpAppBridge<ListResourcesResult>({
        action: "resources/list",
        connectorId: part.connectorId,
        params,
      });

    bridge.onlistresourcetemplates = async () =>
      requestMcpAppBridge<ListResourceTemplatesResult>({
        action: "resources/templates/list",
        connectorId: part.connectorId,
      });

    bridge.onreadresource = async (params: { uri: string }) =>
      requestMcpAppBridge<ReadResourceResult>({
        action: "resources/read",
        connectorId: part.connectorId,
        params,
      });

    bridge.onlistprompts = async (params?: {
      cursor?: string;
      _meta?: Record<string, unknown>;
    }) =>
      requestMcpAppBridge<ListPromptsResult>({
        action: "prompts/list",
        connectorId: part.connectorId,
        params,
      });

    bridge.setRequestHandler(
      ListToolsRequestSchema,
      async (request: { params?: { cursor?: string } }) =>
      requestMcpAppBridge<ListToolsResult>({
        action: "tools/list",
        connectorId: part.connectorId,
        params: request.params,
      }),
    );

    const transport = new PostMessageTransport(frameWindow, frameWindow);

    void bridge
      .connect(transport)
      .then(() => {
        if (!disposed) {
          setFrameHtml(part.html);
        }
      })
      .catch((error: unknown) => {
        console.warn("Failed to initialize MCP App bridge", error);
        if (!disposed) {
          setHasError(true);
          setIsLoaded(false);
        }
      });

    return () => {
      disposed = true;
      bridgeRef.current = null;
      void bridge.close().catch(() => undefined);
    };
  }, [hostCapabilities, part, useSandbox]);

  // Initialize sandbox mode
  useEffect(() => {
    if (!useSandbox || !containerRef.current) {
      return;
    }

    let disposed = false;
    let sandboxInstance: SandboxInstance | null = null;

    setIsDismissed(false);
    setHasError(false);
    setIsLoaded(false);
    setDisplayMode("inline");
    setFrameHeight(DEFAULT_FRAME_HEIGHT);

    // Create sandbox
    createSandbox(
      {
        html: part.html,
        csp: part.csp,
        permissions: part.permissions,
        allow: part.allow,
        toolCallId: part.toolCallId,
        connectorId: part.connectorId,
      },
      containerRef.current
    )
      .then((sandbox) => {
        if (disposed) {
          sandbox.destroy();
          return;
        }

        sandboxInstance = sandbox;
        sandboxRef.current = sandbox;

        // Create bridge for sandbox mode
        const bridge = new AppBridge(
          null,
          {
            name: "allternit",
            version: "1.0.0",
          },
          hostCapabilities,
          {
            hostContext: buildHostContext(part, "inline", DEFAULT_FRAME_HEIGHT),
          },
        );

        bridgeRef.current = bridge;

        // Set up bridge handlers
        bridge.onsizechange = ({ height }: { height?: number }) => {
          if (disposed || displayMode === "fullscreen") {
            return;
          }
          setFrameHeight(clampInlineFrameHeight(height));
        };

        bridge.oninitialized = () => {
          if (disposed) return;
          void bridge.sendToolInput({
            arguments: part.toolInput ?? {},
          });
          if (part.toolResult !== undefined) {
            void bridge.sendToolResult(
              coerceMcpAppToolResult(part.toolResult) as CallToolResult
            );
          }
        };

        bridge.onopenlink = async ({ url }: { url: string }) => {
          openInBrowser(url);
          return {};
        };

        bridge.onmessage = async (params: {
          role: "user";
          content: unknown[];
        }) => {
          sendMessage(params.role, params.content);
          return {};
        };

        bridge.onupdatemodelcontext = async (params: Record<string, unknown>) => {
          updateContext(params);
          return {};
        };

        bridge.onrequestteardown = () => {
          if (disposed) return;
          setIsDismissed(true);
        };

        bridge.onrequestdisplaymode = async ({
          mode,
        }: {
          mode: McpAppBridgeDisplayMode;
        }) => {
          const nextMode: McpAppBridgeDisplayMode =
            mode === "fullscreen" ? "fullscreen" : "inline";
          if (!disposed) {
            setDisplayMode(nextMode);
          }
          return { mode: nextMode };
        };

        bridge.onloggingmessage = (params: { level: string; data?: unknown }) => {
          console.debug("[mcp-app]", params.level, params.data);
        };

        bridge.oncalltool = async (params: {
          name: string;
          arguments?: Record<string, unknown>;
        }) =>
          requestMcpAppBridge<CallToolResult>({
            action: "tools/call",
            connectorId: part.connectorId,
            params: {
              name: params.name,
              arguments: params.arguments,
            },
          });

        bridge.onlistresources = async (params?: {
          cursor?: string;
          _meta?: Record<string, unknown>;
        }) =>
          requestMcpAppBridge<ListResourcesResult>({
            action: "resources/list",
            connectorId: part.connectorId,
            params,
          });

        bridge.onlistresourcetemplates = async () =>
          requestMcpAppBridge<ListResourceTemplatesResult>({
            action: "resources/templates/list",
            connectorId: part.connectorId,
          });

        bridge.onreadresource = async (params: { uri: string }) =>
          requestMcpAppBridge<ReadResourceResult>({
            action: "resources/read",
            connectorId: part.connectorId,
            params,
          });

        bridge.onlistprompts = async (params?: {
          cursor?: string;
          _meta?: Record<string, unknown>;
        }) =>
          requestMcpAppBridge<ListPromptsResult>({
            action: "prompts/list",
            connectorId: part.connectorId,
            params,
          });

        bridge.setRequestHandler(
          ListToolsRequestSchema,
          async (request: { params?: { cursor?: string } }) =>
            requestMcpAppBridge<ListToolsResult>({
              action: "tools/list",
              connectorId: part.connectorId,
              params: request.params,
            })
        );

        // Handle messages from sandbox
        const unsubscribe = sandbox.onMessage((event) => {
          // Handle CSP violations
          if (event.data?.type === "mcp-sandbox-csp-violation") {
            logCspViolation(
              part.toolCallId,
              part.connectorId,
              event.data.violation
            );
            return;
          }

          // Handle blocked actions
          if (event.data?.type === "mcp-sandbox-blocked-actions") {
            event.data.actions?.forEach((action: { type: string }) => {
              logBlockedAction(part.toolCallId, part.connectorId, action);
            });
            return;
          }

          // Handle ready signal
          if (event.data?.type === "mcp-sandbox-ready") {
            setIsLoaded(true);
            return;
          }

          // Forward other messages to bridge
          // (This is a simplified version - full implementation would need proper MCP protocol forwarding)
        });

        // Connect bridge
        // Note: In sandbox mode, we need a custom transport that goes through the sandbox
        // For now, we set the HTML directly after sandbox is ready
        setFrameHtml(part.html);
        setIsLoaded(true);

        return () => {
          unsubscribe();
        };
      })
      .catch((error) => {
        console.warn("Failed to create sandbox:", error);
        if (!disposed) {
          setHasError(true);
          // Fall back to direct mode
          setUseSandbox(false);
        }
      });

    return () => {
      disposed = true;
      sandboxInstance?.destroy();
      sandboxRef.current = null;
    };
  }, [useSandbox, part, hostCapabilities, sendMessage, updateContext, displayMode]);

  useEffect(() => {
    const bridge = bridgeRef.current;
    if (!bridge) {
      return;
    }

    bridge.setHostContext(buildHostContext(part, displayMode, frameHeight));
  }, [displayMode, frameHeight, part]);

  if (isDismissed) {
    return null;
  }

  const shell = (
    <section
      aria-label={frameTitle}
      className={cn(
        "overflow-hidden rounded-3xl border shadow-sm",
        isFullscreen
          ? "mx-auto flex h-full max-w-6xl flex-col border-[#D4B08C]/20 bg-[#100A05]"
          : "bg-[#17110A]/50",
        part.prefersBorder === false
          ? "border-transparent"
          : "border-[#D4B08C]/20",
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-white/6 bg-black/15 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white/88">
            {part.title}
          </p>
          <p className="truncate text-xs text-white/48">
            {part.connectorName} · {part.resourceUri}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="shrink-0 rounded-full border border-[#D4B08C]/20 bg-[#D4B08C]/10 px-2.5 py-1 text-[11px] font-medium text-[#F7D9BA]">
            {isFullscreen ? "Fullscreen MCP App" : "MCP App"}
          </span>
          {isFullscreen ? (
            <button
              type="button"
              aria-label="Return app to chat"
              className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              onClick={() => setDisplayMode("inline")}
            >
              <ArrowsInSimple className="size-4" />
            </button>
          ) : null}
        </div>
      </header>

      <div
        ref={containerRef}
        className={cn(
          "relative bg-[#F6F1E8]",
          isFullscreen ? "flex-1 min-h-0" : "min-h-[320px]",
        )}
      >
        {!isLoaded && !hasError ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#F6F1E8]/90">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <CircleNotch className="size-4 animate-spin" />
              <span>Loading app…</span>
            </div>
          </div>
        ) : null}

        {hasError ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#FFF7ED] px-6">
            <div className="flex max-w-md items-start gap-3 text-sm text-amber-900">
              <Warning className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium">The app frame failed to load.</p>
                <p className="text-pretty text-amber-900/70">
                  The tool result is still available, but the interactive app
                  could not be mounted.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {!useSandbox ? (
          <iframe
            ref={iframeRef}
            title={frameTitle}
            srcDoc={frameHtml}
            sandbox={SANDBOX_FLAGS}
            allow={part.allow || undefined}
            loading="lazy"
            className={cn(
              "block w-full border-0 bg-white",
              isFullscreen ? "h-full min-h-0 flex-1" : "",
            )}
            style={
              isFullscreen
                ? undefined
                : { height: `${clampInlineFrameHeight(frameHeight)}px` }
            }
            onLoad={() => {
              if (isInteractiveDocument) {
                setIsLoaded(true);
                setHasError(false);
              }
            }}
            onError={() => {
              setHasError(true);
              setIsLoaded(false);
            }}
          />
        ) : (
          /* Sandbox mode: iframe is created by sandbox-client */
          <div 
            className={cn(
              "w-full h-full",
              isFullscreen ? "h-full min-h-0 flex-1" : ""
            )}
            style={
              isFullscreen
                ? undefined
                : { height: `${clampInlineFrameHeight(frameHeight)}px` }
            }
          />
        )}
      </div>
    </section>
  );

  if (!isFullscreen) {
    return shell;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45"
      style={getFullscreenPaddingStyle()}
    >
      <div className="h-full">{shell}</div>
    </div>
  );
}

export default McpAppFrame;
