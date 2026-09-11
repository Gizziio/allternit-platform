"use client";

/**
 * Bot Chat Session View
 *
 * A dedicated 1-on-1 chat surface for a single bot. Transcript and composer
 * are the shared `src/components/bot-chat/` set (same files as the Fabric
 * Session PWA). Model picker and computer sidecar stay on this view.
 *
 * @module BotChatSessionView
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bell,
  BellSlash,
  Broadcast,
  Desktop,
  Paperclip,
  Robot,
  ShareNetwork,
  Sparkle,
  Stop,
  Tray,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useChatSessionStore } from "@/views/chat/ChatSessionStore";
import { useAgentStore } from "@/lib/agents/agent.store";
import type { ModeSession } from "@/lib/agents/mode-session-store";
import { getBotDisplayName } from "@/lib/bots/bot-profile";
import { cn } from "@/lib/utils";
import { BotAvatar } from "./BotAvatar";
import { BotComposer, type BotComposerAction } from "@/components/bot-chat/BotComposer";
import { BotTranscript } from "@/components/bot-chat/BotTranscript";
import {
  applyEvent,
  initTranscript,
  messagesToTranscript,
  streamCallbacksToEvents,
  userSendEvent,
} from "@/components/bot-chat/chat-stream-adapter";
import { useBotApprovalBridge } from "@/lib/bots/use-bot-approval-bridge";
import type { BotChatTranscript } from "@/components/bot-chat/types";
import {
  routinesToComposerProps,
  transcriptToShareText,
} from "@/lib/bots/bot-chat-composer";
import { ModelSelectionProvider, useModelSelection } from "@/providers/model-selection-provider";
import { ModelPicker, type ModelSelection } from "@/components/model-picker";
import { getProviderMeta } from "@/lib/providers/provider-registry";
import { BotComputerViewport } from "./BotComputerViewport";
import { PolicyGovernance } from "./PolicyGovernance";
import { BotWatchStrip } from "./BotWatchStrip";
import { useBotActiveVm } from "./useBotActiveVm";
import {
  cycleBotThreadNotifyMode,
  getBotThreadNotifyMode,
  notifyModeLabel,
  type BotThreadNotifyMode,
} from "@/lib/bots/bot-thread-notify";
import { useBrowserAgentStore } from "@/capsules/browser/browserAgent.store";
import {
  botSessionStatus,
  splitCompactMessages,
  summarizeOlderMessages,
} from "@/lib/bots/bot-session-chrome";

export interface BotChatSessionViewProps {
  sessionId?: string;
  botId?: string;
  onBack?: () => void;
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
  const {
    selection: modelSelection,
    isSelecting,
    selectModel,
    startSelection,
    cancelSelection,
  } = useModelSelection();

  const sessionId = session?.id ?? null;
  useEffect(() => {
    if (sessionId) {
      setActiveSession(sessionId);
      // fetchMessages no-ops for locally-created ids (temp-…) inside the
      // store, so calling it unconditionally keeps local bot sessions usable
      // without orphaning them from message refresh.
      void fetchMessages(sessionId);
    }
  }, [sessionId, setActiveSession, fetchMessages]);

  const streamingState = sessionId ? streamingBySession?.[sessionId] : null;
  const isStreaming = streamingState?.isStreaming ?? false;
  const messages = session?.messages ?? [];
  const [transcript, setTranscript] = useState<BotChatTranscript>(() => initTranscript());
  const fileRef = useRef<HTMLInputElement>(null);

  const { older: olderMessages, recent: recentMessages } = useMemo(
    () => splitCompactMessages(messages),
    [messages]
  );
  const olderSummary = useMemo(
    () => summarizeOlderMessages(olderMessages),
    [olderMessages]
  );

  useEffect(() => {
    setTranscript(messagesToTranscript(showOlder ? messages : recentMessages));
    // Rebuild on session identity / compact toggle — live turns go through stream callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, showOlder]);

  const applyFold = useCallback((event: Parameters<typeof applyEvent>[1]) => {
    setTranscript((t) => applyEvent(t, event));
  }, []);

  const activeVM = useBotActiveVm(botId);
  const setConnectedBotId = useBrowserAgentStore((s) => s.setConnectedBotId);
  const setAciSidecarExpanded = useBrowserAgentStore((s) => s.setAciSidecarExpanded);
  const aciSidecarExpanded = useBrowserAgentStore((s) => s.aciSidecarExpanded);
  const [computerOpen, setComputerOpen] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [notifyMode, setNotifyMode] = useState<BotThreadNotifyMode>(() =>
    getBotThreadNotifyMode(session?.id)
  );
  const [showOlder, setShowOlder] = useState(false);
  const hasVm = Boolean(bot?.vmOperator?.enabled || activeVM);

  useEffect(() => {
    setNotifyMode(getBotThreadNotifyMode(session?.id));
    setShowOlder(false);
  }, [session?.id]);

  // The computer pane is user-driven only: it opens via the top-right
  // "Computer" button, never on its own. Connect the bot to the global
  // sidecar only while this chat is mounted and only if the bot actually has
  // a computer; disconnect on leave so the right-side panel cannot linger.
  useEffect(() => {
    if (!botId || !hasVm) return;
    setConnectedBotId(botId);
    setAciSidecarExpanded(false);
    return () => setConnectedBotId(null);
  }, [botId, hasVm, setConnectedBotId, setAciSidecarExpanded]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      setSendError(null);
      applyFold(userSendEvent(text.trim()));

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

      try {
        const turnId = `a-${Date.now()}`;
        await sendMessageStream(sid, {
          text,
          modelId,
          callbacks: streamCallbacksToEvents(applyFold, { turnId }),
        });
      } catch (err) {
        // Never leave this as an unhandled rejection — the message silently
        // never sends and the user has no idea why.
        const detail = err instanceof Error ? err.message : String(err);
        setSendError(
          sid.startsWith("temp-")
            ? `This bot session is local-only (backend unavailable). Message not sent. ${detail}`
            : `Message not sent. ${detail}`
        );
      }
    },
    [isStreaming, sessionId, botId, bot, modelSelection, createSession, setActiveSession, sendMessageStream, applyFold]
  );

  const handleStop = useCallback(() => {
    if (sessionId) {
      abortGeneration(sessionId);
    }
  }, [sessionId, abortGeneration]);

  const botName = (bot ? getBotDisplayName(bot) : null) ?? session?.name ?? "Bot";
  const botTagline = bot?.botProfile?.tagline ?? session?.description ?? "";
  const accentColor = bot?.botProfile?.accentColor ?? "var(--accent-primary)";
  const { onApprovalAnswer, onApprovalGrant } = useBotApprovalBridge(
    sessionId,
    botId ?? "",
    botName,
    applyFold,
  );

  const { suggestions, commands } = useMemo(
    () => (botId ? routinesToComposerProps(botId) : { suggestions: [], commands: [] }),
    [botId],
  );

  const handleOpenInAci = useCallback(() => {
    if (botId) setConnectedBotId(botId);
    setAciSidecarExpanded(true);
  }, [botId, setConnectedBotId, setAciSidecarExpanded]);

  const handleShare = useCallback(async () => {
    const lines = transcript.rows.map((row) => {
      if (row.kind === "message") {
        return `${row.message.role === "user" ? "You" : botName}: ${row.message.text}`;
      }
      return "";
    });
    const text = transcriptToShareText(lines, botName);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text, title: botName });
        return;
      }
      await navigator.clipboard.writeText(text);
      setSendError(null);
    } catch {
      setSendError("Could not share the transcript.");
    }
  }, [botName, transcript]);

  const composerActions: BotComposerAction[] = useMemo(() => {
    const rows: BotComposerAction[] = [
      {
        id: "attach",
        icon: <Paperclip className="size-4" />,
        title: "Attach",
        subtitle: "Choose a file on this device",
        onSelect: () => fileRef.current?.click(),
      },
      {
        id: "new-thread",
        icon: <Tray className="size-4" />,
        title: "New thread",
        subtitle: "Clear this view. The saved session stays.",
        onSelect: () => setTranscript(initTranscript()),
      },
      {
        id: "watch",
        icon: <Broadcast className="size-4" />,
        title: computerOpen ? "Stop watching" : "Watch computer",
        subtitle: hasVm ? "Show or hide the computer pane" : "This bot has no computer attached",
        onSelect: () => {
          if (!hasVm) {
            setSendError("This bot has no computer attached.");
            return;
          }
          setComputerOpen((open) => !open);
        },
      },
      {
        id: "share",
        icon: <ShareNetwork className="size-4" />,
        title: "Share transcript",
        subtitle: "Share or copy this chat",
        onSelect: () => void handleShare(),
      },
    ];
    if (isStreaming) {
      rows.push({
        id: "interrupt",
        icon: <Stop className="size-4" />,
        title: "Interrupt",
        subtitle: "Stop the current reply",
        danger: true,
        onSelect: handleStop,
      });
    }
    return rows;
  }, [computerOpen, handleShare, handleStop, hasVm, isStreaming]);

  const sessionStatus = useMemo(
    () =>
      botSessionStatus({
        botName,
        isStreaming,
        sendError,
        computerOpen,
      }),
    [botName, isStreaming, sendError, computerOpen]
  );
  const statusDot =
    sessionStatus.tone === "running"
      ? "var(--status-warning)"
      : sessionStatus.tone === "error"
        ? "var(--status-error)"
        : "var(--status-success)";

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

          <button
            type="button"
            onClick={() => {
              if (!botId) return;
              window.dispatchEvent(
                new CustomEvent("allternit:open-view", {
                  detail: { viewType: "bot-home", context: { botId } },
                })
              );
            }}
            aria-label={bot ? `Bot settings for ${botName}` : "Bot settings"}
            title="Bot settings"
            className="flex shrink-0 cursor-pointer items-center justify-center rounded-xl border-none bg-transparent p-0 transition-opacity hover:opacity-75"
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
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold">{botName}</h2>
              <span
                className="flex h-2 w-2 rounded-full"
                style={{ background: statusDot }}
                title={sessionStatus.label}
              />
            </div>
            <p className="truncate text-xs text-[var(--text-secondary)]">
              {sessionStatus.label}
              {botTagline ? ` · ${botTagline}` : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {sessionId && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={notifyModeLabel(notifyMode)}
              title={notifyModeLabel(notifyMode)}
              aria-pressed={notifyMode !== "all"}
              onClick={() => setNotifyMode(cycleBotThreadNotifyMode(sessionId))}
            >
              {notifyMode === "muted" ? <BellSlash size={16} /> : <Bell size={16} />}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={startSelection}
            className="max-w-[160px] truncate"
            aria-label="Select model"
          >
            {modelSelection?.modelName ?? "Model"}
          </Button>
          {hasVm && (
            <Button
              type="button"
              variant={computerOpen ? "secondary" : "outline"}
              size="sm"
              onClick={() => setComputerOpen((open) => !open)}
              className="gap-1.5 shrink-0"
              aria-pressed={computerOpen}
            >
              <Desktop size={14} />
              Computer
            </Button>
          )}
        </div>
        <ModelPicker
          open={isSelecting}
          onOpenChange={(open) => {
            if (open) startSelection();
            else cancelSelection();
          }}
          onSelect={selectModel}
          onCancel={cancelSelection}
        />
      </div>

      <PolicyGovernance
        botId={botId}
        sessionMode={session?.metadata?.sessionMode}
        isBot={session?.metadata?.isBot === true}
      />

      {botId && (session?.metadata?.sessionMode === "agent" || session?.metadata?.isBot === true) && (
        <BotWatchStrip
          botId={botId}
          sandboxId={activeVM?.status === "running" ? activeVM.id : undefined}
          computerOpen={computerOpen}
          onOpenComputer={() => setComputerOpen(true)}
          transcript={transcript}
        />
      )}

      <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const name = e.target.files?.[0]?.name;
          e.target.value = "";
          if (name) setSendError(`Attached ${name}. Sending files is not wired yet.`);
        }}
      />
      {olderSummary && !showOlder && (
        <button
          type="button"
          onClick={() => setShowOlder(true)}
          className="mx-4 mt-2 self-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
        >
          {olderSummary}
        </button>
      )}
      {transcript.rows.length === 0 && !transcript.activeTurn ? (
        <div className="flex-1 overflow-y-auto px-4 py-4">
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
              Chat with {botName}
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Send a message or pick a routine below.
            </p>
          </div>
        </div>
      ) : (
        <BotTranscript
          transcript={transcript}
          className="flex-1 overflow-y-auto px-1 py-2"
          onApprovalAnswer={onApprovalAnswer}
          onApprovalGrant={onApprovalGrant}
        />
      )}

      <div
        data-bot-composer
        className="border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3"
      >
        <BotComposer
          onSend={(text) => void handleSend(text)}
          suggestions={suggestions}
          commands={commands}
          actions={composerActions}
          status={sendError ?? undefined}
          placeholder={`Message ${botName}`}
          busy={isStreaming}
        />
      </div>
      </div>

      {computerOpen && bot && (
        <aside
          className={cn(
            "flex min-h-0 w-[min(46%,520px)] shrink-0 flex-col border-l border-[var(--border-subtle)]",
            aciSidecarExpanded && "opacity-90",
          )}
          aria-label={`${botName}'s computer`}
        >
          <BotComputerViewport
            bot={bot}
            accentColor={accentColor}
            activeVM={activeVM}
            layout="pane"
            onOpenInAci={handleOpenInAci}
          />
        </aside>
      )}
      </div>
    </div>
  );
}

export default BotChatSessionView;
