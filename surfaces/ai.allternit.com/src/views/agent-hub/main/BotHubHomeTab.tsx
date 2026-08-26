"use client";

import React, { useMemo, useState } from "react";
import { MagnifyingGlass, Plus, Robot, Users } from "@phosphor-icons/react";
import { useAgentStore } from "@/lib/agents/agent.store";
import { useChatSessionStore } from "@/views/chat/ChatSessionStore";
import { getBots, BOT_CATEGORIES } from "@/lib/bots/bot-profile";
import type { BotCategory, Agent } from "@/lib/agents/agent.types";
import { BotHubCard } from "./BotHubCard";
import { BotGroupChatModal } from "./BotGroupChatModal";
import { startBotGroupChat } from "@/lib/bots/startBotGroupChat";
import { cn } from "@/lib/utils";

interface BotHubHomeTabProps {
  onCreate?: () => void;
}

export function BotHubHomeTab({ onCreate }: BotHubHomeTabProps) {
  const { agents, isLoadingAgents } = useAgentStore();
  const chatSessions = useChatSessionStore((s) => s.sessions ?? []);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<BotCategory | "all">("all");
  const [groupChatOpen, setGroupChatOpen] = useState(false);

  const bots = useMemo(() => getBots(agents), [agents]);

  const sessionCountByBotId = useMemo(() => {
    const map = new Map<string, number>();
    for (const session of chatSessions) {
      if (session.metadata?.sessionMode !== "agent") continue;
      if (session.metadata?.isGroupChat === true) continue;
      const id = (session.metadata?.agentId as string | undefined) ?? (session.metadata?.agentName as string | undefined) ?? "unknown";
      map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  }, [chatSessions]);

  const filteredBots = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return bots.filter((bot) => {
      if (categoryFilter !== "all" && bot.botProfile.botCategory !== categoryFilter) return false;
      if (!q) return true;
      const displayName = bot.botProfile.displayName.toLowerCase();
      const name = bot.name.toLowerCase();
      const tagline = (bot.botProfile.tagline || "").toLowerCase();
      const description = bot.description.toLowerCase();
      return (
        displayName.includes(q) ||
        name.includes(q) ||
        tagline.includes(q) ||
        description.includes(q)
      );
    });
  }, [bots, categoryFilter, searchQuery]);

  const handleOpenBot = (botId: string) => {
    window.dispatchEvent(
      new CustomEvent("allternit:open-view", {
        detail: { viewType: "bot-home", context: { botId } },
      })
    );
  };

  const handleStartGroupChat = async (selectedBots: Agent[], name: string) => {
    const result = await startBotGroupChat({ bots: selectedBots, name });
    if (result?.sessionId) {
      window.dispatchEvent(
        new CustomEvent("allternit:open-view", {
          detail: {
            viewType: "chat-group-session",
            context: { sessionId: result.sessionId },
          },
        })
      );
    }
  };

  return (
    <div className="h-full w-full overflow-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-8 pb-12 pt-6">
        <div className="mb-8 flex flex-col gap-5">
          <div>
            <h2 className="text-xl font-medium text-[var(--text-primary)]">Your bots</h2>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              Discover, launch, and manage your packaged bots.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex h-11 flex-1 items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 transition-colors focus-within:border-[var(--accent-primary)]">
              <MagnifyingGlass size={16} className="text-[var(--text-tertiary)] shrink-0" />
              <input
                aria-label="Search bots"
                type="text"
                placeholder="Search bots…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 border-none bg-transparent text-[15px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
              />
            </div>
            <button
              type="button"
              onClick={() => setGroupChatOpen(true)}
              className="hidden h-11 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-transparent px-4 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] sm:inline-flex"
            >
              <Users size={16} />
              New group chat
            </button>
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-4 text-[13px] font-medium text-[var(--bg-elevated)] transition-opacity hover:opacity-90"
            >
              <Plus size={16} />
              Create bot
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterChip
              label="All"
              active={categoryFilter === "all"}
              onClick={() => setCategoryFilter("all")}
            />
            {(Object.keys(BOT_CATEGORIES) as BotCategory[]).map((category) => (
              <FilterChip
                key={category}
                label={BOT_CATEGORIES[category].label}
                active={categoryFilter === category}
                onClick={() => setCategoryFilter(category)}
              />
            ))}
          </div>
        </div>

        {isLoadingAgents ? (
          <div className="flex h-64 items-center justify-center">
            <div className="size-8 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
          </div>
        ) : bots.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <Robot size={48} className="text-[var(--text-tertiary)] opacity-40" />
            <h3 className="text-sm font-normal text-[var(--text-secondary)]">No bots yet.</h3>
            <p className="max-w-xs text-[13px] text-[var(--text-tertiary)]">
              Create your first bot to get started.
            </p>
            <button
              type="button"
              onClick={onCreate}
              className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-4 text-[13px] font-medium text-[var(--bg-elevated)] transition-opacity hover:opacity-90"
            >
              <Plus size={16} />
              Create bot
            </button>
          </div>
        ) : filteredBots.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <Robot size={48} className="text-[var(--text-tertiary)] opacity-40" />
            <h3 className="text-sm font-normal text-[var(--text-secondary)]">No bots match.</h3>
            <p className="max-w-xs text-[13px] text-[var(--text-tertiary)]">
              Try a different search or category filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredBots.map((bot, index) => (
              <BotHubCard
                key={bot.id}
                bot={bot}
                sessionCount={sessionCountByBotId.get(bot.id) ?? 0}
                onClick={() => handleOpenBot(bot.id)}
                index={index}
              />
            ))}
          </div>
        )}
      </div>

      <BotGroupChatModal
        isOpen={groupChatOpen}
        bots={bots}
        onClose={() => setGroupChatOpen(false)}
        onStart={handleStartGroupChat}
      />
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 rounded-lg px-3 text-xs font-medium capitalize transition-colors",
        active
          ? "bg-[var(--text-primary)] text-[var(--bg-elevated)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
      )}
    >
      {label}
    </button>
  );
}
