"use client";

import React, { useMemo, useState } from 'react';
import { MagnifyingGlass, Robot, Spinner } from '@phosphor-icons/react';
import { BOT_TEMPLATES } from '@/lib/bots/bots.manifest';
import { useBotSession } from '@/lib/bots/useBotSession';
import { cn } from '@/lib/utils';

export function AgentHubBotsTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const { startSession, isStarting } = useBotSession();

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return BOT_TEMPLATES;
    return BOT_TEMPLATES.filter((template) => {
      const agent = template.create();
      return (
        agent.name.toLowerCase().includes(q) ||
        agent.description.toLowerCase().includes(q) ||
        agent.tags?.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [searchQuery]);

  return (
    <div className="h-full w-full overflow-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-8 pb-12 pt-6">
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex h-11 flex-1 items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 transition-colors focus-within:border-[var(--accent-primary)]">
            <MagnifyingGlass size={16} className="shrink-0 text-[var(--text-tertiary)]" />
            <input
              aria-label="Search packaged bots"
              type="text"
              placeholder="Search bots by name, description, or tag…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 border-none bg-transparent text-[15px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
            />
          </div>
        </div>

        <div className="mt-8">
          {filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
              <Robot size={48} className="text-[var(--text-tertiary)] opacity-40" />
              <h3 className="text-sm font-normal text-[var(--text-secondary)]">No bots found.</h3>
              <p className="max-w-xs text-[13px] text-[var(--text-tertiary)]">
                Try adjusting your search.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredTemplates.map((template) => {
                const agent = template.create();
                const BotIcon = template.icon;
                const accentColor = agent.botProfile?.accentColor;
                return (
                  <div
                    key={template.id}
                    className="group flex min-h-[180px] flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 transition-all duration-200 hover:border-[var(--border-hover)] hover:shadow-md"
                  >
                    <div className="flex w-full items-start justify-between gap-3">
                      <div className="flex size-11 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[var(--text-primary)]">
                        <BotIcon size={20} color={accentColor} />
                      </div>
                    </div>
                    <div className="mt-4 min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-[var(--text-primary)]">
                        {agent.botProfile?.displayName ?? agent.name}
                      </span>
                      <span className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                        {agent.description}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {agent.tags?.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={isStarting}
                      onClick={() => {
                        const botAgent = template.create();
                        startSession(botAgent);
                      }}
                      className={cn(
                        'mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium text-[var(--bg-elevated)] transition-opacity',
                        isStarting
                          ? 'cursor-not-allowed opacity-70'
                          : 'hover:opacity-90'
                      )}
                      style={{ backgroundColor: accentColor ?? 'var(--accent-primary)' }}
                    >
                      {isStarting ? (
                        <>
                          <Spinner size={16} className="animate-spin" />
                          Starting…
                        </>
                      ) : (
                        'Start Session'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
