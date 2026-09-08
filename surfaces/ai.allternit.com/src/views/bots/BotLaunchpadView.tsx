"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Gear, Plus, Robot } from "@phosphor-icons/react";

import { ChatComposer } from "@/views/chat/ChatComposer";
import {
  ModelSelectionProvider,
  useModelSelection,
} from "@/providers/model-selection-provider";
import { ModelPicker } from "@/components/model-picker";
import { useDefaultModelSelection } from "@/hooks/use-default-model-selection";
import { useSurfaceAgentModeEnabled } from "@/lib/agents/surface-agent-context";
import { AgentModeBackdrop } from "@/views/chat/agentModeSurfaceTheme";
import {
  LAUNCH_TOP_PADDING,
  LAUNCH_SECTION_GAP,
  LAUNCH_COMPOSER_WIDTH,
} from "@/views/chat/main/launchScreenLayout";
import { LaunchHeader } from "@/views/chat/main/LaunchHeader";
import { BOT_LAUNCH_GREETING } from "@/views/chat/main/launchGreeting";
import { BotHubCard } from "@/views/agent-hub/main/BotHubCard";
import { CreateBotForm } from "@/views/agent-view/components/CreateBotForm";
import { useAgentStore } from "@/lib/agents/agent.store";
import { useAgentSurfaceModeStore } from "@/stores/agent-surface-mode.store";
import type { Bot } from "@/lib/agents/agent.types";
import { getBots } from "@/lib/bots/bot-profile";
import { useBotRosterStore } from "@/lib/bots/bot-roster.store";
import { useStartBotSession } from "@/lib/bots/useStartBotSession";
import { openBotChatView } from "@/lib/bots/bot-canonical-chat.service";
import { BotTopDeck } from "./BotTopDeck";

/**
 * Bot-mode home view: transparent background (the shell WorkspaceBackground
 * paints the bot-mode texture behind it), shared launch geometry/greeting
 * header, a bot roster grid, and the standard ChatComposer in the 'bot'
 * surface — whose "+" button opens the BotPickerSheet instead of the plus
 * menu. Background is transparent, exactly like CoworkLaunchpad.
 */
export function BotLaunchpadView() {
  const defaultSelection = useDefaultModelSelection();
  return (
    <ModelSelectionProvider defaultSelection={defaultSelection}>
      <BotLaunchpadContent />
    </ModelSelectionProvider>
  );
}

