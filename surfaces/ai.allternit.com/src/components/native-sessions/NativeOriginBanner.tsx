"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ArrowsClockwise, ArrowSquareOut } from "@phosphor-icons/react";
import {
  nativeSessionsApi,
  sourceRefFromMetadata,
  type FetchOriginResult,
  type NativeSourceRef,
} from "@/lib/agents/native-sessions-api";

export function NativeOriginBanner({
  sessionId,
  metadata,
}: {
  sessionId: string | null | undefined;
  metadata?: Record<string, unknown>;
}): React.ReactNode {
  const source = sourceRefFromMetadata(metadata);
  const [status, setStatus] = useState<FetchOriginResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exported, setExported] = useState<string | null>(null);

  const exportNative = useCallback(async () => {
    if (!sessionId || !source) return;
    setBusy(true);
    setError(null);
    try {
      const result = await nativeSessionsApi.exportNative(sessionId, source.harness);
      setExported(`${result.resumeHint}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [sessionId, source?.harness]);

  const refresh = useCallback(async () => {
    if (!sessionId || !source) return;
    setBusy(true);
    setError(null);
    try {
      setStatus(await nativeSessionsApi.fetchOrigin(sessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [sessionId, source?.harness, source?.sessionId]);

  useEffect(() => {
    if (!sessionId || !source) return;
    void refresh();
  }, [sessionId, source?.sessionId, refresh]);

  if (!sessionId || !source) return null;

  const label = status?.divergence === "native_ahead"
    ? `${source.harness} origin has ${status.fetched} new turn${status.fetched === 1 ? "" : "s"}`
    : status?.divergence === "missing"
      ? `${source.harness} origin file is missing`
      : `Continued from ${source.harness} ${source.sessionId.slice(0, 8)}`;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] border-b border-solid border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]">
      <span className="rounded bg-[var(--surface-primary)] px-1.5 py-0.5 font-bold uppercase tracking-wide">
        {source.harness}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {error ? <span className="text-[var(--status-error)] truncate">{error}</span> : null}
      {exported ? <span className="truncate text-[var(--text-primary)]">{exported}</span> : null}
      <button
        type="button"
        onClick={() => void refresh()}
        disabled={busy}
        className="inline-flex items-center gap-1 border-0 bg-transparent text-[var(--text-primary)] cursor-pointer disabled:opacity-50"
        title="Fetch origin delta"
      >
        <ArrowsClockwise size={12} className={busy ? "animate-spin" : undefined} />
        Fetch
      </button>
      <button
        type="button"
        onClick={() => void exportNative()}
        disabled={busy}
        className="inline-flex items-center gap-1 border-0 bg-transparent text-[var(--text-primary)] cursor-pointer disabled:opacity-50"
        title="Write a NEW native session (never overwrites origin)"
      >
        <ArrowSquareOut size={12} />
        Open in {source.harness}
      </button>
    </div>
  );
}

export function NativeSourceBadge({ source }: { source?: NativeSourceRef }): React.ReactNode {
  if (!source) return null;
  return (
    <span className="ml-1 rounded bg-[var(--surface-secondary)] px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--text-tertiary)]">
      {source.harness}
    </span>
  );
}
