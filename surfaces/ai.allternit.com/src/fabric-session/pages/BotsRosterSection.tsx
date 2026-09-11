"use client";

import React from "react";
import { WaitingOnYouPill } from "@/components/bot-chat/WaitingOnYouPill";
import { cn } from "@/lib/utils";
import type { UnifiedRosterBot } from "@/lib/bots/use-unified-roster";

export interface BotsRosterSectionProps {
  bots: UnifiedRosterBot[];
  pendingByBot?: Record<string, boolean>;
  onSelectBot: (botId: string) => void;
  className?: string;
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function BotsRosterSection({
  bots,
  pendingByBot,
  onSelectBot,
  className,
}: BotsRosterSectionProps) {
  return (
    <section className={cn("mb-8", className)} data-bots-section>
      <h2 className="text-[15px] font-semibold m-0 mb-3">Bots</h2>
      {bots.length === 0 ? (
        <p className="text-[13px] text-[var(--text-secondary)] m-0">
          No bots on this account yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {bots.map((bot) => {
            const accent = bot.accentColor ?? "var(--accent-primary)";
            const pending = Boolean(pendingByBot?.[bot.id]);
            return (
              <button
                key={bot.id}
                type="button"
                onClick={() => onSelectBot(bot.id)}
                className="flex min-h-[44px] items-center gap-3 rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--shell-rail-bg)] px-4 py-3 text-left cursor-pointer"
              >
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${accent} 20%, transparent)`,
                    color: accent,
                  }}
                  aria-hidden="true"
                >
                  {initials(bot.displayName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">
                    {bot.displayName}
                  </span>
                  {bot.tagline ? (
                    <span className="block truncate text-[12px] text-[var(--shell-item-muted)]">
                      {bot.tagline}
                    </span>
                  ) : null}
                </span>
                {pending ? <WaitingOnYouPill accentColor={accent} /> : null}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
