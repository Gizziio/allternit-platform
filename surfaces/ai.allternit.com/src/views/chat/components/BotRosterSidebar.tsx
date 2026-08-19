"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CaretLeft,
  CaretRight,
  ChatTeardropText,
  Copy,
  House,
  PencilSimple,
  Play,
  Robot,
} from '@phosphor-icons/react';
import { useAgentStore } from '@/lib/agents/agent.store';
import type { Agent } from '@/lib/agents/agent.types';
import {
  agentToCreateAgentInput,
  getBotAccentColor,
  getBotDisplayName,
  getBotTagline,
  isBot,
} from '@/lib/bots/bot-profile';
import { useBotSession } from '@/lib/bots/useBotSession';
import { useStackProviders } from '@/lib/bots/use-stack-providers';
import { getProviderLabel } from '@/lib/bots/bot-profile';
import { cn } from '@/lib/utils';

const SIDEBAR_COLLAPSED_KEY = 'allternit:bot-roster-collapsed';

function botInitials(name: string): string {
  return (name || 'Bot')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

interface BotRosterSidebarProps {
  className?: string;
}

export function BotRosterSidebar({ className }: BotRosterSidebarProps) {
  const { agents, setDraftAgent, setIsCreating, setIsEditing } = useAgentStore();
  const { stackedAgents } = useStackProviders();
  const { startSession, isStarting } = useBotSession();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [activeBotId, setActiveBotId] = useState<string | null>(null);

  const bots = useMemo(() => {
    const native = agents.filter(isBot);
    const stacked = stackedAgents.map((s) => s.agent);
    return [...native, ...stacked];
  }, [agents, stackedAgents]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {
      // storage unavailable
    }
  }, [collapsed]);

  const handleStartSession = useCallback(
    async (bot: Agent) => {
      setActiveBotId(bot.id);
      await startSession(bot);
      setActiveBotId(null);
    },
    [startSession]
  );

  const handleOpenBotHome = useCallback((bot: Agent) => {
    window.dispatchEvent(
      new CustomEvent('allternit:open-view', {
        detail: { viewType: 'bot-home', context: { botId: bot.id } },
      })
    );
  }, []);

  const handleOpenInbox = useCallback(
    (bot: Agent) => {
      window.dispatchEvent(
        new CustomEvent('allternit:open-view', {
          detail: { viewType: 'bot-inbox', context: { botId: bot.id } },
        })
      );
    },
    []
  );

  const handleEdit = useCallback(
    (bot: Agent) => {
      setIsEditing(bot.id);
      window.dispatchEvent(
        new CustomEvent('allternit:open-view', {
          detail: { viewType: 'agent-hub' },
        })
      );
    },
    [setIsEditing]
  );

  const handleDuplicate = useCallback(
    (bot: Agent) => {
      const duplicate = agentToCreateAgentInput(bot);
      duplicate.name = `${duplicate.name ?? bot.name} (Copy)`;
      duplicate.botProfile = {
        ...(duplicate.botProfile ?? bot.botProfile ?? {}),
        displayName: bot.botProfile
          ? `${bot.botProfile.displayName} (Copy)`
          : `${bot.name} (Copy)`,
        handle: undefined,
        lifecycle: 'draft',
      };
      setDraftAgent(duplicate);
      setIsCreating(true);
      window.dispatchEvent(
        new CustomEvent('allternit:open-view', { detail: { viewType: 'agent-hub' } }),
      );
    },
    [setDraftAgent, setIsCreating]
  );

  if (bots.length === 0) {
    return (
      <div
        className={cn(
          'hidden h-full flex-col items-center justify-center gap-3 border-l border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 md:flex',
          className
        )}
      >
        <Robot size={28} className="text-[var(--text-tertiary)] opacity-50" />
        <p className="text-center text-[11px] text-[var(--text-tertiary)]">
          No bots yet.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-full flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-elevated)] transition-[width] duration-200',
        collapsed ? 'w-14' : 'w-64',
        className
      )}
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-3">
        {!collapsed && (
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">
            Bots
          </span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-md p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]"
          aria-label={collapsed ? 'Expand bot roster' : 'Collapse bot roster'}
        >
          {collapsed ? <CaretLeft size={16} /> : <CaretRight size={16} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {bots.map((bot) => {
          const displayName = getBotDisplayName(bot);
          const accentColor = getBotAccentColor(bot) ?? 'var(--accent-primary)';
          const tagline = getBotTagline(bot);
          const isActive = activeBotId === bot.id;

          return (
            <div
              key={bot.id}
              className={cn(
                'group relative mx-2 mb-1 rounded-lg transition-colors',
                collapsed ? 'px-1 py-2' : 'px-2 py-2',
                isActive && 'bg-[var(--accent-primary)]/10'
              )}
            >
              <button
                type="button"
                disabled={isStarting && isActive}
                onClick={() => handleOpenBotHome(bot)}
                className={cn(
                  'flex w-full items-center gap-2.5 text-left',
                  collapsed && 'justify-center'
                )}
                title={displayName}
              >
                <div
                  className="flex shrink-0 items-center justify-center rounded-lg text-[11px] font-bold"
                  style={{
                    width: 32,
                    height: 32,
                    background: `color-mix(in srgb, ${accentColor} 20%, transparent)`,
                    color: accentColor,
                    border: `1.5px solid ${accentColor}40`,
                  }}
                >
                  {botInitials(displayName)}
                </div>
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <div className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                        {displayName}
                      </div>
                      {bot.botProfile?.providerId && (
                        <span
                          className="shrink-0 rounded px-1 py-0 text-[9px] font-semibold uppercase tracking-wide"
                          style={{
                            backgroundColor: `${bot.botProfile.accentColor ?? 'var(--accent-primary)'}20`,
                            color: bot.botProfile.accentColor ?? 'var(--accent-primary)',
                          }}
                        >
                          {getProviderLabel(bot.botProfile.providerId)}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[11px] text-[var(--text-tertiary)]">
                      {isActive ? 'Starting…' : tagline || `@${bot.name}`}
                    </div>
                  </div>
                )}
              </button>

              {!collapsed && (
                <div className="absolute right-1 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md bg-[var(--bg-elevated)] p-0.5 group-hover:flex">
                  <BotActionButton
                    icon={House}
                    label="Open bot home"
                    onClick={() => handleOpenBotHome(bot)}
                  />
                  <BotActionButton
                    icon={Play}
                    label="Start session"
                    onClick={() => handleStartSession(bot)}
                    disabled={isStarting}
                  />
                  <BotActionButton
                    icon={ChatTeardropText}
                    label="Open conversation"
                    onClick={() => handleOpenInbox(bot)}
                  />
                  <BotActionButton
                    icon={PencilSimple}
                    label="Edit"
                    onClick={() => handleEdit(bot)}
                  />
                  <BotActionButton
                    icon={Copy}
                    label="Duplicate"
                    onClick={() => handleDuplicate(bot)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}

function BotActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="rounded p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
      title={label}
    >
      <Icon size={14} />
    </button>
  );
}
