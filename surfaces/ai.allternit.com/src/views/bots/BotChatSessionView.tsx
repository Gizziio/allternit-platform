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
  Gear,
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
import { ScreenControlAsk } from "./ScreenControlAsk";
import { useScreenControlStore } from "@/lib/bots/screen-control-ask";
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
  StreamMetricsTracker,
  formatStreamMetrics,
  type StreamMetrics,
} from "@/components/bot-chat/stream-metrics";
import {
  routinesToComposerProps,
  transcriptToShareText,
} from "@/lib/bots/bot-chat-composer";
import { ProviderGallery } from "@/components/chat/ProviderGallery";
import { BotModeModelPicker } from "./BotModeModelPicker";
import {
  THREAD_MODEL_PIN_KEY,
  parseThreadModelPin,
  resolveBotRuntimeModel,
  runtimeModelIdOf,
} from "@/lib/bots/bot-mode-model";
import { BotComputerViewport } from "./BotComputerViewport";
import { launchBotComputerWindow } from "@/lib/open-bot-computer-window";
import { PolicyGovernance } from "./PolicyGovernance";
import { BotWatchStrip } from "./BotWatchStrip";
import { BotRailsDeck } from "@/components/bot-chat/BotRailsDeck";
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
  nextRoutineLabel,
  splitCompactMessages,
  summarizeOlderMessages,
} from "@/lib/bots/bot-session-chrome";
import { useBotRoutineStore } from "@/lib/bots/bot-routine.service";
import { EditBotForm } from "@/views/agent-view/components/create-bot/EditBotForm";
import { isPendingBotSessionId } from "@/lib/bots/bot-canonical-chat.service";

export interface BotChatSessionViewProps {
  sessionId?: string;
  botId?: string;
  onBack?: () => void;
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

  const pendingPlaceholder = isPendingBotSessionId(sessionIdProp);

  const session = useMemo(() => {
    // A real thread id (including local temp-… sessions) must win so
    // sub-thread switches keep their session. Placeholder ids are not in
    // the store — fall through to the bot's latest session, which startSession
    // may have just written.
    if (sessionIdProp && !pendingPlaceholder) {
      const exact = sessions.find((s) => s.id === sessionIdProp);
      if (exact) return exact;
    }
    if (botId) {
      return (
        sessions
          .filter(
            (s) =>
              s.metadata?.isBot === true &&
              (s.metadata?.agentId === botId ||
                s.metadata?.botCanonicalFor === botId ||
                s.metadata?.agentName === bot?.name)
          )
          .sort(
            (a, b) =>
              new Date(b.updatedAt || 0).getTime() -
              new Date(a.updatedAt || 0).getTime()
          )[0] ?? null
      );
    }
    return null;
  }, [sessions, sessionIdProp, pendingPlaceholder, botId, bot?.name]);

  // Deliberately no bot.provider/bot.model fallback: that pair is the agent
  // *catalog* default (config.models.defaults.primary), which on desktop is
  // frequently a provider gizzi does not serve (ProviderModelNotFoundError,
  // silent no-reply). Session `runtimeModelId` is also skipped: older builds
  // stamped every bot session with the broken catalog default at create time.
  // A deliberate thread pin (`threadModelPin`) from the Bot Mode picker is
  // the only session-level override; the picker also applies the runtime
  // model in-memory on a successful save (pickerRuntimeModelId), and with
  // nothing pinned the send path falls back to the persisted composer
  // selection (resolveAgentChatRuntimeModelId → kimi-cli/kimi-k3).
  return (
    <BotChatSessionContent
      session={session}
      bot={bot}
      botId={botId}
      pendingOpen={!session && pendingPlaceholder}
      onBack={onBack}
    />
  );
}

interface BotChatSessionContentProps {
  session: ModeSession | null;
  bot: import("@/lib/agents/agent.types").Agent | null;
  botId?: string;
  pendingOpen?: boolean;
  onBack?: () => void;
}

