import React from "react";
import { cn } from "@/lib/utils";
import type { ChatRunState } from "./useChatRun";

const OUTPUT_CLASS =
  "min-h-[160px] whitespace-pre-wrap rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 font-mono text-[12px] leading-relaxed text-[var(--text-primary)]";

interface OutputPaneProps {
  title: string;
  state: ChatRunState;
  /** Shown while idle to explain what will happen on Run. */
  idleCaption: string;
}

/** Streaming completion output for one playground lane. */
export function OutputPane({
  title,
  state,
  idleCaption,
}: OutputPaneProps): React.ReactNode {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-[var(--text-secondary)]">
          {title}
        </span>
        {state.running && (
          <span className="text-[11px] text-[var(--text-tertiary)]">
            Streaming…
          </span>
        )}
      </div>

      <div className={cn(OUTPUT_CLASS, state.running && "border-[var(--accent-primary)]/40")}>
        {state.text || (state.running ? "" : idleCaption)}
        {state.running && <span className="animate-pulse">▍</span>}
      </div>

      {state.error && (
        <p className="m-0 rounded-lg border border-solid border-[var(--status-error)]/30 bg-[var(--status-error)]/10 px-3 py-2 text-[12px] text-[var(--status-error)]">
          {state.error}
        </p>
      )}
      {state.stopped && !state.error && (
        <p className="m-0 text-[12px] text-[var(--text-tertiary)]">
          Stopped — showing partial output.
        </p>
      )}

      {(state.usage || state.modelUsed) && !state.running && (
        <div className="flex flex-wrap gap-3 text-[11px] text-[var(--text-tertiary)]">
          {state.modelUsed && (
            <span>
              model:{" "}
              <code className="font-mono text-[var(--text-secondary)]">
                {state.modelUsed}
              </code>
            </span>
          )}
          {state.usage?.prompt_tokens !== undefined && (
            <span>prompt tokens: {state.usage.prompt_tokens}</span>
          )}
          {state.usage?.completion_tokens !== undefined && (
            <span>completion tokens: {state.usage.completion_tokens}</span>
          )}
          {state.usage?.total_tokens !== undefined && (
            <span>total tokens: {state.usage.total_tokens}</span>
          )}
        </div>
      )}
    </div>
  );
}
