"use client";

/**
 * Calendar skin over Allternit `useBotRoutineStore` (OpenMaus RoutineCalendarPage).
 * Routines stay Allternit-scheduled. Dedicated results threads reuse createBotThread.
 */

import React, { useMemo, useState } from "react";
import { CalendarBlank, Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  createBotRoutine,
  useBotRoutineStore,
  type BotRoutine,
  type BotRoutineFrequency,
} from "@/lib/bots/bot-routine.service";
import { createBotThread } from "@/lib/bots/bot-threads";
import { getBotDisplayName } from "@/lib/bots/bot-profile";
import type { Agent } from "@/lib/agents/agent.types";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8);

function hourOf(ts: number): number {
  return new Date(ts).getHours();
}

export function BotRoutineCalendar({ bot }: { bot: Agent }) {
  const routines = useBotRoutineStore((s) => s.getRoutinesForBot(bot.id));
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState<BotRoutineFrequency>("daily");
  const [dedicated, setDedicated] = useState(true);
  const [saving, setSaving] = useState(false);

  const byHour = useMemo(() => {
    const map = new Map<number, BotRoutine[]>();
    for (const routine of routines) {
      const hour = hourOf(routine.nextRunAt);
      const list = map.get(hour) ?? [];
      list.push(routine);
      map.set(hour, list);
    }
    return map;
  }, [routines]);

  return (
    <div className="grid min-h-[480px] grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)]">
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-3 text-[13px] font-semibold">
          <CalendarBlank size={16} />
          {getBotDisplayName(bot)} calendar
        </div>
        <div className="max-h-[640px] overflow-y-auto">
          {HOURS.map((hour) => {
            const items = byHour.get(hour) ?? [];
            return (
              <div
                key={hour}
                className="relative flex min-h-16 border-b border-[var(--border-subtle)]/60"
              >
                <div className="w-16 shrink-0 px-3 py-2 text-[11px] text-[var(--text-muted)]">
                  {hour > 12 ? `${hour - 12} PM` : hour === 12 ? "12 PM" : `${hour} AM`}
                </div>
                <div className="flex flex-1 flex-wrap items-start gap-2 py-2 pr-3">
                  {items.map((routine) => (
                    <span
                      key={routine.id}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[12px]",
                        routine.enabled
                          ? "bg-[var(--accent-primary)]/20 text-[var(--text-primary)]"
                          : "bg-[var(--surface-hover)] text-[var(--text-secondary)]",
                      )}
                    >
                      {routine.title}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <form
        className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!title.trim() || !prompt.trim() || saving) return;
          setSaving(true);
          try {
            let resultsSessionId: string | undefined;
            if (dedicated) {
              resultsSessionId = await createBotThread(bot.id, getBotDisplayName(bot));
            }
            createBotRoutine({
              botId: bot.id,
              botName: getBotDisplayName(bot),
              title: title.trim(),
              instruction: prompt.trim(),
              frequency,
              simple: true,
              ...(resultsSessionId ? { scheduleText: `results:${resultsSessionId}` } : {}),
            });
            setTitle("");
            setPrompt("");
          } finally {
            setSaving(false);
          }
        }}
      >
        <label className="block text-[12px] text-[var(--text-secondary)]">
          Name
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none"
          />
        </label>
        <label className="mt-3 block text-[12px] text-[var(--text-secondary)]">
          What should the bot do?
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none"
          />
        </label>
        <label className="mt-3 block text-[12px] text-[var(--text-secondary)]">
          Repeat
          <select
            value={frequency}
            onChange={(event) => setFrequency(event.target.value as BotRoutineFrequency)}
            className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-[13px]"
          >
            <option value="daily">Daily</option>
            <option value="weekdays">Weekdays</option>
            <option value="weekly">Weekly</option>
            <option value="hourly">Hourly</option>
          </select>
        </label>
        <div className="mt-4">
          <p className="text-[12px] font-medium text-[var(--text-primary)]">Post results to</p>
          <button
            type="button"
            aria-pressed={dedicated}
            onClick={() => setDedicated(true)}
            className={cn(
              "mt-2 w-full rounded-xl border px-3 py-2 text-left text-[13px]",
              dedicated
                ? "border-[var(--accent-primary)]/50 bg-[var(--surface-hover)]"
                : "border-[var(--border-subtle)]",
            )}
          >
            Create a dedicated results thread
          </button>
          <button
            type="button"
            aria-pressed={!dedicated}
            onClick={() => setDedicated(false)}
            className={cn(
              "mt-2 w-full rounded-xl border px-3 py-2 text-left text-[13px]",
              !dedicated
                ? "border-[var(--accent-primary)]/50 bg-[var(--surface-hover)]"
                : "border-[var(--border-subtle)]",
            )}
          >
            Canonical bot chat
          </button>
          <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--text-secondary)]">
            Each run starts with fresh context. Dated results collect here; the
            dedicated thread is reused and can be moved into a folder.
          </p>
        </div>
        <button
          type="submit"
          disabled={!title.trim() || !prompt.trim() || saving}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3 py-2 text-[13px] font-medium text-[var(--ui-text-inverse,#fff)] disabled:opacity-40"
        >
          <Plus size={14} />
          Save routine
        </button>
      </form>
    </div>
  );
}
