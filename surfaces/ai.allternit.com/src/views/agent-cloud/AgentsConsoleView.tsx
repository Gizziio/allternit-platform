"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Play,
  Robot,
  Spinner,
  Stop,
  Warning,
  Archive,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GlassSurface } from "@/design/GlassSurface";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/integration/api-client";
import {
  archiveConsoleSession,
  buildSessionBody,
  createConsoleSession,
  parseSseChunk,
  retrieveConsoleSession,
  sendConsoleEvent,
  sessionCreateCurl,
  sessionCreateSdk,
  type ComputerKind,
  type ConsoleSession,
} from "@/lib/agents-console-api";

const KINDS: ComputerKind[] = ["none", "sandbox", "desktop", "fabric", "local"];

export function AgentsConsoleView({ sessionId }: { sessionId?: string } = {}) {
  const [model, setModel] = useState("kimi-k2");
  const [instructions, setInstructions] = useState("Be terse. Report real output.");
  const [input, setInput] = useState(() => {
    if (typeof window === "undefined") return "Summarize what you can see and stop.";
    return window.sessionStorage.getItem("agents-console-draft-input") || "Summarize what you can see and stop.";
  });
  const [computerKind, setComputerKind] = useState<ComputerKind>("none");
  const [maxCostUsd, setMaxCostUsd] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [session, setSession] = useState<ConsoleSession | null>(null);
  const [events, setEvents] = useState<Array<{ type?: string }>>([]);
  const [copyHint, setCopyHint] = useState<"curl" | "sdk" | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const body = useMemo(
    () =>
      buildSessionBody({
        model,
        instructions,
        input,
        computerKind,
        maxCostUsd: maxCostUsd ? Number(maxCostUsd) : undefined,
      }),
    [model, instructions, input, computerKind, maxCostUsd],
  );

  const curl = useMemo(() => sessionCreateCurl("http://localhost:8013", body), [body]);
  const sdk = useMemo(() => sessionCreateSdk(body), [body]);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const streamEvents = useCallback(async (sessionId: string) => {
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
        setEvents((prev) => [...prev, { type: event.type }]);
      });
    }
  }, [stopStream]);

  const onRun = useCallback(async () => {
    setRunning(true);
    setError(null);
    setUnavailable(false);
    setEvents([]);
    setSession(null);
    try {
      const result = await createConsoleSession({
        model,
        instructions,
        input,
        computerKind,
        maxCostUsd: maxCostUsd ? Number(maxCostUsd) : undefined,
      });
      if (!result.ok) {
        if (result.unavailable) {
          setUnavailable(true);
          setError(`${result.code}: ${result.error}`);
        } else {
          setError(result.error);
        }
        return;
      }
      setSession(result.session);
      await streamEvents(result.session.id).catch((err) => {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, [model, instructions, input, computerKind, maxCostUsd, streamEvents]);

  const onInterrupt = useCallback(async () => {
    if (!session?.id) return;
    await sendConsoleEvent(session.id, "user.interrupt");
    stopStream();
  }, [session, stopStream]);

  const onArchive = useCallback(async () => {
    if (!session?.id) return;
    await archiveConsoleSession(session.id);
    stopStream();
  }, [session, stopStream]);

  useEffect(() => () => stopStream(), [stopStream]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await retrieveConsoleSession(sessionId);
        if (cancelled) return;
        setSession(loaded);
        await streamEvents(loaded.id);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, streamEvents]);

  const copy = async (which: "curl" | "sdk") => {
    await navigator.clipboard.writeText(which === "curl" ? curl : sdk);
    setCopyHint(which);
    window.setTimeout(() => setCopyHint(null), 1500);
  };

  const cost = session?.budget?.estimated_cost_usd;
  const charged = session?.budget?.charged;

  return (
    <GlassSurface className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)]">
            <Robot size={22} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">Agents Console</h1>
            <p className="text-xs text-[var(--text-tertiary)]">
              Start a Cloud Agent session. Same API as docs/public/api/sessions.md.
            </p>
          </div>
        </div>
        {session ? (
          <div className="text-right text-xs text-[var(--text-tertiary)]">
            <div>
              {cost == null ? "—" : `$${Number(cost).toFixed(4)}`} estimated
            </div>
            <div>{charged === false ? "not charged" : charged ? "charged" : ""}</div>
          </div>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2">
        <div className="overflow-auto p-6 space-y-4 border-r border-[var(--border-subtle)]">
          <div className="space-y-1.5">
            <Label>Model</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Instructions</Label>
            <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Input</Label>
            <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Computer</Label>
              <Select value={computerKind} onValueChange={(v) => setComputerKind(v as ComputerKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {kind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Max cost USD (telemetry)</Label>
              <Input
                value={maxCostUsd}
                onChange={(e) => setMaxCostUsd(e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void onRun()} disabled={running}>
              {running ? <Spinner size={14} className="animate-spin" /> : <Play size={14} />}
              <span className="ml-1.5">Start session</span>
            </Button>
            <Button variant="outline" onClick={() => void onInterrupt()} disabled={!session}>
              <Stop size={14} />
              <span className="ml-1.5">Interrupt</span>
            </Button>
            <Button variant="outline" onClick={() => void onArchive()} disabled={!session}>
              <Archive size={14} />
              <span className="ml-1.5">Archive</span>
            </Button>
          </div>
          {error ? (
            <div
              className={`rounded-lg border p-3 text-xs flex gap-2 ${
                unavailable
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                  : "border-red-500/20 bg-red-500/10 text-red-400"
              }`}
            >
              <Warning size={14} className="shrink-0 mt-0.5" />
              <div>
                {unavailable ? (
                  <div className="font-medium mb-1">Computer unavailable</div>
                ) : null}
                {error}
                {unavailable ? (
                  <div className="mt-1 text-[var(--text-tertiary)]">
                    Incus/Tart runs on the Computer Cloud VPS. This host has no VM driver.
                    The session was not created as kind none.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => void copy("curl")}>
                <Copy size={12} />
                <span className="ml-1">{copyHint === "curl" ? "Copied" : "Copy curl"}</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void copy("sdk")}>
                <Copy size={12} />
                <span className="ml-1">{copyHint === "sdk" ? "Copied" : "Copy SDK"}</span>
              </Button>
            </div>
            <pre className="text-[10px] leading-relaxed overflow-auto max-h-40 rounded-md bg-black/30 p-3 text-[var(--text-tertiary)]">
              {curl}
            </pre>
          </div>
        </div>
        <div className="overflow-auto p-6 space-y-3">
          <div className="text-xs text-[var(--text-tertiary)]">
            {session
              ? `Session ${session.id} · ${session.status ?? "—"} · computer ${session.computer?.kind ?? "none"}`
              : "Events appear here after start."}
          </div>
          <ol className="space-y-1 font-mono text-xs">
            {events.map((event, index) => (
              <li key={`${event.type}-${index}`} className="text-[var(--text-primary)]">
                {event.type ?? "event"}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </GlassSurface>
  );
}

export default AgentsConsoleView;
