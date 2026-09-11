"use client";

/**
 * Fabric Session PWA bot chat. Owns the fold + adapter. No router.
 *
 * @module fabric-session/BotsChatPage
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Broadcast,
  Paperclip,
  ShareNetwork,
  Stop,
  Tray,
} from "@phosphor-icons/react";
import { ApprovalPill } from "@/components/bot-chat/ApprovalPill";
import { BotComposer, type BotComposerAction } from "@/components/bot-chat/BotComposer";
import { BotTranscript } from "@/components/bot-chat/BotTranscript";
import { WaitingOnYouPill } from "@/components/bot-chat/WaitingOnYouPill";
import {
  applyEvent,
  approvalAnswerToEvent,
  initTranscript,
  messagesToTranscript,
  streamCallbacksToEvents,
  userSendEvent,
} from "@/components/bot-chat/chat-stream-adapter";
import type { ApprovalRequest, BotChatTranscript } from "@/components/bot-chat/types";
import {
  routinesToComposerProps,
  transcriptToShareText,
} from "@/lib/bots/bot-chat-composer";
import { getBotDisplayName } from "@/lib/bots/bot-profile";
import { useUnifiedRoster } from "@/lib/bots/use-unified-roster";
import { useChatSessionStore } from "@/views/chat/ChatSessionStore";

export interface BotsChatPageProps {
  botId: string;
  onBack: () => void;
  onApprovalsChange?: (botId: string, pending: ApprovalRequest[]) => void;
  watching?: boolean;
  onToggleWatch?: () => void;
}

function pendingApprovals(transcript: BotChatTranscript): ApprovalRequest[] {
  return transcript.rows
    .filter((r): r is Extract<typeof r, { kind: "approval" }> => r.kind === "approval")
    .map((r) => r.approval)
    .filter((a) => a.status === "pending");
}

function rowShareLine(transcript: BotChatTranscript): string[] {
  return transcript.rows.map((row) => {
    switch (row.kind) {
      case "message":
        return `${row.message.role === "user" ? "You" : "Bot"}: ${row.message.text}`;
      case "approval":
        return `Approval (${row.approval.status}): ${row.approval.title}`;
      case "error":
        return `Error: ${row.text}`;
      default:
        return "";
    }
  });
}

export function BotsChatPage({
  botId,
  onBack,
  onApprovalsChange,
  watching = false,
  onToggleWatch,
}: BotsChatPageProps) {
  const roster = useUnifiedRoster();
  const bot = useMemo(() => roster.find((b) => b.id === botId) ?? null, [roster, botId]);
  const botName = bot ? bot.displayName : "Bot";
  const accent = bot?.accentColor ?? "var(--accent-primary)";

  const sessions = useChatSessionStore((s) => s.sessions);
  const createSession = useChatSessionStore((s) => s.createSession);
  const sendMessageStream = useChatSessionStore((s) => s.sendMessageStream);
  const abortGeneration = useChatSessionStore((s) => s.abortGeneration);
  const setActiveSession = useChatSessionStore((s) => s.setActiveSession);
  const streamingBySession = useChatSessionStore((s) => s.streamingBySession);

  const session = useMemo(() => {
    return (
      sessions
        .filter(
          (s) =>
            s.metadata?.isBot === true &&
            (s.metadata?.agentId === botId || s.metadata?.agentName === bot?.agent.name),
        )
        .sort(
          (a, b) =>
            new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
        )[0] ?? null
    );
  }, [sessions, botId, bot?.agent.name]);

  const sessionId = session?.id ?? null;
  const isStreaming = sessionId ? Boolean(streamingBySession?.[sessionId]?.isStreaming) : false;

  const [transcript, setTranscript] = useState<BotChatTranscript>(() => initTranscript());
  const [status, setStatus] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTranscript(session ? messagesToTranscript(session.messages) : initTranscript());
    // Rebuild only when the selected bot changes, not on every store tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  useEffect(() => {
    if (sessionId) setActiveSession(sessionId);
  }, [sessionId, setActiveSession]);

  const pending = pendingApprovals(transcript);
  const pendingKey = pending.map((a) => a.id).join(",");
  useEffect(() => {
    onApprovalsChange?.(botId, pendingApprovals(transcript));
    // pendingKey captures identity of pending rows without looping on a new array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId, pendingKey, onApprovalsChange]);

  const apply = useCallback((event: Parameters<typeof applyEvent>[1]) => {
    setTranscript((t) => applyEvent(t, event));
  }, []);

  const { suggestions, commands } = useMemo(
    () => (botId ? routinesToComposerProps(botId) : { suggestions: [], commands: [] }),
    [botId],
  );

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;
      setStatus(undefined);
      apply(userSendEvent(trimmed));

      try {
        let sid = sessionId;
        if (!sid) {
          sid = await createSession({
            name: bot ? getBotDisplayName(bot.agent) : botName,
            sessionMode: "agent",
            agentId: botId,
            metadata: {
              isBot: true,
              agentId: botId,
              botProfile: bot?.agent.botProfile,
              originSurface: "fabric-session",
            },
          });
          setActiveSession(sid);
        }
        const turnId = `a-${Date.now()}`;
        await sendMessageStream(sid, {
          text: trimmed,
          callbacks: streamCallbacksToEvents(apply, { turnId }),
        });
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        setStatus(`Message not sent. ${detail}`);
      }
    },
    [
      apply,
      bot,
      botId,
      botName,
      createSession,
      isStreaming,
      sendMessageStream,
      sessionId,
      setActiveSession,
    ],
  );

  const handleShare = useCallback(async () => {
    const text = transcriptToShareText(rowShareLine(transcript), botName);
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ text, title: botName });
        return;
      }
      await navigator.clipboard.writeText(text);
      setStatus("Copied the transcript.");
    } catch {
      setStatus("Could not share the transcript.");
    }
  }, [botName, transcript]);

  const actions: BotComposerAction[] = useMemo(() => {
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
        onSelect: () => {
          setTranscript(initTranscript());
          setStatus(undefined);
        },
      },
      {
        id: "watch",
        icon: <Broadcast className="size-4" />,
        title: watching ? "Stop watching" : "Watch computer",
        subtitle: watching
          ? "Stop pulling screen frames"
          : "Pull the computer screen when a machine is open",
        onSelect: () => onToggleWatch?.(),
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
        onSelect: () => {
          if (sessionId) abortGeneration(sessionId);
        },
      });
    }
    return rows;
  }, [abortGeneration, handleShare, isStreaming, onToggleWatch, sessionId, watching]);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[var(--shell-frame-bg)] text-[var(--shell-item-fg)]">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const name = e.target.files?.[0]?.name;
          e.target.value = "";
          if (name) setStatus(`Attached ${name}. Sending files is not wired yet.`);
        }}
      />

      <div
        className="shrink-0 flex flex-col items-center gap-2 px-3 pb-2"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {pending.length > 0 ? (
          <ApprovalPill
            approvals={pending}
            accentColor={accent}
            onAnswer={(approvalId, optionId) => apply(approvalAnswerToEvent(approvalId, optionId))}
          />
        ) : null}

        <header className="flex min-h-[44px] w-full items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex size-[44px] shrink-0 items-center justify-center rounded-full border-none bg-transparent cursor-pointer"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold">{botName}</div>
            {bot?.tagline ? (
              <div className="truncate text-[12px] text-[var(--text-secondary)]">{bot.tagline}</div>
            ) : null}
          </div>
          {pending.length > 0 ? <WaitingOnYouPill accentColor={accent} /> : null}
        </header>
      </div>

      <BotTranscript
        transcript={transcript}
        className="min-h-0 flex-1 overflow-y-auto"
        onApprovalAnswer={(approvalId, optionId) => apply(approvalAnswerToEvent(approvalId, optionId))}
      />

      <div
        className="shrink-0 px-3 pt-1"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        data-bot-composer
      >
        <BotComposer
          onSend={(text) => void handleSend(text)}
          suggestions={suggestions}
          commands={commands}
          actions={actions}
          status={status ?? (isStreaming ? "Sending…" : watching ? "Watching computer" : undefined)}
          placeholder={`Message ${botName}`}
          busy={isStreaming}
        />
      </div>
    </div>
  );
}
