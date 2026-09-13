"use client";

import React from "react";
import { WaitingOnYouPill } from "@/components/bot-chat/WaitingOnYouPill";
import { cn } from "@/lib/utils";
import type { Agent } from "@/lib/agents/agent.types";
import { getBotDisplayName } from "@/lib/bots/bot-profile";
import { BotAvatar } from "@/views/bots/BotAvatar";

export interface BotsRosterSectionProps {
  bots: Agent[];
  pendingByBot?: Record<string, boolean>;
  onSelectBot: (botId: string) => void;
  className?: string;
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
          No bots yet — create one in Bot Hub
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {bots.map((bot) => {
            const accent = bot.botProfile?.accentColor ?? "var(--accent-primary)";
            const pending = Boolean(pendingByBot?.[bot.id]);
            return (
              <button
                key={bot.id}
                type="button"
                onClick={() => onSelectBot(bot.id)}
                className="flex min-h-[44px] items-center gap-3 rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--shell-rail-bg)] px-4 py-3 text-left cursor-pointer"
              >
                <BotAvatar bot={bot} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">
                    {getBotDisplayName(bot)}
                  </span>
                  {bot.botProfile?.tagline ? (
                    <span className="block truncate text-[12px] text-[var(--shell-item-muted)]">
                      {bot.botProfile.tagline}
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
