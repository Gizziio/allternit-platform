// @ts-nocheck

"use client";

import React, { useEffect } from 'react';
import { useIsClient } from '@/lib/hooks/use-is-client';
import { useAgentStore } from '@/lib/agents/agent.store';
import type { Agent } from '@/lib/agents/agent.types';

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-studio-border-subtle bg-studio-card/50 p-4 text-sm text-studio-text-secondary">
      {children}
    </div>
  );
}

export const CommsTab = ({ agent }: { agent: Agent }) => {
  const { mail, fetchMail } = useAgentStore();
  const isClient = useIsClient();
  const agentMail = mail[agent.id] || [];

  useEffect(() => {
    fetchMail(agent.id);
  }, [agent.id, fetchMail]);

  return (
    <div className="h-full p-5">
      <div className="flex flex-col gap-2.5">
        {agentMail.length === 0 ? (
          <EmptyMessage>No messages yet.</EmptyMessage>
        ) : (
          agentMail.map((message) => (
            <div
              key={message.id}
              className="rounded-lg border border-studio-border-subtle bg-studio-card p-3.5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-studio-text-primary">
                  {message.fromAgentName || message.fromAgentId}
                </span>
                <div className="flex items-center gap-2">
                  {message.status === 'unread' && (
                    <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-300">
                      Unread
                    </span>
                  )}
                  <span className="text-xs text-studio-text-muted">
                    {isClient ? new Date(message.timestamp).toLocaleString() : ''}
                  </span>
                </div>
              </div>
              <div className="mt-1 text-xs text-studio-text-secondary">{message.body}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
