"use client";

import React from "react";
import { Robot, ArrowSquareOut, Info } from "@phosphor-icons/react";

const CONSOLE_AGENT_NEW_URL = "https://platform.allternit.com/agents/new";

/**
 * Agent Studio has moved. The real create/edit agent flow now lives in the
 * platform console (`surfaces/platform.allternit.com`, Phase 3 of the console
 * port), backed by the production agents API instead of this surface's
 * local-only studio. This view is a thin notice so the shell's view registry
 * entry (`agent-studio`) keeps resolving.
 */
export function AgentStudioView() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--surface-canvas)] p-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
          <Robot size={24} weight="fill" />
        </div>
        <h1 className="mt-4 text-[16px] font-bold text-[var(--ui-text-primary)]">
          Agent Studio has moved
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--ui-text-secondary)]">
          Creating and editing managed agents now lives in the platform console —
          same agents API, with the full toolset, skills, and subagent surface.
        </p>
        <a
          href={CONSOLE_AGENT_NEW_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-2 rounded-lg border-none bg-[var(--accent-primary)] px-4 py-2 text-[13px] font-bold text-[var(--surface-canvas)] transition-opacity hover:opacity-90"
        >
          Open the platform console
          <ArrowSquareOut size={14} weight="bold" />
        </a>
        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-[var(--ui-text-muted)]">
          <Info size={12} />
          {CONSOLE_AGENT_NEW_URL}
        </p>
      </div>
    </div>
  );
}

export default AgentStudioView;
