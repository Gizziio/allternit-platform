"use client";

/**
 * Bot Chat Session View
 *
 * A dedicated 1-on-1 chat surface for a single bot. Uses the same ChatComposer
 * as the main home screen so the brain picker, attachments, and input chrome
 * match the rest of the Allternit platform.
 *
 * @module BotChatSessionView
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CircleNotch, Robot, Sparkle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useChatSessionStore } from "@/views/chat/ChatSessionStore";
import { useAgentStore } from "@/lib/agents/agent.store";
import type { ModeSession, ModeSessionMessage } from "@/lib/agents/mode-session-store";
import { getBotDisplayName } from "@/lib/bots/bot-profile";
import { cn } from "@/lib/utils";
import { BotAvatar } from "./BotAvatar";
import { ChatComposer } from "@/views/chat/ChatComposer";
import { ModelSelectionProvider, useModelSelection } from "@/providers/model-selection-provider";
import type { ModelSelection } from "@/components/model-picker";
import { getProviderMeta } from "@/lib/providers/provider-registry";

export interface BotChatSessionViewProps {
  sessionId?: string;
  botId?: string;
  onBack?: () => void;
}

function relativeTime(iso: string | number | undefined): string {
  if (!iso) return "";
  const t = typeof iso === "string" ? new Date(iso).getTime() : iso;
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function parseRuntimeModelId(runtimeModelId: string): {
  providerId: string;
  modelId: string;
} {
  const separator = runtimeModelId.indexOf("/");
  if (separator <= 0) {
    return { providerId: "allternit", modelId: runtimeModelId };
  }
  return {
    providerId: runtimeModelId.slice(0, separator),
    modelId: runtimeModelId.slice(separator + 1),
  };
}

function runtimeModelToSelection(runtimeModelId?: string): ModelSelection | null {
  if (!runtimeModelId) return null;
  const { providerId, modelId } = parseRuntimeModelId(runtimeModelId);
  const meta = getProviderMeta(providerId);
  return {
    providerId,
    profileId: providerId,
    modelId,
    modelName: `${meta.name} · ${modelId}`,
  };
}

export function BotChatSessionView({
  sessionId: sessionIdProp,
  botId,
  onBack,
}: BotChatSessionViewProps) {
  const sessions = useChatSessionStore((s) => s.sessions);
  const agents = useAgentStore((s) => s.agents);

  const bot = useMemo(
    () => agents.find((a) => a.id === botId) ?? null,
    [agents, botId]
  );

  const session = useMemo(() => {
    if (sessionIdProp) {
      return sessions.find((s) => s.id === sessionIdProp) ?? null;
    }
    if (botId) {
      return (
        sessions
          .filter(
            (s) =>
              s.metadata?.isBot === true &&
              (s.metadata?.agentId === botId || s.metadata?.agentName === bot?.name)
          )
          .sort(
            (a, b) =>
              new Date(b.updatedAt || 0).getTime() -
              new Date(a.updatedAt || 0).getTime()
          )[0] ?? null
      );
    }
    return null;
  }, [sessions, sessionIdProp, botId, bot?.name]);

  const runtimeModelId = useMemo(
    () =>
      (session?.metadata?.runtimeModelId as string | undefined) ??
      (bot?.config?.runtimeModelId as string | undefined) ??
      (bot?.provider && bot?.model ? `${bot.provider}/${bot.model}` : undefined),
    [session?.metadata, bot?.config, bot?.provider, bot?.model]
  );

  const defaultSelection = useMemo(
    () => runtimeModelToSelection(runtimeModelId),
    [runtimeModelId]
  );

  return (
    <ModelSelectionProvider defaultSelection={defaultSelection}>
      <BotChatSessionContent
        session={session}
        bot={bot}
        botId={botId}
        onBack={onBack}
      />
    </ModelSelectionProvider>
  );
}

interface BotChatSessionContentProps {
  session: ModeSession | null;
  bot: import("@/lib/agents/agent.types").Agent | null;
  botId?: string;
  onBack?: () => void;
}

function BotChatSessionContent({
  session,
  bot,
  botId,
  onBack,
}: BotChatSessionContentProps) {
  const setActiveSession = useChatSessionStore((s) => s.setActiveSession);
  const createSession = useChatSessionStore((s) => s.createSession);
  const sendMessageStream = useChatSessionStore((s) => s.sendMessageStream);
  const abortGeneration = useChatSessionStore((s) => s.abortGeneration);
  const fetchMessages = useChatSessionStore((s) => s.fetchMessages);
  const streamingBySession = useChatSessionStore((s) => s.streamingBySession);
  const { selection: modelSelection } = useModelSelection();

  const sessionId = session?.id ?? null;
  useEffect(() => {
    if (sessionId) {
      setActiveSession(sessionId);
      if (sessionId.startsWith("ses")) {
        void fetchMessages(sessionId);
      }
    }
  }, [sessionId, setActiveSession, fetchMessages]);

  const streamingState = sessionId ? streamingBySession?.[sessionId] : null;
  const isStreaming = streamingState?.isStreaming ?? false;
  const messages = session?.messages ?? [];

  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isStreaming]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const modelId = modelSelection
        ? `${modelSelection.providerId}/${modelSelection.modelId}`
        : undefined;

      let sid = sessionId;
      if (!sid && botId) {
        sid = await createSession({
          name: bot ? getBotDisplayName(bot) : "Bot Chat",
          sessionMode: "agent",
          agentId: botId,
          metadata: {
            isBot: true,
            agentId: botId,
            botProfile: bot?.botProfile,
            originSurface: "chat",
            runtimeModelId: modelId,
          },
        });
        setActiveSession(sid);
      }
      if (!sid) return;

      await sendMessageStream(sid, { text, modelId });
    },
    [isStreaming, sessionId, botId, bot, modelSelection, createSession, setActiveSession, sendMessageStream]
  );

  const handleStop = useCallback(() => {
    if (sessionId) {
      abortGeneration(sessionId);
    }
  }, [sessionId, abortGeneration]);

  const botName = (bot ? getBotDisplayName(bot) : null) ?? session?.name ?? "Bot";
  const botTagline = bot?.botProfile?.tagline ?? session?.description ?? "";
  const accentColor = bot?.botProfile?.accentColor ?? "var(--accent-primary)";

  const starterPrompts = useMemo(
    () =>
      (bot?.botProfile?.starterPrompts as string[] | undefined) ??
      (session?.metadata?.starterPrompts as string[] | undefined) ??
      [],
    [bot, session]
  );

  const suggestions = starterPrompts.length
    ? starterPrompts.slice(0, 4)
    : [
        "What can you help me with?",
        "Plan a small feature for me",
        "Review this idea",
        "Start a task",
      ];

  return (
    <div className="flex h-full flex-col bg-[var(--bg-elevated)] text-[var(--text-primary)] pt-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="shrink-0"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </Button>
          )}

          <div
            className="flex shrink-0 items-center justify-center rounded-xl"
            style={{
              width: 44,
              height: 44,
              background: `${accentColor}15`,
              border: `1px solid ${accentColor}30`,
            }}
          >
            {bot ? (
              <BotAvatar bot={bot} size={36} />
            ) : (
              <Robot size={24} style={{ color: accentColor }} />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold">{botName}</h2>
              <span className="flex h-2 w-2 rounded-full bg-[var(--status-success)]" title="Online" />
            </div>
            {botTagline ? (
              <p className="truncate text-xs text-[var(--text-secondary)]">
                {botTagline}
              </p>
            ) : (
              <p className="truncate text-xs text-[var(--text-tertiary)]">
                Bot session
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center">
            <div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{
                background: `${accentColor}12`,
                border: `1px solid ${accentColor}25`,
              }}
            >
              {bot ? (
                <BotAvatar bot={bot} size={40} />
              ) : (
                <Sparkle size={28} style={{ color: accentColor }} />
              )}
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Start chatting with {botName}
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Pick a brain below, then send a message or try a starter.
            </p>
            <div className="mt-5 grid w-full grid-cols-2 gap-2">
              {suggestions.map((suggestion, idx) => (
                <button
                  type="button"
                  key={`bot-chat-suggestion-${idx}`}
                  onClick={() => {
                    const textarea = document.querySelector(
                      '[data-bot-composer] textarea'
                    ) as HTMLTextAreaElement | null;
                    if (textarea) {
                      textarea.focus();
                      textarea.value = suggestion;
                      textarea.dispatchEvent(new Event("input", { bubbles: true }));
                    }
                  }}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-left text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--border-default)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((message) => (
              <BotChatMessage
                key={message.id}
                message={message}
                bot={bot}
                botName={botName}
                accentColor={accentColor}
              />
            ))}
            {isStreaming && (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-[var(--text-tertiary)]">
                <CircleNotch size={14} className="animate-spin" />
                {botName} is thinking…
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Composer — same ChatComposer used by the home screen */}
      <div
        data-bot-composer
        className="border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3"
      >
        <ChatComposer
          onSend={handleSend}
          isLoading={isStreaming}
          onStop={handleStop}
          placeholder={`Message ${botName}…`}
          showTopActions={false}
          showModeToggle={false}
        />
      </div>
    </div>
  );
}

