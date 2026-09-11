"use client";

/**
 * Watch strip for a bot session: live desktop screenshot (watch mode) plus
 * compact tool-call rows from the policy audit. Sits beside the dialogue,
 * not inside message bubbles. Reuses screenshot + audit APIs — no new transport.
 *
 * @module BotWatchStrip
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Desktop, Eye } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  getBotDesktopScreenshot,
  getBotDesktopStatus,
  observeBotDesktop,
} from "@/lib/bots/vm-operator";
import { activityCounts, formatActivityLines } from "@/lib/bots/bot-activity-rows";
import { treeFromTranscript } from "@/lib/bots/bot-subagent-tree";
import type { BotChatTranscript } from "@/components/bot-chat/types";
import { fetchPolicyAudit, type PolicyAuditRow } from "./policy-audit";
import { claimVnc, releaseVnc } from "./bot-computer-vnc";

function wsUrlFromPath(path: string): string {
  if (typeof window === "undefined") return path;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${path}`;
}

const SCREEN_POLL_MS = 4000;
const AUDIT_POLL_MS = 3000;

export interface BotWatchStripProps {
  botId: string;
  sandboxId?: string;
  computerOpen?: boolean;
  onOpenComputer?: () => void;
  transcript?: BotChatTranscript;
}

export function BotWatchStrip({
  botId,
  sandboxId,
  computerOpen,
  onOpenComputer,
  transcript,
}: BotWatchStripProps) {
  const [png, setPng] = useState<string | null>(null);
  const [screenError, setScreenError] = useState(false);
  const [live, setLive] = useState(false);
  const [rows, setRows] = useState<PolicyAuditRow[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<{ disconnect?: () => void } | null>(null);

  const loadScreen = useCallback(async (signal: AbortSignal) => {
    if (!sandboxId) return;
    if (typeof document !== "undefined" && document.hidden) return;
    const result = await getBotDesktopScreenshot(botId, sandboxId, signal);
    if (signal.aborted) return;
    if (result.ok && result.data?.png) {
      setPng(result.data.png);
      setScreenError(false);
    } else {
      setScreenError(true);
    }
  }, [botId, sandboxId]);

  const loadAudit = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const fresh = await fetchPolicyAudit(botId, 20);
      setRows(fresh);
    } catch {
      // Keep last good rows; this rail is observational.
    }
  }, [botId]);

  useEffect(() => {
    if (!sandboxId || computerOpen || live) return;
    const controller = new AbortController();
    void loadScreen(controller.signal);
    const id = window.setInterval(() => void loadScreen(controller.signal), SCREEN_POLL_MS);
    return () => {
      controller.abort();
      window.clearInterval(id);
    };
  }, [sandboxId, computerOpen, loadScreen, live]);

  useEffect(() => {
    if (!sandboxId || computerOpen) {
      rfbRef.current?.disconnect?.();
      rfbRef.current = null;
      setLive(false);
      if (sandboxId) releaseVnc(sandboxId, "strip");
      return;
    }
    let cancelled = false;
    void (async () => {
      await observeBotDesktop(botId, sandboxId);
      const status = await getBotDesktopStatus(botId, sandboxId);
      if (cancelled || !status.ok || !status.data?.ws_url) return;
      if (!claimVnc(sandboxId, "strip")) return;
      if (!canvasRef.current) {
        releaseVnc(sandboxId, "strip");
        return;
      }
      try {
        const mod = await import("@novnc/novnc");
        const RFB = (mod as { default?: new (...args: unknown[]) => { disconnect?: () => void; viewOnly?: boolean } }).default ?? (mod as never);
        const rfb = new (RFB as new (t: HTMLElement, u: string, o?: object) => { disconnect?: () => void; viewOnly?: boolean })(
          canvasRef.current,
          wsUrlFromPath(status.data.ws_url),
          { scaleViewport: true, clipViewport: true }
        );
        rfb.viewOnly = true;
        rfbRef.current = rfb;
        if (!cancelled) setLive(true);
      } catch {
        releaseVnc(sandboxId, "strip");
      }
    })();
    return () => {
      cancelled = true;
      rfbRef.current?.disconnect?.();
      rfbRef.current = null;
      releaseVnc(sandboxId, "strip");
      setLive(false);
    };
  }, [botId, sandboxId, computerOpen]);

  useEffect(() => {
    void loadAudit();
    const id = window.setInterval(() => void loadAudit(), AUDIT_POLL_MS);
    return () => window.clearInterval(id);
  }, [loadAudit]);

  const lines = formatActivityLines(rows);
  const counts = activityCounts(rows);
  const tree = transcript ? treeFromTranscript(transcript) : null;
  const showScreen = Boolean(sandboxId) && !computerOpen;

  if (!showScreen && lines.length === 0 && !(tree && tree.nodes.length > 0)) {
    return null;
  }

  return (
    <div
      data-testid="bot-watch-strip"
      className="flex min-h-0 shrink-0 gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2"
    >
      {showScreen && (
        <button
          type="button"
          onClick={onOpenComputer}
          className="relative h-[88px] w-[140px] shrink-0 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)]"
          aria-label="Watch this bot's computer"
        >
          <div ref={canvasRef} className={cn("absolute inset-0", live ? "block" : "hidden")} />
          {!live && png ? (
            <img
              src={`data:image/png;base64,${png}`}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
          {!live && !png ? (
            <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] text-[var(--text-tertiary)]">
              <Desktop size={16} />
              {screenError ? "screen unavailable" : "watching…"}
            </span>
          ) : null}
          <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-medium text-white">
            <Eye size={10} />
            {live ? "live" : "watch"}
          </span>
        </button>
      )}

      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
          {tree
            ? `${tree.running} running · ${tree.done} done`
            : `${counts.allowed} allowed · ${counts.denied} denied`}
        </p>
        {tree && tree.nodes.length > 0 && (
          <ul className="mb-1 flex flex-col gap-0.5">
            {tree.nodes.map((node) => (
              <li key={node.id} className="text-[11px] text-[var(--text-secondary)]">
                <span className="font-medium">{node.name}</span>{" "}
                {node.status === "running" ? "…" : node.status === "error" ? "✗" : "✓"}
                {node.durationMs != null ? (
                  <span className="text-[var(--text-tertiary)]">
                    {" "}
                    {(node.durationMs / 1000).toFixed(1)}s
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {lines.length === 0 ? (
          <p className="text-[11px] text-[var(--text-tertiary)]">No actions yet</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {lines.map((line) => (
              <li
                key={line.key}
                className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]"
              >
                <span
                  className={cn(
                    "font-medium",
                    line.decision === "denied"
                      ? "text-[var(--status-error)]"
                      : "text-[var(--status-success)]"
                  )}
                >
                  {line.tool} {line.decision}
                </span>
                {line.ruleId ? (
                  <span className="font-mono text-[10px] text-[var(--status-error)]">
                    {line.ruleId}
                  </span>
                ) : null}
                <span className="text-[var(--text-tertiary)]">{line.when}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default BotWatchStrip;
