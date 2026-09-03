"use client";

import React, { useMemo, useState } from "react";
import { ChatTeardropText, MagnifyingGlass, Robot } from "@phosphor-icons/react";
import { useAgentStore } from "@/lib/agents/agent.store";
import { useChatSessionStore } from "@/views/chat/ChatSessionStore";
import type { ModeSession } from "@/lib/agents/mode-session-store";
import { getBotDisplayName, getBotTagline, getBotAccentColor } from "@/lib/bots/bot-profile";
import { BotAvatar, botInitials } from "@/views/bots/BotAvatar";
import { cn } from "@/lib/utils";

interface BotHubSessionsTabProps {
  onSessionStarted?: (sessionId: string, botId: string) => void;
}

interface BotSessionGroup {
  botId: string;
  botName: string;
  displayName: string;
  tagline?: string;
  accentColor?: string;
  isUnknown: boolean;
  sessions: ModeSession[];
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  return mo === 1 ? "1 month ago" : `${mo} months ago`;
}

function BotAvatarPlaceholder({ group }: { group: BotSessionGroup }) {
  const { agents } = useAgentStore();
  const agent = agents.find((a) => a.id === group.botId);
  if (agent) {
    return <BotAvatar bot={agent} size={44} />;
  }
  const accentColor = group.accentColor ?? "var(--accent-primary)";
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl text-[16px] font-bold"
      style={{
        width: 44,
        height: 44,
        background: `color-mix(in srgb, ${accentColor} 18%, transparent)`,
        color: accentColor,
        border: `2px solid ${accentColor}35`,
      }}
    >
      {botInitials(group.displayName)}
    </div>
  );
}

export function BotHubSessionsTab({ onSessionStarted }: BotHubSessionsTabProps) {
  const { agents } = useAgentStore();
  const chatSessions = useChatSessionStore((s) => s.sessions ?? []);
  const setActiveChatSession = useChatSessionStore((s) => s.setActiveSession);
  const [searchQuery, setSearchQuery] = useState("");

  const groups = useMemo<BotSessionGroup[]>(() => {
    const agentMap = new Map(agents.map((a) => [a.id, a]));
    const byBotId = new Map<string, ModeSession[]>();

    for (const session of chatSessions) {
      if (session.metadata?.sessionMode !== "agent") continue;
      if (session.metadata?.isGroupChat === true) continue;
      const botId = (session.metadata?.agentId as string | undefined) ?? "unknown";
      const list = byBotId.get(botId) ?? [];
      list.push(session);
      byBotId.set(botId, list);
    }

    const result: BotSessionGroup[] = [];
    for (const [botId, sessions] of byBotId.entries()) {
      sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      const agent = agentMap.get(botId);
      const displayName = agent ? getBotDisplayName(agent) : (sessions[0]?.metadata?.agentName as string) || "Unknown bot";
      const tagline = agent ? getBotTagline(agent) : undefined;
      const accentColor = agent ? getBotAccentColor(agent) : undefined;
      result.push({
        botId,
        botName: agent?.name || (sessions[0]?.metadata?.agentName as string) || "Unknown bot",
        displayName,
        tagline,
        accentColor,
        isUnknown: !agent,
        sessions,
      });
    }

    result.sort((a, b) => {
      const aTime = new Date(a.sessions[0]?.updatedAt || 0).getTime();
      const bTime = new Date(b.sessions[0]?.updatedAt || 0).getTime();
      return bTime - aTime;
    });

    return result;
  }, [agents, chatSessions]);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => {
      if (g.displayName.toLowerCase().includes(q)) return true;
      if (g.tagline?.toLowerCase().includes(q)) return true;
      return g.sessions.some((s) => (s.name || "").toLowerCase().includes(q));
    });
  }, [groups, searchQuery]);

  const openBotHome = (botId: string) => {
    window.dispatchEvent(
      new CustomEvent("allternit:open-view", {
        detail: { viewType: "bot-home", context: { botId } },
      })
    );
  };

  const openSession = (session: ModeSession, botId: string) => {
    setActiveChatSession(session.id);
    onSessionStarted?.(session.id);
    const isGroupChat = session.metadata?.isGroupChat === true;
    window.dispatchEvent(
      new CustomEvent("allternit:open-view", {
        detail: {
          viewType: isGroupChat ? "chat-group-session" : "cowork-agent-session",
          context: { sessionId: session.id, originView: "chat" },
        },
      })
    );
  };

  return (
    <div className="h-full w-full overflow-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-8 pb-12 pt-6">
        <div className="mb-6 flex flex-col gap-5">
          <div>
            <h2 className="text-xl font-medium text-[var(--text-primary)]">Sessions</h2>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              Recent bot conversations, grouped by bot.
            </p>
          </div>

          <div className="flex h-11 items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 transition-colors focus-within:border-[var(--accent-primary)]">
            <MagnifyingGlass size={16} className="text-[var(--text-tertiary)] shrink-0" />
            <input
              aria-label="Search bot sessions"
              type="text"
              placeholder="Search bot sessions…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 border-none bg-transparent text-[15px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
            />
          </div>
        </div>

        {filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <Robot size={48} className="text-[var(--text-tertiary)] opacity-40" />
            <h3 className="text-sm font-normal text-[var(--text-secondary)]">No bot sessions.</h3>
            <p className="max-w-xs text-[13px] text-[var(--text-tertiary)]">
              {searchQuery
                ? "Try adjusting your search."
                : "Start chatting with a bot to see sessions here."}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredGroups.map((group) => (
              <div key={group.botId} className="space-y-3">
                <BotGroupHeader
                  group={group}
                  onOpenBot={() => openBotHome(group.botId)}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.sessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => openSession(session, group.botId)}
                      className="flex flex-col gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 text-left transition-all hover:border-[var(--border-hover)] hover:shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <ChatTeardropText size={14} className="text-[var(--text-tertiary)]" />
                        <span className="truncate text-[14px] font-medium text-[var(--text-primary)]">
                          {session.name || "Untitled session"}
                        </span>
                      </div>
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {relativeTime(session.updatedAt)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BotGroupHeader({
  group,
  onOpenBot,
}: {
  group: BotSessionGroup;
  onOpenBot: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpenBot}
      className="group flex w-full items-center justify-between gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 text-left transition-all hover:border-[var(--border-hover)] hover:shadow-sm"
    >
      <div className="flex items-center gap-3 min-w-0">
        <BotAvatarPlaceholder group={group} />
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-[var(--text-primary)]">
            {group.displayName}
          </h3>
          {group.tagline && (
            <p className="truncate text-[13px] text-[var(--text-tertiary)]">{group.tagline}</p>
          )}
          {group.isUnknown && (
            <p className="text-[12px] text-[var(--status-warning)]">Bot not found</p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className="text-[12px] text-[var(--text-tertiary)]">
          {group.sessions.length} session{group.sessions.length === 1 ? "" : "s"}
        </span>
        <span
          className={cn(
            "text-[13px] font-medium transition-colors",
            "text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)]"
          )}
        >
          Open bot →
        </span>
      </div>
    </button>
  );
}