function BotChatSessionContent({
  session,
  bot,
  botId,
  pendingOpen = false,
  onBack,
}: BotChatSessionContentProps) {
  const setActiveSession = useChatSessionStore((s) => s.setActiveSession);
  const createSession = useChatSessionStore((s) => s.createSession);
  const sendMessageStream = useChatSessionStore((s) => s.sendMessageStream);
  const abortGeneration = useChatSessionStore((s) => s.abortGeneration);
  const fetchMessages = useChatSessionStore((s) => s.fetchMessages);
  const streamingBySession = useChatSessionStore((s) => s.streamingBySession);
  const [pickerRuntimeModelId, setPickerRuntimeModelId] = useState<string | undefined>();
  // ProviderGallery open state. Closing the gallery bumps galleryEpoch, which
  // the picker watches so it refetches discovery + CLI status and un-dims the
  // rail after a connect.
  const [providerConnectInitial, setProviderConnectInitial] = useState<string | null>(null);
  const [showProviderConnect, setShowProviderConnect] = useState(false);
  const [galleryEpoch, setGalleryEpoch] = useState(0);
  const pinnedRuntime = useMemo(() => {
    const pinned = resolveBotRuntimeModel({
      threadPin: parseThreadModelPin(session?.metadata?.[THREAD_MODEL_PIN_KEY]),
      bot,
    });
    return pinned ? runtimeModelIdOf(pinned.providerId, pinned.modelId) : undefined;
  }, [session?.metadata, bot]);

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
  // Bumped on every successful user send so the transcript jumps to the
  // current message even when the viewport was scrolled up in history.
  const [sendCount, setSendCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const { older: olderMessages, recent: recentMessages } = useMemo(
    () => splitCompactMessages(messages),
    [messages]
  );
  const olderSummary = useMemo(
    () => summarizeOlderMessages(olderMessages),
    [olderMessages]
  );
  const [showOlder, setShowOlder] = useState(false);

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
  const [editOpen, setEditOpen] = useState(false);
  const [screenAskOpen, setScreenAskOpen] = useState(false);
  const isAlwaysAllowed = useScreenControlStore((s) => (botId ? s.isAlwaysAllowed(botId) : false));
  const rememberAlways = useScreenControlStore((s) => s.rememberAlways);
  const requestComputer = useCallback(
    (open: boolean) => {
      if (!open) {
        setComputerOpen(false);
        setScreenAskOpen(false);
        return;
      }
      if (computerOpen) return;
      if (!botId || isAlwaysAllowed) {
        setComputerOpen(true);
        return;
      }
      setScreenAskOpen(true);
    },
    [botId, computerOpen, isAlwaysAllowed],
  );
  const [sendError, setSendError] = useState<string | null>(null);
  const [streamMetrics, setStreamMetrics] = useState<StreamMetrics | null>(null);
  const [notifyMode, setNotifyMode] = useState<BotThreadNotifyMode>(() =>
    getBotThreadNotifyMode(session?.id)
  );
  const hasVm = Boolean(bot?.vmOperator?.enabled || activeVM);
  const sessionHasLocalMode = Boolean(session?.metadata?.agentModeId);

  useEffect(() => {
    setNotifyMode(getBotThreadNotifyMode(session?.id));
    setShowOlder(false);
    // A thread-only pick must not leak into a different thread or bot in the
    // same mounted component.
    setPickerRuntimeModelId(undefined);
  }, [session?.id, bot?.id]);

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
      setStreamMetrics(null);
      applyFold(userSendEvent(text.trim()));
      setSendCount((count) => count + 1);

      // No modelSelection fallback here: with nothing pinned, the session
      // store's send path already falls back to the persisted composer
      // selection (readComposerRuntimeModelId → resolveAgentChatRuntimeModelId).
      const modelId = pickerRuntimeModelId ?? pinnedRuntime;

      let sid = sessionId;
      // A persisted temp- session is a zombie from a failed backend create:
      // no backend id and (for bot chats) no local mode executor, so streaming
      // always fails with "Cannot stream a message before a live session
      // exists". When the backend is reachable now, create a real session
      // instead of sending into the void. Local-mode sessions (agentModeId)
      // are legitimately temp and must keep working offline.
      if (sid?.startsWith("temp-") && !sessionHasLocalMode) {
        sid = null;
      }
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
        // Per-turn stream metrics (TTFT + windowed tok/s): derived from the
        // live deltas only, cleared when the turn settles.
        const metrics = new StreamMetricsTracker();
        metrics.markSent();
        const streamCallbacks = streamCallbacksToEvents(applyFold, { turnId });
        await sendMessageStream(sid, {
          text,
          modelId,
          callbacks: {
            ...streamCallbacks,
            onChunk: (content) => {
              metrics.noteTextDelta(content);
              setStreamMetrics(metrics.snapshot());
              streamCallbacks.onChunk?.(content);
            },
            onDone: (usage) => {
              // Real output tokens from the finish frame replace the chars/4
              // estimate for the final rate. TTFT folds away with the turn;
              // the final tok/s stays in the status line until the next send.
              if (usage && typeof usage.outputTokens === "number" && usage.outputTokens > 0) {
                metrics.noteUsage(usage.outputTokens);
              }
              setStreamMetrics({ ...metrics.snapshot(), ttftMs: null });
              streamCallbacks.onDone?.();
            },
            onError: (error) => {
              setStreamMetrics(null);
              streamCallbacks.onError?.(error);
            },
          },
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
    [isStreaming, sessionId, sessionHasLocalMode, botId, bot, pickerRuntimeModelId, pinnedRuntime, createSession, setActiveSession, sendMessageStream, applyFold]
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
    if (!botId) return;
    launchBotComputerWindow({
      botId,
      title: `${botName}'s computer`,
    });
  }, [botId, botName]);

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
        title: computerOpen ? "Hide computer" : "Open computer",
        subtitle: hasVm ? "Show or hide the computer pane" : "Attach or provision a computer",
        onSelect: () => {
          requestComputer(!computerOpen);
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
  }, [computerOpen, handleShare, handleStop, hasVm, isStreaming, requestComputer]);

  const sessionStatus = useMemo(
    () =>
      pendingOpen || !session
        ? { label: "opening chat", tone: "waiting" as const }
        : botSessionStatus({
            botName,
            isStreaming,
            sendError,
            computerOpen,
          }),
    [pendingOpen, session, botName, isStreaming, sendError, computerOpen]
  );
  const metricsLabel = streamMetrics ? formatStreamMetrics(streamMetrics) : "";
  // Nearest enabled routine for this bot (client-local schedule store; no
  // endpoint needed). Recomputes when the routine store changes.
  const botRoutines = useBotRoutineStore((s) =>
    botId ? s.getRoutinesForBot(botId) : [],
  );
  const routineLabel = useMemo(() => nextRoutineLabel(botRoutines), [botRoutines]);
  const statusDot =
    sessionStatus.tone === "running"
      ? "var(--status-warning)"
      : sessionStatus.tone === "error"
        ? "var(--status-error)"
        : "var(--status-success)";

  return (
    <div className="flex h-full flex-col bg-[var(--bg-elevated)] text-[var(--text-primary)] pt-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2.5">
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
              {metricsLabel ? ` · ${metricsLabel}` : ""}
              {routineLabel ? ` · ${routineLabel}` : ""}
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
          <BotModeModelPicker
            bot={bot}
            sessionId={sessionId}
            compact={computerOpen}
            busy={isStreaming}
            refetchSignal={galleryEpoch}
            onRuntimeModel={(runtimeModelId) => {
              // Thread pin + in-memory runtime only. Deliberately NOT the
              // global Chat/Cowork default (selectModel): a bot pick must not
              // reset the platform default.
              setPickerRuntimeModelId(runtimeModelId);
            }}
            onConnectProvider={(providerId) => {
              setProviderConnectInitial(providerId);
              setShowProviderConnect(true);
            }}
          />
          {bot && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
              className="gap-1.5 shrink-0"
              aria-label="Edit bot"
              title="Edit bot"
            >
              <Gear size={14} />
              <span className={computerOpen ? "sr-only" : undefined}>Edit</span>
            </Button>
          )}
          {bot && (
            <Button
              type="button"
              variant={computerOpen ? "secondary" : "outline"}
              size="sm"
              onClick={() => requestComputer(!computerOpen)}
              className="gap-1.5 shrink-0"
              aria-pressed={computerOpen}
              title={hasVm ? "Toggle computer viewport" : "Open bot computer"}
            >
              <Desktop size={14} />
              <span className={computerOpen ? "sr-only" : undefined}>Computer</span>
              {activeVM?.status === "running" && (
                <span className="h-2 w-2 rounded-full bg-[var(--status-success)] animate-pulse" />
              )}
            </Button>
          )}
        </div>
      </div>

      <PolicyGovernance
        botId={botId}
        sessionMode={session?.metadata?.sessionMode}
        isBot={session?.metadata?.isBot === true}
      />

      <BotRailsDeck />

      {botId && (session?.metadata?.sessionMode === "agent" || session?.metadata?.isBot === true) && (
        <BotWatchStrip
          botId={botId}
          sandboxId={activeVM?.status === "running" ? activeVM.id : undefined}
          computerOpen={computerOpen}
          onOpenComputer={() => requestComputer(true)}
          transcript={transcript}
          parentName={botName}
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
      {screenAskOpen && (
        <ScreenControlAsk
          botName={botName}
          onDecide={(decision) => {
            setScreenAskOpen(false);
            if (decision === "deny") return;
            if (decision === "always" && botId) rememberAlways(botId);
            setComputerOpen(true);
          }}
        />
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
              {pendingOpen
                ? "Opening locally — you can type while the session catches up."
                : "Send a message or pick a routine below."}
            </p>
          </div>
        </div>
      ) : (
        <BotTranscript
          transcript={transcript}
          className="flex-1 overflow-y-auto px-1 py-2"
          jumpKey={sendCount}
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
      {bot && (
        <EditBotForm
          bot={bot}
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}
      <ProviderGallery
        isOpen={showProviderConnect}
        onClose={() => {
          setShowProviderConnect(false);
          setProviderConnectInitial(null);
          // Un-dim the rail: the picker refetches discovery + CLI status.
          setGalleryEpoch((epoch) => epoch + 1);
        }}
        initialProvider={providerConnectInitial}
      />
    </div>
  );
}

export default BotChatSessionView;