function BotChatMessage({
  message,
  bot,
  botName,
  accentColor,
}: {
  message: ModeSessionMessage;
  bot: import("@/lib/agents/agent.types").Agent | null;
  botName: string;
  accentColor: string;
}) {
  const isUser = message.role === "user";
  const isError =
    message.content.startsWith("⚠️") || message.content.startsWith("Chat streaming failed");

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <div className="shrink-0 pt-0.5">
        {isUser ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-primary)] text-[11px] font-semibold text-[var(--ui-text-inverse)]">
            You
          </div>
        ) : bot ? (
          <BotAvatar bot={bot} size={32} />
        ) : (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ background: `${accentColor}20`, color: accentColor }}
          >
            <Robot size={16} />
          </div>
        )}
      </div>

      <div
        className={cn(
          "flex max-w-[80%] flex-col",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div className="flex items-center gap-2 text-[11px] text-[var(--text-tertiary)]">
          <span className="font-medium text-[var(--text-secondary)]">
            {isUser ? "You" : botName}
          </span>
          <span>{relativeTime(message.timestamp)}</span>
        </div>
        <div
          className={cn(
            "mt-1 whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm",
            isUser
              ? "rounded-tr-none bg-[var(--accent-chat)] text-[var(--ui-text-inverse)]"
              : isError
              ? "rounded-tl-none border border-[var(--status-error)]/30 bg-[var(--status-error)]/8 text-[var(--status-error)]"
              : "rounded-tl-none border border-[var(--border-subtle)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
          )}
        >
          {message.content}
        </div>
      </div>
    </motion.div>
  );
}

export default BotChatSessionView;
