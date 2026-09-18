"use client";

import React from "react";
import { X } from "@phosphor-icons/react";
import { AgentAvatar } from "@/components/Avatar";
import type { Agent } from "@/lib/agents";
import { getBotDisplayName } from "@/lib/bots/bot-profile";
import { BotAvatar } from "@/views/bots/BotAvatar";

interface AgentPillProps {
  agent: Agent;
  onRemove: () => void;
}

export function AgentPill({ agent, onRemove }: AgentPillProps) {
  const avatarConfig =
    (agent.config?.avatar as Record<string, unknown>) || undefined;
  const isBot = agent.isBot === true;
  const name = getBotDisplayName(agent);

  return (
    <div
      title={isBot ? `Bot: ${name}` : `Agent: ${agent.name}`}
      aria-label={isBot ? `Bot: ${name}` : `Agent: ${agent.name}`}
      className="inline-flex shrink-0 select-none items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-transparent py-0.5 pl-0.5 pr-1.5 text-[12.5px] font-medium text-[var(--text-primary)]"
    >
      <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full">
        {isBot ? (
          <BotAvatar bot={agent} size={20} />
        ) : avatarConfig ? (
          <AgentAvatar
            config={avatarConfig as any}
            size={20}
            emotion="steady"
            isAnimating={false}
            showGlow={false}
          />
        ) : (
          <span className="flex size-5 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[10px] font-semibold text-[var(--text-secondary)]">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
      </span>
      <span className="max-w-[160px] truncate">
        {isBot ? `@${name}` : name}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="flex size-4 items-center justify-center rounded-full border-none bg-transparent p-0 text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
      >
        <X size={11} />
      </button>
    </div>
  );
}
