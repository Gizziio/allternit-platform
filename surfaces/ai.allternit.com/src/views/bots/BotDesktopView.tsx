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
} from "@phosphor-icons/react";
import type { Agent } from "@/lib/agents/agent.types";
import { useChatSessionStore } from "@/views/chat/ChatSessionStore";
import {
  getBotDesktopStatus,
  handBackBotDesktop,
  observeBotDesktop,
  provisionBotDesktop,
  takeOverBotDesktop,
  type BotDesktopStatus,
  type BotDesktopSandbox,
} from "@/lib/bots/vm-operator";
import { getBotDisplayName } from "@/lib/bots/bot-profile";
import { Button } from "@/components/ui/button";
import { GlassSurface } from "@/design/GlassSurface";

interface BotDesktopViewProps {
  bot: Agent;
  accentColor: string;
  activeVM: { id: string; provider: string; status: string; vncUrl?: string } | null;
  onBack: () => void;
}

type ControlState = "bot_controls" | "human_observing" | "human_controls";

function wsUrlFromPath(path: string): string {
  if (typeof window === "undefined") return path;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  return `${protocol}//${host}${path}`;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const RFBModuleRef = useRef<any>(null);

  useEffect(() => {
    if (activeVM) {
      setVm({ sandbox_id: activeVM.id, status: activeVM.status, provider: activeVM.provider });
    }
  }, [activeVM]);

  const sandboxId = vm?.sandbox_id;

  const loadStatus = useCallback(async () => {
    if (!sandboxId) return;
    const result = await getBotDesktopStatus(bot.id, sandboxId);
    if (result.ok && result.data) {
      setStatus(result.data);
      setError(null);
    } else {
      setError(result.error ?? "Could not load desktop status");
    }
  }, [bot.id, sandboxId]);

  useEffect(() => {
    setIsLoading(true);
    void loadStatus().finally(() => setIsLoading(false));

    pollRef.current = setInterval(() => {
      void loadStatus();
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadStatus]);

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
    setIsProvisioning(true);
    setError(null);
    const result = await provisionBotDesktop(bot.id);
    if (result.ok && result.data) {
      setVm(result.data);
    } else {
      setError(result.error ?? "Could not provision a desktop for this bot");
    }
    setIsProvisioning(false);
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
  const isRunning = status?.status === "running";

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
          {isRunning && (
            <>
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
                    disabled={isLoading || isObserving}
                    className="gap-1.5"
                  >
                    <Eye size={14} />
                    {isObserving ? "Observing" : "Observe"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleTakeOver}
                    disabled={isLoading}
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

      {error && (
        <div className="rounded-xl border border-[var(--status-error)]/30 bg-[var(--status-error)]/10 p-3 flex items-start gap-3">
          <Warning size={18} className="text-[var(--status-error)] shrink-0 mt-0.5" />
          <div className="text-[13px] text-[var(--status-error)]">{error}</div>
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
      ) : status?.status !== "running" ? (
        <GlassSurface className="p-10 text-center rounded-xl border border-dashed border-[var(--border-subtle)]">
          <Robot size={32} className="mx-auto mb-3 text-[var(--text-tertiary)]" />
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Desktop is off</h3>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            The sandbox does not expose a VNC/desktop stream yet. Make sure the bot is configured with a desktop image and VNC enabled.
          </p>
        </GlassSurface>
      ) : (
        <GlassSurface className="rounded-xl overflow-hidden flex flex-col" style={{ minHeight: 480 }}>
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
            <div className="flex items-center gap-2">
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
                <span
                  className={`size-1.5 rounded-full ${
                    isHumanControl
                      ? "bg-[var(--status-warning)]"
                      : isObserving
                        ? "bg-[var(--accent-primary)]"
                        : "bg-[var(--status-success)]"
                  } ${!isHumanControl && !isObserving ? "animate-pulse" : ""}`}
                />
                {isHumanControl ? "You are driving" : isObserving ? "You are observing" : "Bot is driving"}
              </span>
              <span className="text-[11px] text-[var(--text-tertiary)]">
                Sandbox {vm.sandbox_id}
              </span>
            </div>
            <div className="text-[11px] text-[var(--text-tertiary)]">
              {status?.protocol === "vnc" ? "VNC stream" : status?.protocol === "novnc" ? "noVNC" : "Desktop"}
            </div>
          </div>

          <div
            ref={canvasRef}
            className="flex-1 bg-black min-h-[480px] relative"
            style={{ width: "100%", height: "100%" }}
          />

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
