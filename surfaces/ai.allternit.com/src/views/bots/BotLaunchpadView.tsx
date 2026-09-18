"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AgentModeBackdrop } from "@/views/chat/agentModeSurfaceTheme";
import { ChatEmptyState } from "@/views/chat/main/ChatEmptyState";
import { BOT_LAUNCH_GREETING } from "@/views/chat/main/launchGreeting";
import { CreateBotForm } from "@/views/agent-view/components/CreateBotForm";
import { useAgentStore } from "@/lib/agents/agent.store";
import { useSurfaceAgentModeEnabled } from "@/lib/agents/surface-agent-context";
import { useAgentSurfaceModeStore } from "@/stores/agent-surface-mode.store";
import type { CanonicalAgentModeId } from "@/lib/agents/agent-mode-contracts";
import type { Bot } from "@/lib/agents/agent.types";
import { getBots } from "@/lib/bots/bot-profile";
import { useStartBotSession } from "@/lib/bots/useStartBotSession";
import {
  openBotChatImmediately,
  openBotChatView,
} from "@/lib/bots/bot-canonical-chat.service";
import { useModelSelection } from "@/providers/model-selection-provider";
import { ModelSelectionProvider } from "@/providers/model-selection-provider";
import { ChatIdProvider } from "@/providers/chat-id-provider";
import { DataStreamProvider } from "@/providers/data-stream-provider";
import { MessageTreeProvider } from "@/providers/message-tree-provider";
import { PromptInputProvider } from "@/components/ai-elements/prompt-input";
import { ChatInputProvider } from "@/providers/chat-input-provider";
import { ChatModelsProvider } from "@/providers/chat-models-provider";
import { useResolvedDefaultModelSelection } from "@/hooks/use-default-model-selection";
import type { GizziAttention, GizziEmotion } from "@/components/ai-elements/GizziMascot";
import type { PluginMentionTarget } from "@/lib/mentions/use-mention-targets";

/**
 * Bot-mode home: composer + Chat/Cowork/Bots bottom deck + templates.
 * Same place as the Bots tab on the Chat composer.
 */
export function BotLaunchpadView() {
  const defaultModelSelection = useResolvedDefaultModelSelection();
  const chatIdRef = useRef(`bot-home-${Date.now()}`);
  return (
    <ChatIdProvider chatId={chatIdRef.current} isPersisted={false} source="local">
      <DataStreamProvider>
        <MessageTreeProvider>
          <PromptInputProvider>
            <ChatInputProvider>
              <ChatModelsProvider>
                <ModelSelectionProvider defaultSelection={defaultModelSelection}>
                  <BotLaunchpadContent />
                </ModelSelectionProvider>
              </ChatModelsProvider>
            </ChatInputProvider>
          </PromptInputProvider>
        </MessageTreeProvider>
      </DataStreamProvider>
    </ChatIdProvider>
  );
}

function BotLaunchpadContent() {
  const agentModeEnabled = useSurfaceAgentModeEnabled("bot");
  const agents = useAgentStore((s) => s.agents);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);
  const selectedBotId = useAgentSurfaceModeStore((s) => s.selectedAgentIdBySurface.bot);
  const { startSession, startTask, isStarting } = useStartBotSession(
    (sessionId, botId) => {
      openBotChatView(sessionId, botId, "bot-launchpad");
    },
  );
  const { selection, startSelection } = useModelSelection();
  const [createOpen, setCreateOpen] = useState(false);
  const [mentionAgentId, setMentionAgentId] = useState<string | null>(null);
  const [_pluginMention, setPluginMention] = useState<PluginMentionTarget | null>(null);
  const [mascotEmotion, setMascotEmotion] = useState<GizziEmotion>("steady");
  const [mascotAttention, setMascotAttention] = useState<GizziAttention | null>(null);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    const openCreate = () => setCreateOpen(true);
    window.addEventListener("allternit:open-create-bot", openCreate);
    return () => window.removeEventListener("allternit:open-create-bot", openCreate);
  }, []);

  const bots = useMemo(() => getBots(agents), [agents]);
  const selectedBot = useMemo(
    () => bots.find((b) => b.id === selectedBotId) ?? null,
    [bots, selectedBotId],
  );

  const handleOpenBotSession = (bot: Bot) => {
    useAgentSurfaceModeStore.getState().setSelectedAgent("bot", bot.id);
    openBotChatImmediately(bot.id, "bot-launchpad");
    void startSession(bot);
  };

  const handleSend = (
    text: string,
    execution?: { modeId: CanonicalAgentModeId; templateTitle?: string },
  ) => {
    const bot = selectedBot;
    if (!bot) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const modeId =
      execution?.modeId ??
      (useAgentSurfaceModeStore.getState().selectedModeBySurface.bot as CanonicalAgentModeId | undefined);
    const templateTitle =
      execution?.templateTitle;
    openBotChatImmediately(bot.id, "bot-launchpad");
    void startTask(bot, trimmed, {
      ...(modeId ? { modeId, templateTitle } : {}),
    });
  };

  return (
    <div className="relative isolate flex h-full min-h-0 flex-col overflow-y-auto">
      <AgentModeBackdrop
        active={agentModeEnabled}
        surface="bot"
        opacity={0.28}
        dataTestId="agent-mode-bot-backdrop"
      />
      <div className="relative z-[1] flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto">
        {!createOpen && (
        <ChatEmptyState
          embeddedAgentStrip={null}
          modelSelection={selection}
          isAgentSessionEmbedded={false}
          ollamaRunning
          modelReady
          startSelection={startSelection}
          useMonolithLogo={false}
          launchLogo="matrix"
          launchMascotEmotion={mascotEmotion}
          launchMascotAttention={mascotAttention}
          greeting={BOT_LAUNCH_GREETING}
          handleSend={handleSend}
          onOpenAgentSession={(text, _surface, execution) => handleSend(text, execution)}
          onStartBotSession={handleOpenBotSession}
          agentSurface="bot"
          setMentionAgentId={setMentionAgentId}
          mentionAgentId={mentionAgentId}
          setPluginMention={setPluginMention}
          activeIsLoading={isStarting}
          showTopActions
          pulseMascot={(emotion) => setMascotEmotion(emotion)}
          setLaunchMascotAttention={setMascotAttention}
          composerTopInfoBar={null}
          composerQuestionBar={null}
          composerBottomInfoBar={null}
        />
        )}
      </div>
      <CreateBotForm isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
