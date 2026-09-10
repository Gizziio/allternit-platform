"use client";

/**
 * Bot Top Deck
 *
 * Grok-Bot-style top bar for the Bots home: a "To:" bar reading
 * "Search or create Bots" (or the currently selected bot's name) that opens a
 * dropdown panel with Create new Bot / Create group chat actions and a
 * numbered list of all bots. Selecting a bot binds it to the 'bot' surface
 * (useAgentSurfaceModeStore) and opens its chat session via the same
 * useStartBotSession + openBotChatView services BotLaunchpadView uses.
 *
 * @module BotTopDeck
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { CaretDown, Plus, Robot, UsersThree } from "@phosphor-icons/react";

import { useAgentStore } from "@/lib/agents/agent.store";
import type { Bot } from "@/lib/agents/agent.types";
import { useAgentSurfaceModeStore } from "@/stores/agent-surface-mode.store";
import { getBots, getBotDisplayName } from "@/lib/bots/bot-profile";
import { useStartBotSession } from "@/lib/bots/useStartBotSession";
import { openBotChatView } from "@/lib/bots/bot-canonical-chat.service";
import { useGroupChatStore } from "@/lib/bots/group-chat.store";
import { CreateBotForm } from "@/views/agent-view/components/CreateBotForm";
import {
  GroupChatChannelDialog,
  type GroupChatChannelFormData,
} from "./GroupChatChannelDialog";
import { BotAvatar } from "./BotAvatar";

export function BotTopDeck(): React.ReactNode {
  const agents = useAgentStore((s) => s.agents);
  const selectedBotId = useAgentSurfaceModeStore(
    (s) => s.selectedAgentIdBySurface.bot,
  );
  const { startSession, isStarting } = useStartBotSession();
  const createGroup = useGroupChatStore((s) => s.createGroup);
  const setActiveGroup = useGroupChatStore((s) => s.setActiveGroup);

  const [panelOpen, setPanelOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const bots = useMemo(() => getBots(agents), [agents]);
  const selectedBot = useMemo(
    () => bots.find((b) => b.id === selectedBotId) ?? null,
    [bots, selectedBotId],
  );

  // Close the panel on outside pointer-down / Escape.
  useEffect(() => {
    if (!panelOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setPanelOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanelOpen(false);
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [panelOpen]);

  const handleSelectBot = async (bot: Bot) => {
    useAgentSurfaceModeStore.getState().setSelectedAgent("bot", bot.id);
    setPanelOpen(false);
    const sessionId = await startSession(bot);
    if (sessionId) {
      openBotChatView(sessionId, bot.id, "bot-launchpad");
    }
  };

  const handleCreateGroup = (data: GroupChatChannelFormData) => {
    const groupId = createGroup(data.name, data.members, data.metadata);
    setActiveGroup(groupId);
    window.dispatchEvent(
      new CustomEvent("allternit:open-view", {
        detail: { viewType: "group-chat", context: { groupId } },
      }),
    );
  };

  return (
    <div
      ref={rootRef}
      style={{ width: "100%", maxWidth: 860, margin: "0 auto", position: "relative", zIndex: 2 }}
    >
      {/* To: bar */}
      <button
        type="button"
        onClick={() => setPanelOpen((v) => !v)}
        aria-expanded={panelOpen}
        className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--surface-floating)] px-3 py-2 text-left transition-colors hover:bg-[var(--surface-hover)]"
        style={{ color: "var(--text-primary)" }}
      >
        <span className="text-[13px] font-semibold text-[var(--text-tertiary)]">
          To:
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px]">
          {selectedBot ? getBotDisplayName(selectedBot) : "Search or create Bots"}
        </span>
        <CaretDown
          size={14}
          weight="bold"
          style={{
            color: "var(--text-tertiary)",
            transform: panelOpen ? "rotate(180deg)" : undefined,
            transition: "transform 0.15s ease",
          }}
        />
      </button>

      {/* Dropdown panel */}
      {panelOpen && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+6px)] overflow-hidden rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--surface-floating)] shadow-[var(--shadow-xl)]"
          style={{ color: "var(--text-primary)" }}
        >
          {/* Actions */}
          <div className="flex flex-col gap-0.5 p-1.5">
            <PanelActionRow
              icon={<Plus size={16} weight="bold" />}
              label="Create new Bot"
              onClick={() => {
                setPanelOpen(false);
                setCreateOpen(true);
              }}
            />
            <PanelActionRow
              icon={<UsersThree size={16} weight="bold" />}
              label="Create group chat"
              onClick={() => {
                setPanelOpen(false);
                setGroupDialogOpen(true);
              }}
            />
          </div>

          <div className="h-px bg-[var(--border-subtle)]" />

          {/* Numbered bot list */}
          <div className="max-h-72 overflow-y-auto p-1.5">
            {bots.length === 0 ? (
              <div className="flex items-center gap-2 px-2.5 py-2 text-[12px] text-[var(--text-tertiary)]">
                <Robot size={14} />
                No bots yet — create one above
              </div>
            ) : (
              bots.map((bot, index) => (
                <button
                  key={bot.id}
                  type="button"
                  disabled={isStarting}
                  onClick={() => void handleSelectBot(bot)}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-none bg-transparent px-2.5 py-2 text-left transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ color: "var(--text-primary)" }}
                >
                  <span className="w-4 shrink-0 text-right text-[11px] font-semibold text-[var(--text-tertiary)]">
                    {index + 1}
                  </span>
                  <BotAvatar bot={bot} size={24} />
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {getBotDisplayName(bot)}
                  </span>
                  {bot.id === selectedBotId && (
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: "var(--accent-bot)" }}
                    />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <CreateBotForm isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <GroupChatChannelDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        onSave={handleCreateGroup}
      />
    </div>
  );
}

function PanelActionRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}): React.ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-none bg-transparent px-2.5 py-2 text-left transition-colors hover:bg-[var(--surface-hover)]"
      style={{ color: "var(--text-primary)" }}
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--accent-bot)_12%,transparent)] text-[var(--accent-bot)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{label}</span>
    </button>
  );
}

export default BotTopDeck;
