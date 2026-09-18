"use client";

/**
 * Team map — OpenMaus TeamMapPage over Allternit group chats.
 */

import React, { useMemo } from "react";
import { ArrowRight, Graph, Users } from "@phosphor-icons/react";
import { useAgentStore } from "@/lib/agents/agent.store";
import { getBots } from "@/lib/bots/bot-profile";
import { useGroupChatStore } from "@/lib/bots/group-chat.store";
import { buildTeamMapEdges, buildTeamMapNodes } from "@/lib/bots/bot-team-map";
import { BotAvatar } from "./BotAvatar";
import { TeamImportButton } from "@/components/bots/TeamImportButton";
import { cn } from "@/lib/utils";

export function BotTeamMap() {
  const agents = useAgentStore((s) => s.agents);
  const bots = useMemo(() => getBots(agents), [agents]);
  const groups = useGroupChatStore((s) => s.groups);
  const nodes = useMemo(() => buildTeamMapNodes(bots), [bots]);
  const edges = useMemo(() => buildTeamMapEdges(groups), [groups]);

  return (
    <div className="flex h-full min-h-[420px] flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[18px] font-semibold">
            <Graph size={18} />
            Team map
          </h2>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            Group chats are the edges. Chief of Staff bots sit first in the roster.
          </p>
        </div>
        <TeamImportButton />
      </div>
      <div className="flex flex-wrap gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
        {bots.map((bot) => {
          const node = nodes.find((row) => row.id === bot.id);
          return (
            <div
              key={bot.id}
              className={cn(
                "flex min-w-[140px] items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2",
                node?.chiefOfStaff && "ring-1 ring-[var(--accent-bot,#7aa2ff)]",
              )}
            >
              <BotAvatar bot={bot} size={28} />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{node?.name}</div>
                {node?.chiefOfStaff && (
                  <div className="text-[11px] text-[var(--accent-bot,#7aa2ff)]">Chief of Staff</div>
                )}
              </div>
            </div>
          );
        })}
        {bots.length === 0 && (
          <p className="text-[13px] text-[var(--text-secondary)]">No bots yet.</p>
        )}
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
          <Users size={14} />
          Connections
        </div>
        {edges.length === 0 && (
          <p className="text-[13px] text-[var(--text-secondary)]">
            Create a group chat to draw an edge between bots.
          </p>
        )}
        {edges.map((edge) => {
          const source = nodes.find((n) => n.id === edge.sourceBotId);
          const target = nodes.find((n) => n.id === edge.targetBotId);
          return (
            <div
              key={`${edge.groupId}:${edge.sourceBotId}:${edge.targetBotId}`}
              className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] px-3 py-2.5"
            >
              <span className="truncate text-[13px] font-medium">{source?.name ?? edge.sourceBotId}</span>
              <ArrowRight size={13} className="shrink-0 text-[var(--text-secondary)]" />
              <span className="truncate text-[13px] font-medium">{target?.name ?? edge.targetBotId}</span>
              <span className="ml-auto truncate text-[11.5px] text-[var(--text-secondary)]">{edge.groupName}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
