import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiChat02Icon,
  PlayIcon,
  PauseIcon,
  Archive02Icon,
  Copy01Icon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import {
  type CloudSession,
  type ComputerKind,
  archiveCloudSession,
  buildSessionBody,
  createCloudSession,
  parseSseChunk,
  sendCloudEvent,
  sessionCreateCurl,
} from "@/lib/cloud-agents";
import { QUIET_BUTTON_CLASS } from "@/components/settings/buttonStyles";

const KINDS: ComputerKind[] = ["none", "sandbox", "desktop", "fabric", "local"];
const FIELD_CLASS =
  "w-full p-2 px-3 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]";
const PRIMARY_BUTTON_CLASS =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] hover:brightness-110 transition-all disabled:opacity-50";

export function AgentsPage() {
  const [model, setModel] = useState("default");
  const [instructions, setInstructions] = useState("Be terse. Report real output.");
  const [prompt, setPrompt] = useState("Summarize what you can see and stop.");
  const [computerKind, setComputerKind] = useState<ComputerKind>("none");
  const [maxCostUsd, setMaxCostUsd] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [session, setSession] = useState<CloudSession | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const body = useMemo(
    () =>
      buildSessionBody({
        model,
        instructions,
        prompt,
        computerKind,
        maxCostUsd: maxCostUsd ? Number(maxCostUsd) : undefined,
      }),
    [model, instructions, prompt, computerKind, maxCostUsd],
  );
  const curl = useMemo(() => sessionCreateCurl(body), [body]);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const streamEvents = useCallback(
    async (sessionId: string) => {
      stopStream();
      const controller = new AbortController();
      abortRef.current = controller;
      const response = await api.raw(
        `/api/v1/sessions/${encodeURIComponent(sessionId)}/events/stream`,
        { method: "GET", signal: controller.signal },
      );
      if (!response.ok || !response.body) {
        throw new Error(`Event stream failed: HTTP ${response.status}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (!controller.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = parseSseChunk(buffer, (event) => {
          const type = event.type;
          if (type) setEvents((prev) => [...prev, type]);
        });
      }
    },
    [stopStream],
  );

  const onStart = useCallback(async () => {
    setRunning(true);
    setError(null);
    setUnavailable(false);
    setEvents([]);
    setSession(null);
    try {
      const result = await createCloudSession(body);
      if (!result.ok) {
        setUnavailable(result.unavailable);
        setError(result.code ? `${result.code}: ${result.error}` : result.error);
        return;
      }
      setSession(result.session);
      await streamEvents(result.session.id).catch((err) => {
        if ((err as Error).name !== "AbortError") setError((err as Error).message);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, [body, streamEvents]);

  const onInterrupt = useCallback(async () => {
    if (!session?.id) return;
    await sendCloudEvent(session.id, "user.interrupt");
    stopStream();
  }, [session, stopStream]);

  const onArchive = useCallback(async () => {
    if (!session?.id) return;
    await archiveCloudSession(session.id);
    stopStream();
  }, [session, stopStream]);

  useEffect(() => () => stopStream(), [stopStream]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">
            Agents
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            Start a Cloud Agent session. Same contract as /api/v1/sessions.
          </p>
        </div>
        {session ? (
          <div className="text-right text-[12px] text-[var(--text-secondary)]">
            <div>
              {session.budget?.estimated_cost_usd == null
                ? "—"
                : `$${Number(session.budget.estimated_cost_usd).toFixed(4)} estimated`}
            </div>
            <div>{session.budget?.charged === false ? "not charged" : ""}</div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[var(--text-tertiary)]">Model</label>
            <input className={FIELD_CLASS} value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[var(--text-tertiary)]">Instructions</label>
            <textarea
              className={FIELD_CLASS}
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[var(--text-tertiary)]">Input</label>
            <textarea
              className={FIELD_CLASS}
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--text-tertiary)]">Computer</label>
              <select
                className={FIELD_CLASS}
                value={computerKind}
                onChange={(e) => setComputerKind(e.target.value as ComputerKind)}
              >
                {KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--text-tertiary)]">
                Max cost USD (telemetry)
              </label>
              <input
                className={FIELD_CLASS}
                value={maxCostUsd}
                onChange={(e) => setMaxCostUsd(e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={running} onClick={() => void onStart()}>
              <HugeiconsIcon icon={PlayIcon} size={13} />
              {running ? "Starting…" : "Start session"}
            </button>
            <button type="button" className={QUIET_BUTTON_CLASS} disabled={!session} onClick={() => void onInterrupt()}>
              <HugeiconsIcon icon={PauseIcon} size={13} />
              Interrupt
            </button>
            <button type="button" className={QUIET_BUTTON_CLASS} disabled={!session} onClick={() => void onArchive()}>
              <HugeiconsIcon icon={Archive02Icon} size={13} />
              Archive
            </button>
            <button
              type="button"
              className={QUIET_BUTTON_CLASS}
              onClick={() => {
                void navigator.clipboard.writeText(curl);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
            >
              <HugeiconsIcon icon={Copy01Icon} size={13} />
              {copied ? "Copied" : "Copy curl"}
            </button>
          </div>
          {error ? (
            <div
              className={cn(
                "rounded-xl border border-solid p-3 text-[12px] flex gap-2",
                unavailable
                  ? "border-[var(--status-warning)]/30 bg-[var(--status-warning)]/10 text-[var(--status-warning)]"
                  : "border-[var(--status-error)]/30 bg-[var(--status-error)]/10 text-[var(--status-error)]",
              )}
            >
              <HugeiconsIcon icon={AlertCircleIcon} size={14} className="shrink-0 mt-0.5" />
              <div>
                {unavailable ? <div className="font-medium mb-1">Computer unavailable</div> : null}
                {error}
                {unavailable ? (
                  <div className="mt-1 opacity-80">
                    Incus/Tart runs on the Computer Cloud VPS. This host has no VM driver. The
                    session was not created as kind none.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          <pre className="text-[11px] leading-relaxed overflow-auto max-h-36 rounded-lg bg-[var(--bg-primary)] p-3 text-[var(--text-tertiary)] whitespace-pre-wrap">
            {curl}
          </pre>
        </div>
        <div className="rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 space-y-3">
          <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
            <HugeiconsIcon icon={AiChat02Icon} size={14} />
            {session
              ? `${session.id} · ${session.status ?? "—"} · ${session.computer?.kind ?? "none"}`
              : "Events appear here after start."}
          </div>
          <ol className="font-mono text-[12px] text-[var(--text-primary)] space-y-1">
            {events.map((type, index) => (
              <li key={`${type}-${index}`}>{type}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
