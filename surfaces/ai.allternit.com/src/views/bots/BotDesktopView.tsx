"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Desktop,
  Hand,
  Play,
  ArrowsOutSimple,
  ArrowsInSimple,
  Spinner,
  Warning,
  CaretLeft,
  Robot,
  Eye,
  Power,
  Pause,
  Stop,
  Trash,
  Monitor,
  Cloud,
  HardDrives,
  ComputerTower,
} from "@phosphor-icons/react";
import type { Agent } from "@/lib/agents/agent.types";
import { useChatSessionStore } from "@/views/chat/ChatSessionStore";
import {
  destroyBotDesktop,
  getBotDesktopScreenshot,
  getBotDesktopStatus,
  handBackBotDesktop,
  observeBotDesktop,
  pauseBotDesktop,
  provisionBotDesktop,
  resumeBotDesktop,
  startBotDesktop,
  stopBotDesktop,
  takeOverBotDesktop,
  type BotDesktopSandbox,
  type BotDesktopScreenshot,
  type BotDesktopStatus,
} from "@/lib/bots/vm-operator";
import { getBotDisplayName } from "@/lib/bots/bot-profile";
import { Button } from "@/components/ui/button";
import { GlassSurface } from "@/design/GlassSurface";
import { cn } from "@/lib/utils";

interface BotDesktopViewProps {
  bot: Agent;
  accentColor: string;
  activeVM: { id: string; provider: string; status: string; vncUrl?: string } | null;
  onBack: () => void;
}

type ControlState = "bot_controls" | "human_observing" | "human_controls";
type DesktopMode = "cloud" | "local-vm" | "host";

function wsUrlFromPath(path: string): string {
  if (typeof window === "undefined") return path;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  return `${protocol}//${host}${path}`;
}

function modeFromProvider(provider?: string): DesktopMode {
  switch (provider) {
    case "opensandbox":
    case "cloud":
      return "cloud";
    case "docker":
    case "kubernetes":
    case "local":
      return "local-vm";
    case "host":
      return "host";
    default:
      return "cloud";
  }
}

function modeLabel(mode: DesktopMode): string {
  switch (mode) {
    case "cloud":
      return "Cloud box";
    case "local-vm":
      return "Local VM";
    case "host":
      return "This computer";
  }
}

function modeIcon(mode: DesktopMode): React.ElementType {
  switch (mode) {
    case "cloud":
      return Cloud;
    case "local-vm":
      return HardDrives;
    case "host":
      return ComputerTower;
  }
}

