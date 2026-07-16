// @ts-nocheck

"use client";

import React from 'react';
import type { Agent } from '@/lib/agents/agent.types';
import { Badge } from '@/components/ui/badge';

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="text-sm font-semibold text-studio-text-primary">{title}</div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-studio-border-subtle bg-studio-card/50 p-4 text-sm text-studio-text-secondary">
          None configured.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <Badge key={item} variant="outline">{item}</Badge>
          ))}
        </div>
      )}
    </section>
  );
}

export const ToolsTab = ({ agent }: { agent: Agent }) => {
  return (
    <div className="h-full p-5">
      <div className="flex flex-col gap-5">
        <Section title="Tools" items={agent.tools || []} />
        <Section title="Allowed Tools" items={agent.allowedTools || []} />
        <Section title="Allowed Skills" items={agent.allowedSkills || []} />
        <Section title="Capabilities" items={agent.capabilities || []} />
      </div>
    </div>
  );
};
