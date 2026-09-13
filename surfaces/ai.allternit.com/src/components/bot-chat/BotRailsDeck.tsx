"use client";

/**
 * BotRailsDeck — top deck strip above a bot chat session showing the user's
 * CommRails WIH work: dags with my active WIHs first; when none, the ready
 * queue as a secondary "Up next" section. Returns null until there is
 * actionable work (mirrors BotWatchStrip's null-until-populated pattern).
 *
 * @module BotRailsDeck
 */

import React, { useState } from "react";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useRailsAgentId, useRailsDags, useRailsNeedsYouCount } from "@/lib/rails/use-rails-dags";
import RailsTaskList from "@/components/rails/RailsTaskList";

export function BotRailsDeck() {
  const agentId = useRailsAgentId();
  const mine = useRailsDags("mine");
  const ready = useRailsDags("ready");
  const blocked = useRailsNeedsYouCount();
  const [open, setOpen] = useState(true);

  const mineCount = mine.data?.dags.length ?? 0;
  const readyDags = ready.data?.dags ?? [];
  const readyCount = readyDags.reduce((sum, d) => sum + d.ready_count, 0);

  // Nothing actionable — stay out of the way.
  if (mineCount === 0 && readyDags.length === 0) return null;

  return (
    <div
      data-testid="bot-rails-deck"
      className="flex shrink-0 flex-col gap-1 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2 animate-deck-rise"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-w-0 items-center gap-1.5 text-left"
        aria-expanded={open}
      >
        {open ? (
          <CaretDown size={12} className="shrink-0 text-[var(--text-tertiary)]" />
        ) : (
          <CaretRight size={12} className="shrink-0 text-[var(--text-tertiary)]" />
        )}
        <span className="text-[11px] font-medium text-[var(--text-secondary)]">Rails work</span>
        <span className="text-[10px] text-[var(--text-tertiary)]">{readyCount} ready</span>
        {blocked > 0 && (
          <span
            title="agents waiting — see Needs you in the rail"
            className="shrink-0 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--status-warning)]"
          >
            {blocked} blocked
          </span>
        )}
      </button>
      {open && (
        <div className="min-w-0">
          {mineCount > 0 && <RailsTaskList view="mine" agentId={agentId} compact />}
          {mineCount === 0 && readyDags.length > 0 && (
            <div className="min-w-0">
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                Up next
              </p>
              <RailsTaskList view="ready" agentId={agentId} compact maxDags={1} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default BotRailsDeck;
