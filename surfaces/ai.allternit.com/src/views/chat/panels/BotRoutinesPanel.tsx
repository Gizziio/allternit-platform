"use client";

import React, { useMemo, useState } from 'react';
import { Clock, Link } from '@phosphor-icons/react';
import { useAgentStore } from '@/lib/agents/agent.store';
import type { Agent } from '@/lib/agents/agent.types';
import { getBotDisplayName, isBot } from '@/lib/bots/bot-profile';
import { RoutinesListView } from '@/views/automation/RoutinesListView';
import { WebhookTriggersView } from '@/views/automation/WebhookTriggersView';
import { BotWebhookReceiverCard } from '@/components/bots/BotWebhookReceiverCard';
import { cn } from '@/lib/utils';

interface BotRoutinesPanelProps {
  botId: string;
}

type Tab = 'routines' | 'webhooks';

export function BotRoutinesPanel({ botId }: BotRoutinesPanelProps) {
  const { agents } = useAgentStore();
  const bot = useMemo(() => agents.find((a) => a.id === botId) as Agent | undefined, [agents, botId]);
  const [activeTab, setActiveTab] = useState<Tab>('routines');
  const [receiverPort, setReceiverPort] = useState(8080);

  if (!bot || !isBot(bot)) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--text-secondary)]">
        <p>Bot not found.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden border-l border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
      <div className="flex items-center gap-1 p-2 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
        <button
          type="button"
          onClick={() => setActiveTab('routines')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors',
            activeTab === 'routines'
              ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
          )}
        >
          <Clock size={14} />
          Routines
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('webhooks')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors',
            activeTab === 'webhooks'
              ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
          )}
        >
          <Link size={14} />
          Webhooks
        </button>
      </div>

      {activeTab === 'routines' && (
        <RoutinesListView
          agentId={botId}
          title={`${getBotDisplayName(bot)} Automation Tasks`}
          hideAgentSelector
        />
      )}

      {activeTab === 'webhooks' && (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-[var(--border-subtle)]">
            <BotWebhookReceiverCard
              receiverPort={receiverPort}
              onReceiverPortChange={setReceiverPort}
            />
          </div>
          <div className="flex-1 overflow-hidden">
            <WebhookTriggersView
              agentId={botId}
              title={`${getBotDisplayName(bot)} Webhook Triggers`}
              hideAgentSelector
              receiverPort={receiverPort}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default BotRoutinesPanel;
