"use client";

/**
 * Watch strip for a bot session: live desktop screenshot (watch mode) plus
 * compact tool-call rows from the policy audit. Sits beside the dialogue,
 * not inside message bubbles. Reuses screenshot + audit APIs — no new transport.
 *
 * Intentionally screenshot-only. A 140×88 thumbnail must not open a noVNC RFB:
 * decoding a full-resolution desktop stream for an 88px-tall thumb burned
 * ~470% renderer CPU and starved the node daemon's terminal relay.
 *
 * @module BotWatchStrip
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Desktop, Eye } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { getBotDesktopScreenshot } from "@/lib/bots/vm-operator";
import { activityCounts, formatActivityLines } from "@/lib/bots/bot-activity-rows";
import { fetchSubagentFeed, liveActivityTree, type SubagentRow } from "@/lib/bots/bot-subagent-feed";
import type { BotChatTranscript } from "@/components/bot-chat/types";
import { BotSubagentTree } from "./BotSubagentTree";
import { fetchPolicyAudit, type PolicyAuditRow } from "./policy-audit";

const SCREEN_POLL_MS = 4000;
const AUDIT_POLL_MS = 3000;

export interface BotWatchStripProps {
  botId: string;
  sandboxId?: string;
  computerOpen?: boolean;
  onOpenComputer?: () => void;
  transcript?: BotChatTranscript;
  parentName?: string;
}

export function BotWatchStrip({
  botId,
  sandboxId,
  computerOpen,
  onOpenComputer,
  transcript,
  parentName,
}: BotWatchStripProps) {
  const [png, setPng] = useState<string | null>(null);
  const [screenError, setScreenError] = useState(false);
  const [subagents, setSubagents] = useState<SubagentRow[]>([]);
  const [rows, setRows] = useState<PolicyAuditRow[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const [onscreen, setOnscreen] = useState(true);
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === "undefined" || !document.hidden,
  );
  const screenActive = pageVisible && onscreen && !computerOpen;

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      setOnscreen(entries.some((entry) => entry.isIntersecting));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

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
    if (!sandboxId || !screenActive) return;
    const controller = new AbortController();
    void loadScreen(controller.signal);
    const id = window.setInterval(() => void loadScreen(controller.signal), SCREEN_POLL_MS);
    return () => {
      controller.abort();
      window.clearInterval(id);
    };
  }, [sandboxId, screenActive, loadScreen]);

  useEffect(() => {
    void loadAudit();
    const id = window.setInterval(() => void loadAudit(), AUDIT_POLL_MS);
    return () => window.clearInterval(id);
  }, [loadAudit]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await fetchSubagentFeed(botId);
        if (!cancelled) setSubagents(rows);
      } catch {
        if (!cancelled) setSubagents([]);
      }
    };
    void load();
    const id = window.setInterval(() => void load(), AUDIT_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [botId]);

  const lines = formatActivityLines(rows);
  const counts = activityCounts(rows);
  const tree = liveActivityTree(transcript, subagents, parentName);
  const showScreen = Boolean(sandboxId) && !computerOpen;

  if (!showScreen && lines.length === 0 && tree.children.length === 0 && tree.parentSteps.length === 0) {
    return null;
  }

  return (
    <div
      ref={rootRef}
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
          {png ? (
            <img
              src={`data:image/png;base64,${png}`}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] text-[var(--text-tertiary)]">
              <Desktop size={16} />
              {screenError ? "screen unavailable" : "watching…"}
            </span>
          )}
          <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-medium text-white">
            <Eye size={10} />
            watch
          </span>
        </button>
      )}

      <div className="min-w-0 flex-1">
        {tree.children.length > 0 || tree.parentSteps.length > 0 ? (
          <BotSubagentTree tree={tree} />
        ) : (
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
            {counts.allowed} allowed · {counts.denied} denied
          </p>
        )}
        {lines.length > 0 && (
          <ul className="mt-1 flex flex-col gap-0.5">
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
        {lines.length === 0 && !(tree && (tree.children.length > 0 || tree.parentSteps.length > 0)) ? (
          <p className="text-[11px] text-[var(--text-tertiary)]">No actions yet</p>
        ) : null}
      </div>
    </div>
  );
}

export default BotWatchStrip;
