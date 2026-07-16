// @ts-nocheck

"use client";

import React, { useEffect, useState } from 'react';
import { CheckCircle } from '@phosphor-icons/react';
import type { Agent } from '@/lib/agents/agent.types';
import { EditAgentForm } from '@/views/agent-view/components/EditAgentForm';

export const SettingsTab = ({ agent }: { agent: Agent }) => {
  // There's no "close" destination for a persistent dashboard tab, so Cancel
  // means "discard my edits": bump the key to remount EditAgentForm fresh
  // from the current agent record. The same bump also runs after a
  // successful save, which is what we want too (reflect the saved values).
  const [resetKey, setResetKey] = useState(0);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!justSaved) return;
    const timer = setTimeout(() => setJustSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [justSaved]);

  return (
    <div className="relative h-full">
      {justSaved && (
        <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 shadow-lg">
          <CheckCircle size={16} weight="fill" />
          Settings saved
        </div>
      )}
      <EditAgentForm
        key={`${agent.id}-${resetKey}`}
        agent={agent}
        onSaved={() => setJustSaved(true)}
        onCancel={() => setResetKey((k) => k + 1)}
      />
    </div>
  );
};
