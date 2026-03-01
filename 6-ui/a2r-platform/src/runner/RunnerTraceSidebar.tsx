import React from "react";
import { useRunnerStore } from "./runner.store";
import type { RunnerTraceEntry } from "./runner.types";

const statusColor: Record<string, string> = {
  running: "#ff9f0a",
  success: "#34c759",
  error: "#ff3b30",
};

function formatTime(ts: number) {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return "";
  }
}

function TraceRow({ entry }: { entry: RunnerTraceEntry }) {
  const color = entry.status ? statusColor[entry.status] || "#999" : "#999";
  return (
    <div className="p-3 rounded-xl border bg-card/70 flex flex-col gap-1.5">
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span className="uppercase tracking-wide">{entry.kind}</span>
        <span>{formatTime(entry.timestamp)}</span>
      </div>
      <div className="text-sm font-semibold">{entry.title}</div>
      {entry.detail && (
        <div className="text-xs text-muted-foreground whitespace-pre-wrap">{entry.detail}</div>
      )}
      {entry.status && (
        <div className="text-[11px] font-bold" style={{ color }}>{entry.status.toUpperCase()}</div>
      )}
    </div>
  );
}

export function RunnerTraceSidebar() {
  const { trace, activeRun } = useRunnerStore();
  const hasTrace = trace.length > 0;

  return (
    <div className="h-full w-64 flex flex-col gap-3 p-3 rounded-xl border bg-card/50">
      <div className="flex justify-between items-center">
        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
          Thought Trace
        </div>
        {activeRun && (
          <div className="text-[11px] text-muted-foreground">
            {activeRun.state.toUpperCase()}
          </div>
        )}
      </div>

      {!hasTrace && (
        <div className="text-xs text-muted-foreground italic">
          Waiting for trace events…
        </div>
      )}

      <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 min-h-0">
        {trace.map((entry) => (
          <TraceRow key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
