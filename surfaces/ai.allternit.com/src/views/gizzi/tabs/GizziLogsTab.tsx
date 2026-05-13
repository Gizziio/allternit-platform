"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CircleNotch, Terminal, Trash } from "@phosphor-icons/react";
import type { useGatewayClient } from "../use-gateway-client";

interface LogLine {
  id: number;
  ts?: string;
  level?: "debug" | "info" | "warn" | "error";
  message: string;
  source?: string;
}

type GatewayHook = ReturnType<typeof useGatewayClient>;

const MAX_LINES = 500;

export function GizziLogsTab({ gateway }: { gateway: GatewayHook }) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [tailing, setTailing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const counterRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const startTail = useCallback(async () => {
    setError(null);
    try {
      await gateway.request("logs.tail", { lines: 50 });
      setTailing(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start log tail");
    }
  }, [gateway]);

  useEffect(() => {
    if (gateway.status !== "connected") {
      setTailing(false);
      return;
    }

    startTail();

    const unsub = gateway.on("logs.line", (payload) => {
      const raw = payload as { level?: string; message?: string; msg?: string; ts?: string; source?: string } | string;
      let line: LogLine;
      if (typeof raw === "string") {
        line = { id: ++counterRef.current, message: raw };
      } else {
        line = {
          id: ++counterRef.current,
          ts: raw.ts,
          level: raw.level as LogLine["level"],
          message: raw.message ?? raw.msg ?? JSON.stringify(raw),
          source: raw.source,
        };
      }
      setLines((prev) => {
        const next = [...prev, line];
        return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
      });
    });

    return () => {
      unsub();
      setTailing(false);
    };
  }, [gateway.status, gateway, startTail]);

  // Auto-scroll when new lines arrive
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const levelColor = (level?: string) => {
    if (level === "error") return "text-red-400";
    if (level === "warn") return "text-yellow-400";
    if (level === "debug") return "text-muted-foreground";
    return "text-green-400";
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Terminal className="size-4  text-muted-foreground" weight="duotone" />
          <span className="text-sm font-medium">Logs</span>
          {tailing && (
            <div className="flex items-center gap-1">
              <span className="size-1.5  animate-pulse rounded-full bg-green-500" />
              <span className="text-[12px] text-muted-foreground">live</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="size-7  p-0 text-muted-foreground"
            onClick={() => setLines([])}
            title="Clear"
          >
            <Trash className="size-3.5 " />
          </Button>
          {!tailing && (
            <Button variant="ghost" size="sm" onClick={startTail} disabled={gateway.status !== "connected"}>
              <CircleNotch className="size-3.5 " />
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="border-b border-border bg-destructive/5 px-4 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-[#0d0d0d] p-3 font-mono text-xs"
        onScroll={(e) => {
          const el = e.currentTarget;
          autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {lines.length === 0 && (
          <p className="text-muted-foreground">
            {gateway.status === "connected" ? "Waiting for log output..." : "Connect to kernel to view logs"}
          </p>
        )}
        {lines.map((line) => (
          <div key={line.id} className="flex gap-2 leading-5">
            {line.ts && (
              <span className="shrink-0 text-muted-foreground/50">
                {new Date(line.ts).toLocaleTimeString()}
              </span>
            )}
            {line.level && (
              <span className={cn("w-4 shrink-0 uppercase", levelColor(line.level))}>
                {line.level[0]}
              </span>
            )}
            {line.source && (
              <span className="shrink-0 text-muted-foreground/60">[{line.source}]</span>
            )}
            <span className="min-w-0 break-all text-zinc-200">{line.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