export function BotDesktopView({ bot, accentColor, activeVM, onBack }: BotDesktopViewProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<any>(null);
  const [status, setStatus] = useState<BotDesktopStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [vm, setVm] = useState<BotDesktopSandbox | null>(() =>
    activeVM ? { sandbox_id: activeVM.id, status: activeVM.status, provider: activeVM.provider } : null,
  );
  const [screenshot, setScreenshot] = useState<BotDesktopScreenshot | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [mode, setMode] = useState<DesktopMode>(() => modeFromProvider(bot.vmOperator?.provider));
  const [hostOptIn, setHostOptIn] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const screenshotPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusAbortRef = useRef<AbortController | null>(null);
  const screenshotAbortRef = useRef<AbortController | null>(null);
  const screenshotInFlightRef = useRef(false);
  const screenshotFailuresRef = useRef(0);
  const RFBModuleRef = useRef<any>(null);

  useEffect(() => {
    if (activeVM) {
      setVm({ sandbox_id: activeVM.id, status: activeVM.status, provider: activeVM.provider });
    }
  }, [activeVM]);

  const sandboxId = vm?.sandbox_id;

  const loadStatus = useCallback(async () => {
    if (!sandboxId) return;
    if (typeof document !== "undefined" && document.hidden) return;

    statusAbortRef.current?.abort();
    const controller = new AbortController();
    statusAbortRef.current = controller;

    const result = await getBotDesktopStatus(bot.id, sandboxId, controller.signal);
    if (controller.signal.aborted) return;
    if (result.ok && result.data) {
      setStatus(result.data);
      setError(null);
    } else {
      setError(result.error ?? "Could not load desktop status");
    }
  }, [bot.id, sandboxId]);

  useEffect(() => {
    if (!sandboxId) return;
    setIsLoading(true);
    void loadStatus().finally(() => setIsLoading(false));

    pollRef.current = setInterval(() => {
      void loadStatus();
    }, 5000);

    const onVisibility = () => {
      if (document.hidden) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        statusAbortRef.current?.abort();
      } else {
        void loadStatus();
        if (!pollRef.current) {
          pollRef.current = setInterval(() => void loadStatus(), 5000);
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
      statusAbortRef.current?.abort();
    };
  }, [loadStatus, sandboxId]);

  const loadScreenshot = useCallback(async () => {
    if (!sandboxId) return;
    if (typeof document !== "undefined" && document.hidden) return;
    if (screenshotInFlightRef.current) return;

    screenshotAbortRef.current?.abort();
    const controller = new AbortController();
    screenshotAbortRef.current = controller;
    screenshotInFlightRef.current = true;
    setScreenshotLoading(true);

    try {
      const result = await getBotDesktopScreenshot(bot.id, sandboxId, controller.signal);
      if (controller.signal.aborted) return;
      if (result.ok && result.data) {
        setScreenshot(result.data);
        screenshotFailuresRef.current = 0;
      } else {
        setScreenshot(null);
        screenshotFailuresRef.current += 1;
      }
    } catch (err) {
      screenshotFailuresRef.current += 1;
      console.error("[BotDesktopView] screenshot load failed:", err);
    } finally {
      screenshotInFlightRef.current = false;
      setScreenshotLoading(false);
    }
  }, [bot.id, sandboxId]);

  useEffect(() => {
    if (!sandboxId) return;

    // Poll screenshots when VNC is not connected so the panel still feels live.
    const canConnect =
      (status?.control_state === "human_controls" || status?.control_state === "human_observing") &&
      !!status?.ws_url &&
      status.protocol === "vnc";
    if (canConnect) {
      setScreenshot(null);
      screenshotFailuresRef.current = 0;
      screenshotAbortRef.current?.abort();
      if (screenshotPollRef.current) {
        clearInterval(screenshotPollRef.current);
        screenshotPollRef.current = null;
      }
      return;
    }

    // Exponential backoff on repeated screenshot failures so a broken/stopped
    // desktop does not hammer the API.
    const baseIntervalMs = 4000;
    const failureBackoff = Math.min(screenshotFailuresRef.current, 5);
    const intervalMs = baseIntervalMs * (failureBackoff === 0 ? 1 : 2 ** failureBackoff);

    const onVisibility = () => {
      if (document.hidden) {
        if (screenshotPollRef.current) {
          clearInterval(screenshotPollRef.current);
          screenshotPollRef.current = null;
        }
        screenshotAbortRef.current?.abort();
      } else if (status?.status === "running" && !screenshotPollRef.current) {
        void loadScreenshot();
        screenshotPollRef.current = setInterval(() => void loadScreenshot(), intervalMs);
      }
    };

    if (status?.status === "running") {
      void loadScreenshot();
      screenshotPollRef.current = setInterval(() => void loadScreenshot(), intervalMs);
    }

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (screenshotPollRef.current) clearInterval(screenshotPollRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
      screenshotAbortRef.current?.abort();
    };
  }, [status, loadScreenshot, sandboxId]);

  const disconnectVnc = useCallback(() => {
    if (rfbRef.current) {
      try {
        rfbRef.current.disconnect();
      } catch {
        // ignore
      }
      rfbRef.current = null;
    }
  }, []);

  const connectVnc = useCallback(async (wsPath: string) => {
    if (!canvasRef.current) return;
    disconnectVnc();

    try {
      if (!RFBModuleRef.current) {
        RFBModuleRef.current = await import("@novnc/novnc");
      }
      const RFB = RFBModuleRef.current.default || RFBModuleRef.current;
      if (typeof RFB !== "function") {
        throw new Error("VNC viewer module is not available");
      }
      const url = wsUrlFromPath(wsPath);
      const rfb = new RFB(canvasRef.current, url, {
        scaleViewport: true,
        resizeSession: true,
        clipViewport: false,
      });
      rfbRef.current = rfb;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start VNC viewer");
    }
  }, [disconnectVnc]);

  useEffect(() => {
    const wsUrl = status?.ws_url;
    const canConnect =
      (status?.control_state === "human_controls" || status?.control_state === "human_observing") &&
      !!wsUrl &&
      status.protocol === "vnc";
    if (canConnect && wsUrl) {
      connectVnc(wsUrl);
    } else {
      disconnectVnc();
    }

    return () => disconnectVnc();
  }, [status, connectVnc, disconnectVnc]);

  const setSessionControlState = (controlState: ControlState) => {
    try {
      const store = useChatSessionStore.getState();
      const session = store.sessions.find(
        (s) => s.metadata?.agentId === bot.id || s.metadata?.agentName === bot.name
      );
      if (session && typeof store.updateSession === "function") {
        void store.updateSession(session.id, {
          metadata: { ...session.metadata, vmControlState: controlState } as any,
        });
      }
    } catch {
      // Best-effort: don't let session metadata bookkeeping break the UI.
    }
  };

  const handleObserve = async () => {
    if (!sandboxId) return;
    setIsLoading(true);
    const result = await observeBotDesktop(bot.id, sandboxId);
    if (result.ok) {
      setSessionControlState("human_observing");
      await loadStatus();
    } else {
      setError(result.error ?? "Observe failed");
    }
    setIsLoading(false);
  };

  const handleTakeOver = async () => {
    if (!sandboxId) return;
    setIsLoading(true);
    const result = await takeOverBotDesktop(bot.id, sandboxId);
    if (result.ok) {
      setSessionControlState("human_controls");
      await loadStatus();
    } else {
      setError(result.error ?? "Take over failed");
    }
    setIsLoading(false);
  };

  const handleHandBack = async () => {
    if (!sandboxId) return;
    setIsLoading(true);
    const result = await handBackBotDesktop(bot.id, sandboxId);
    if (result.ok) {
      setSessionControlState("bot_controls");
      await loadStatus();
    } else {
      setError(result.error ?? "Hand back failed");
    }
    setIsLoading(false);
  };

  const handleProvision = async () => {
    if (mode === "host" && !hostOptIn) {
      setError("Host computer control must be explicitly enabled before provisioning.");
      return;
    }
    setIsProvisioning(true);
    setError(null);
    screenshotFailuresRef.current = 0;
    const result = await provisionBotDesktop(bot.id);
    if (result.ok && result.data) {
      setVm(result.data);
    } else {
      setError(result.error ?? "Could not provision a desktop for this bot");
    }
    setIsProvisioning(false);
  };

  const handleStart = async () => {
    if (!sandboxId) return;
    setIsLoading(true);
    screenshotFailuresRef.current = 0;
    const result = await startBotDesktop(bot.id, sandboxId);
    if (result.ok) await loadStatus();
    else setError(result.error ?? "Start failed");
    setIsLoading(false);
  };

  const handleStop = async () => {
    if (!sandboxId) return;
    setIsLoading(true);
    const result = await stopBotDesktop(bot.id, sandboxId);
    if (result.ok) {
      disconnectVnc();
      await loadStatus();
    } else {
      setError(result.error ?? "Stop failed");
    }
    setIsLoading(false);
  };

  const handlePause = async () => {
    if (!sandboxId) return;
    setIsLoading(true);
    const result = await pauseBotDesktop(bot.id, sandboxId);
    if (result.ok) await loadStatus();
    else setError(result.error ?? "Pause failed");
    setIsLoading(false);
  };

  const handleResume = async () => {
    if (!sandboxId) return;
    setIsLoading(true);
    screenshotFailuresRef.current = 0;
    const result = await resumeBotDesktop(bot.id, sandboxId);
    if (result.ok) await loadStatus();
    else setError(result.error ?? "Resume failed");
    setIsLoading(false);
  };

  const handleDestroy = async () => {
    if (!sandboxId) return;
    if (!window.confirm(`Destroy ${getBotDisplayName(bot)}'s virtual computer? Files inside the sandbox may be lost.`)) {
      return;
    }
    setIsLoading(true);
    disconnectVnc();
    const result = await destroyBotDesktop(bot.id, sandboxId);
    if (result.ok) {
      setVm(null);
      setStatus(null);
      setScreenshot(null);
    } else {
      setError(result.error ?? "Destroy failed");
    }
    setIsLoading(false);
  };

  const openDesktop = () => {
    const viewerUrl = status?.viewer_url || status?.ws_url || vm?.host;
    if (!viewerUrl) {
      setError("No desktop viewer URL is available yet");
      return;
    }
    const url = viewerUrl.startsWith("/")
      ? `${window.location.protocol}//${window.location.host}${viewerUrl}`
      : viewerUrl;
    const tab = window.open(url, "_blank", "noopener,noreferrer");
    if (!tab) setError("Your browser blocked the desktop tab");
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const displayName = getBotDisplayName(bot);
  const controlState = status?.control_state ?? "bot_controls";
  const isHumanControl = controlState === "human_controls";
  const isObserving = controlState === "human_observing";
  const statusValue = status?.status ?? "off";
  const isRunning = statusValue === "running";
  const isStopped = statusValue === "stopped";
  const ModeIcon = modeIcon(mode);
  const lastError = status?.last_error ?? null;

  const statusBadge = {
    running: {
      bg: "color-mix(in srgb, var(--status-success) 14%, transparent)",
      color: "var(--status-success)",
      label: "Running",
      pulse: true,
    },
    stopped: {
      bg: "color-mix(in srgb, var(--status-warning) 14%, transparent)",
      color: "var(--status-warning)",
      label: "Stopped",
      pulse: false,
    },
    off: {
      bg: "color-mix(in srgb, var(--text-tertiary) 14%, transparent)",
      color: "var(--text-tertiary)",
      label: "Off",
      pulse: false,
    },
    error: {
      bg: "color-mix(in srgb, var(--status-error) 14%, transparent)",
      color: "var(--status-error)",
      label: "Error",
      pulse: false,
    },
  }[statusValue];

  return (
    <div className="space-y-6" ref={containerRef}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <CaretLeft size={14} />
            Home
          </button>
          <div
            className="flex shrink-0 items-center justify-center rounded-xl"
            style={{
              width: 40,
              height: 40,
              background: `color-mix(in srgb, ${accentColor} 14%, transparent)`,
            }}
          >
            <Desktop size={20} style={{ color: accentColor }} />
          </div>
          <div>
            <h2 className="text-[20px] font-semibold text-[var(--text-primary)]">Desktop</h2>
            <p className="text-[13px] text-[var(--text-secondary)]">
              {isRunning
                ? isHumanControl
                  ? `You are controlling ${displayName}'s virtual computer`
                  : isObserving
                    ? `Observing ${displayName}'s virtual computer`
                    : `${displayName} is using its virtual computer`
                : "No active virtual computer desktop"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {vm?.sandbox_id && (
            <>
              {isRunning && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openDesktop}
                  className="gap-1.5"
                >
                  <Monitor size={14} />
                  Open desktop
                </Button>
              )}
              {isHumanControl ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleHandBack}
                  disabled={isLoading}
                  className="gap-1.5"
                >
                  <Hand size={14} />
                  Hand back to bot
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleObserve}
                    disabled={isLoading || isObserving || !isRunning}
                    className="gap-1.5"
                  >
                    <Eye size={14} />
                    {isObserving ? "Observing" : "Observe"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleTakeOver}
                    disabled={isLoading || !isRunning}
                    className="gap-1.5"
                    style={{ background: accentColor, color: "#fff" }}
                  >
                    <Play size={14} weight="fill" />
                    Take over
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={toggleFullscreen}
                className="gap-1.5"
              >
                {isFullscreen ? <ArrowsInSimple size={14} /> : <ArrowsOutSimple size={14} />}
                {isFullscreen ? "Exit" : "Fullscreen"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Mode selector + lifecycle controls */}
      {vm?.sandbox_id && (
        <GlassSurface className="p-3 rounded-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[var(--text-tertiary)] mr-1">Runs on</span>
            <div className="flex overflow-hidden rounded-lg border border-[var(--border-subtle)]">
              {(["cloud", "local-vm", "host"] as DesktopMode[]).map((m, i) => {
                const Icon = modeIcon(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                      i > 0 && "border-l border-[var(--border-subtle)]",
                      mode === m
                        ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    <Icon size={13} />
                    {modeLabel(m)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(isStopped || statusValue === "off") && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleStart}
                disabled={isLoading}
                className="gap-1.5"
              >
                <Power size={14} />
                Start
              </Button>
            )}
            {isRunning && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePause}
                  disabled={isLoading}
                  className="gap-1.5"
                >
                  <Pause size={14} />
                  Pause
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleStop}
                  disabled={isLoading}
                  className="gap-1.5"
                >
                  <Stop size={14} />
                  Stop
                </Button>
              </>
            )}
            {isStopped && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleResume}
                disabled={isLoading}
                className="gap-1.5"
              >
                <Play size={14} weight="fill" />
                Resume
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDestroy}
              disabled={isLoading}
              className="gap-1.5"
            >
              <Trash size={14} />
              Destroy
            </Button>
          </div>
        </GlassSurface>
      )}

      {mode === "host" && (
        <GlassSurface className="p-4 rounded-xl border border-dashed border-[var(--border-subtle)]">
          <div className="flex items-start gap-3">
            <Warning size={18} className="text-[var(--status-warning)] shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-[13px] font-medium text-[var(--text-primary)]">
                Host computer control
              </div>
              <p className="text-[13px] text-[var(--text-secondary)] mt-1">
                In this mode the bot can view and control this computer. Enable it only when you
                want the bot to use your local desktop as its workspace.
              </p>
              {!hostOptIn && (
                <Button
                  size="sm"
                  onClick={() => setHostOptIn(true)}
                  className="mt-3 gap-1.5"
                  style={{ background: accentColor, color: "#fff" }}
                >
                  <Power size={14} />
                  Enable host control
                </Button>
              )}
            </div>
          </div>
        </GlassSurface>
      )}

      {error && (
        <div className="rounded-xl border border-[var(--status-error)]/30 bg-[var(--status-error)]/10 p-3 flex items-start gap-3">
          <Warning size={18} className="text-[var(--status-error)] shrink-0 mt-0.5" />
          <div className="text-[13px] text-[var(--status-error)]">{error}</div>
        </div>
      )}

      {lastError && (
        <div className="rounded-xl border border-[var(--status-warning)]/30 bg-[var(--status-warning)]/10 p-3 flex items-start gap-3">
          <Warning size={18} className="text-[var(--status-warning)] shrink-0 mt-0.5" />
          <div className="text-[13px] text-[var(--status-warning)]">
            <span className="font-medium">Desktop error:</span> {lastError}
          </div>
        </div>
      )}

      {!vm?.sandbox_id ? (
        <GlassSurface className="p-10 text-center rounded-xl border border-dashed border-[var(--border-subtle)]">
          <Desktop size={32} className="mx-auto mb-3 text-[var(--text-tertiary)]" />
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">No active sandbox</h3>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1 max-w-md mx-auto">
            Provision a persistent virtual computer for this bot. It will stay alive across sessions and can be observed or taken over at any time.
          </p>
          <Button
            size="sm"
            onClick={handleProvision}
            disabled={isProvisioning}
            className="gap-1.5 mt-4"
            style={{ background: accentColor, color: "#fff" }}
          >
            {isProvisioning ? (
              <Spinner size={14} className="animate-spin" />
            ) : (
              <Play size={14} weight="fill" />
            )}
            {isProvisioning ? "Provisioning..." : "Provision computer"}
          </Button>
        </GlassSurface>
      ) : isLoading && !status ? (
        <GlassSurface className="p-10 text-center rounded-xl">
          <Spinner size={24} className="animate-spin mx-auto mb-3 text-[var(--accent-primary)]" />
          <p className="text-[13px] text-[var(--text-secondary)]">Connecting to desktop...</p>
        </GlassSurface>
      ) : statusValue !== "running" ? (
        <GlassSurface className="p-10 text-center rounded-xl border border-dashed border-[var(--border-subtle)]">
          <Robot size={32} className="mx-auto mb-3 text-[var(--text-tertiary)]" />
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Desktop is {statusBadge.label.toLowerCase()}</h3>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            The sandbox does not expose a VNC/desktop stream yet. Start the computer or make sure the bot is configured with a desktop image and VNC enabled.
          </p>
          {isStopped && (
            <Button
              size="sm"
              onClick={handleStart}
              disabled={isLoading}
              className="gap-1.5 mt-4"
              style={{ background: accentColor, color: "#fff" }}
            >
              <Power size={14} />
              Start computer
            </Button>
          )}
        </GlassSurface>
      ) : (
        <GlassSurface className="rounded-xl overflow-hidden flex flex-col" style={{ minHeight: 480 }}>
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: statusBadge.bg,
                  color: statusBadge.color,
                }}
              >
                <span
                  className={cn("size-1.5 rounded-full", statusBadge.pulse && "animate-pulse")}
                  style={{ background: statusBadge.color }}
                />
                {statusBadge.label}
              </span>
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: isHumanControl
                    ? "color-mix(in srgb, var(--status-warning) 14%, transparent)"
                    : isObserving
                      ? "color-mix(in srgb, var(--accent-primary) 14%, transparent)"
                      : "color-mix(in srgb, var(--status-success) 14%, transparent)",
                  color: isHumanControl
                    ? "var(--status-warning)"
                    : isObserving
                      ? "var(--accent-primary)"
                      : "var(--status-success)",
                }}
              >
                {isHumanControl ? "You are driving" : isObserving ? "You are observing" : "Bot is driving"}
              </span>
              <span className="text-[11px] text-[var(--text-tertiary)]">
                Sandbox {vm.sandbox_id}
              </span>
            </div>
            <div className="text-[11px] text-[var(--text-tertiary)]">
              {status?.protocol === "vnc" ? "VNC stream" : status?.protocol === "novnc" ? "noVNC" : "Desktop"}
              {mode !== "cloud" && ` · ${modeLabel(mode)}`}
            </div>
          </div>

          <div className="flex-1 bg-black min-h-[480px] relative" style={{ width: "100%", height: "100%" }}>
            <div
              ref={canvasRef}
              className="absolute inset-0 bg-black"
              style={{ width: "100%", height: "100%" }}
            />

            {!isHumanControl && !isObserving && screenshot && !screenshotLoading && (
              <img
                src={`data:${screenshot.mime};base64,${screenshot.png}`}
                alt={`${displayName}'s desktop preview`}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              />
            )}

            {screenshotLoading && !screenshot && !isHumanControl && !isObserving && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-elevated)]/60 z-10">
                <Spinner size={24} className="animate-spin text-[var(--accent-primary)]" />
              </div>
            )}
          </div>

          {controlState === "bot_controls" && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-elevated)]/80 backdrop-blur-sm z-10">
              <div className="text-center p-6">
                <Robot size={40} className="mx-auto mb-3 text-[var(--text-secondary)]" />
                <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Bot is using this desktop</h3>
                <p className="text-[13px] text-[var(--text-secondary)] mt-1 mb-4">
                  Observe silently or take over to interact with the virtual computer directly.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleObserve}
                    disabled={isLoading}
                    className="gap-1.5"
                  >
                    <Eye size={14} />
                    Observe
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleTakeOver}
                    disabled={isLoading}
                    className="gap-1.5"
                    style={{ background: accentColor, color: "#fff" }}
                  >
                    <Hand size={14} />
                    Take Over
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isObserving && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium"
                style={{
                  background: "color-mix(in srgb, var(--accent-primary) 16%, transparent)",
                  color: "var(--accent-primary)",
                  border: "1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)",
                }}
              >
                <Eye size={12} />
                Observing — bot is still running
              </div>
            </div>
          )}
        </GlassSurface>
      )}
    </div>
  );
}
