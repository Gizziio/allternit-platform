"use client";

import React, { useMemo } from 'react';
import { useAgentStore } from '@/lib/agents/agent.store';
import type { Agent } from '@/lib/agents/agent.types';
import { getBotDisplayName, isBot } from '@/lib/bots/bot-profile';
import { RoutinesListView } from '@/views/automation/RoutinesListView';

interface BotRoutinesPanelProps {
  botId: string;
}

export function BotRoutinesPanel({ botId }: BotRoutinesPanelProps) {
  const { agents } = useAgentStore();
  const bot = useMemo(() => agents.find((a) => a.id === botId) as Agent | undefined, [agents, botId]);

  if (!bot || !isBot(bot)) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--text-secondary)]">
        <p>Bot not found.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden border-l border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
      <RoutinesListView
        agentId={botId}
        title={`${getBotDisplayName(bot)} Automation Tasks`}
        hideAgentSelector
      />
    </div>
  );
}