function BotLaunchpadContent() {
  const agentModeEnabled = useSurfaceAgentModeEnabled("bot");
  const { selection: modelSelection, selectModel, startSelection, isSelecting, cancelSelection } =
    useModelSelection();
  const agents = useAgentStore((s) => s.agents);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);
  const pinnedBotIds = useBotRosterStore((s) => s.pinnedBotIds);
  const selectedBotId = useAgentSurfaceModeStore((s) => s.selectedAgentIdBySurface.bot);
  const { startSession, startTask, isStarting } = useStartBotSession();
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  // Pinned bots first (in pin order), then the rest alphabetically.
  const bots = useMemo(() => {
    const list = getBots(agents);
    const pinned = pinnedBotIds
      .map((id) => list.find((b) => b.id === id))
      .filter((b): b is Bot => Boolean(b));
    const pinnedSet = new Set(pinned.map((b) => b.id));
    const rest = list
      .filter((b) => !pinnedSet.has(b.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    return [...pinned, ...rest];
  }, [agents, pinnedBotIds]);

  const handleOpenBotSession = async (bot: Bot) => {
    const sessionId = await startSession(bot);
    if (sessionId) {
      openBotChatView(sessionId, bot.id, "bot-launchpad");
    }
  };

  const handleOpenBotDetail = (bot: Bot) => {
    window.dispatchEvent(
      new CustomEvent("allternit:open-view", {
        detail: { viewType: "bot-home", context: { botId: bot.id } },
      })
    );
  };

  const handleSend = (text: string) => {
    const bot = bots.find((b) => b.id === selectedBotId) ?? null;
    if (!bot) {
      // No bot chosen yet — ask the user to pick one from the bot sheet.
      window.dispatchEvent(new CustomEvent("allternit:open-bot-picker"));
      return;
    }
    void startTask(bot, text).then((sessionId) => {
      if (sessionId) {
        openBotChatView(sessionId, bot.id, "bot-launchpad");
      }
    });
  };

  return (
    <div
      style={{
        padding: `${LAUNCH_TOP_PADDING} 40px 80px`,
        height: "100%",
        overflowY: "auto",
        background: "transparent",
        color: "var(--ui-text-primary)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
        isolation: "isolate",
      }}
    >
      <AgentModeBackdrop
        active={agentModeEnabled}
        surface="bot"
        dataTestId="agent-mode-bot-backdrop"
      />
      <BotTopDeck />
      <div style={{ width: "100%", maxWidth: "860px", position: "relative", zIndex: 1 }}>
        {/* Shared launch header — same geometry as the Chat/Cowork launch
            screens so the three-way toggle never shifts the composer. Bot
            mode keeps the gizzi mascot entrance (LaunchHeader default logo). */}
        <LaunchHeader greeting={BOT_LAUNCH_GREETING} />

        {/* Composer — in the 'bot' surface the "+" button opens the
            BotPickerSheet instead of the standard plus menu. */}
        <div
          style={{
            width: "100%",
            maxWidth: LAUNCH_COMPOSER_WIDTH,
            margin: `0 auto ${LAUNCH_SECTION_GAP}px`,
          }}
        >
          <ChatComposer
            onSend={handleSend}
            variant="large"
            placeholder="Message a bot…"
            selectedModel={modelSelection?.modelId}
            selectedModelDisplayName={modelSelection?.modelName || modelSelection?.modelId}
            onOpenModelPicker={startSelection}
            onSelectModel={selectModel}
            showTopActions={false}
            inputValue=""
            agentModeSurface="bot"
          />
        </div>

        {/* Bot roster grid */}
        {bots.length === 0 ? (
          <div
            style={{
              width: "100%",
              maxWidth: LAUNCH_COMPOSER_WIDTH,
              margin: "0 auto",
            }}
            className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--border-subtle)] px-6 py-12 text-center"
          >
            <span className="flex items-center justify-center size-12 rounded-2xl bg-[color-mix(in_srgb,var(--accent-bot)_12%,var(--surface-floating))] text-[var(--accent-bot)]">
              <Robot size={24} weight="duotone" />
            </span>
            <p className="text-sm font-medium text-[var(--text-primary)]">No bots yet</p>
            <p className="text-[13px] text-[var(--text-secondary)]">
              Create your first bot and it will show up here, ready to launch.
            </p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-4 text-[13px] font-medium text-[var(--bg-elevated)] transition-opacity hover:opacity-90"
            >
              <Plus size={16} />
              Create your first bot
            </button>
          </div>
        ) : (
          <div
            style={{
              width: "100%",
              maxWidth: LAUNCH_COMPOSER_WIDTH,
              margin: "0 auto",
            }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {bots.map((bot, index) => (
              <div key={bot.id} className="group/card relative">
                <BotHubCard
                  bot={bot}
                  index={index}
                  onClick={() => void handleOpenBotSession(bot)}
                />
                {/* Detail affordance — opens the bot-home view (settings,
                    workspace, inbox) without starting a session. The card's
                    own overflow menu sits top-right, so this gear lives
                    bottom-right. */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenBotDetail(bot);
                  }}
                  aria-label={`${bot.name} settings`}
                  title="Bot settings"
                  className="absolute bottom-3 right-3 flex size-7 items-center justify-center rounded-lg border-none bg-transparent text-[var(--text-tertiary)] opacity-0 transition-opacity cursor-pointer group-hover/card:opacity-100 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                >
                  <Gear size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {isStarting && (
          <p className="mt-3 text-center text-[12px] text-[var(--ui-text-muted)]">
            Starting bot…
          </p>
        )}

        <ModelPicker
          open={isSelecting}
          onOpenChange={(open) => {
            if (!open) cancelSelection();
          }}
          onSelect={selectModel}
          onCancel={cancelSelection}
          trigger={<div style={{ display: "none" }} />}
        />
      </div>

      <CreateBotForm isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
