"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAgentStore } from "@/lib/agents/agent.store";
import { useCommRailsMailStore } from "@/lib/bots/comrails-mail.store";
import type { Agent, AgentMailMessage, AgentMailThread } from "@/lib/agents/agent.types";
import { getBotAccentColor, getBotDisplayName, isBot } from "@/lib/bots/bot-profile";
import {
  CaretLeft,
  EnvelopeSimple,
  PaperPlaneTilt,
  Plus,
  Robot,
  Spinner,
  Check,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GlassSurface } from "@/design/GlassSurface";
import { cn } from "@/lib/utils";

interface BotInboxViewProps {
  botId: string;
}

function botInitials(name: string): string {
  return (name || "Bot")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
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
  if (mo < 12) return mo === 1 ? "1 month ago" : `${mo} months ago`;
  const yr = Math.floor(mo / 12);
  return yr === 1 ? "1 year ago" : `${yr} years ago`;
}

export function BotInboxView({ botId }: BotInboxViewProps) {
  const { agents } = useAgentStore();
  const bot = useMemo(() => agents.find((a) => a.id === botId), [agents, botId]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const {
    messages: mail,
    threads,
    isLoading: loading,
    error,
    refreshInbox,
    sendMail,
    acknowledgeMail,
  } = useCommRailsMailStore();

  const load = useCallback(() => {
    if (!bot) return;
    void refreshInbox(bot.id, 100);
  }, [bot, refreshInbox]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSendMail = useCallback(
    async (fromAgentId: string, toAgentId: string, subject: string, body: string) => {
      const result = await sendMail(fromAgentId, {
        toAgentId,
        subject,
        body,
        priority: "normal",
      });
      if (result.sent) {
        load();
      }
    },
    [sendMail, load]
  );

  const handleAcknowledge = useCallback(
    async (_agentId: string, messageId: string) => {
      if (!bot) return;
      await acknowledgeMail(bot.id, messageId);
      load();
    },
    [bot, acknowledgeMail, load]
  );

  const handleBackToBotHome = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("allternit:open-view", {
        detail: { viewType: "bot-home", context: { botId } },
      })
    );
  }, [botId]);

  if (!bot || !isBot(bot)) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--text-secondary)]">
        <p>Bot not found.</p>
      </div>
    );
  }

  const displayName = getBotDisplayName(bot);
  const accentColor = getBotAccentColor(bot) ?? "var(--accent-primary)";
  const unreadCount = mail.filter((m) => m.status === "unread").length;

  return (
    <div className="h-full w-full flex flex-col bg-[var(--bg-elevated)] text-[var(--text-primary)] overflow-auto">
      <div className="w-full max-w-6xl mx-auto px-8 pt-10 pb-12 flex flex-col">
        {/* Breadcrumb */}
        <button
          type="button"
          onClick={handleBackToBotHome}
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-6 w-fit"
        >
          <CaretLeft size={14} />
          {displayName}
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div
              className="flex shrink-0 items-center justify-center rounded-2xl text-[20px] font-bold"
              style={{
                width: 64,
                height: 64,
                background: `color-mix(in srgb, ${accentColor} 18%, transparent)`,
                color: accentColor,
                border: `2px solid ${accentColor}35`,
              }}
            >
              {botInitials(displayName)}
            </div>
            <div>
              <h1
                className="text-3xl font-medium tracking-tight"
                style={{ fontFamily: "var(--font-serif)", color: "var(--text-primary)" }}
              >
                {displayName} Inbox
              </h1>
              <p className="text-[14px] text-[var(--text-secondary)] mt-0.5">
                @{bot.name} • {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            className="gap-1.5"
          >
            Refresh
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[var(--text-secondary)]">
            <Spinner size={32} className="animate-spin text-[var(--text-tertiary)]" />
            <p className="text-sm">Loading inbox…</p>
          </div>
        ) : error ? (
          <GlassSurface className="p-10 text-center rounded-xl">
            <Robot size={40} className="mx-auto mb-3 text-[var(--text-tertiary)] opacity-40" />
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">Agent messaging is not connected</h3>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
              {error}
            </p>
            <p className="text-[12px] text-[var(--text-tertiary)] mt-3 max-w-md mx-auto">
              When connected, this inbox becomes a group chat where bots can @mention each other,
              hand off work, and acknowledge requests.
            </p>
            <Button
              size="sm"
              onClick={() => void load()}
              className="mt-4 gap-1.5"
              style={{ background: accentColor, color: "#fff" }}
            >
              Retry
            </Button>
          </GlassSurface>
        ) : (
          <MailCenter
            bot={bot}
            agents={agents}
            mail={mail}
            threads={threads}
            selectedThreadId={selectedThreadId}
            onSelectThread={setSelectedThreadId}
            onSendMail={handleSendMail}
            onAcknowledge={handleAcknowledge}
            accentColor={accentColor}
          />
        )}
      </div>
    </div>
  );
}

function MailCenter({
  bot,
  agents,
  mail,
  threads,
  selectedThreadId,
  onSelectThread,
  onSendMail,
  onAcknowledge,
  accentColor,
}: {
  bot: Agent;
  agents: Agent[];
  mail: AgentMailMessage[];
  threads: AgentMailThread[];
  selectedThreadId: string | null;
  onSelectThread: (id: string | null) => void;
  onSendMail: (fromAgentId: string, toAgentId: string, subject: string, body: string) => Promise<void>;
  onAcknowledge: (agentId: string, messageId: string) => Promise<void>;
  accentColor: string;
}) {
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);

  const selectedThread = threads.find((t) => t.id === selectedThreadId);
  const threadMessages = selectedThreadId
    ? mail.filter((m) => m.threadId === selectedThreadId).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    : [];

  const otherAgents = agents.filter((a) => a.id !== bot.id && isBot(a));

  const handleSend = async () => {
    if (!composeTo || !composeSubject || !composeBody.trim()) return;
    setSending(true);
    try {
      await onSendMail(bot.id, composeTo, composeSubject, composeBody);
      setShowCompose(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-280px)] min-h-[500px]">
      {/* Threads list */}
      <GlassSurface className="w-full lg:w-80 shrink-0 rounded-xl flex flex-col overflow-hidden">
        <div className="p-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
            Threads ({threads.length})
          </h3>
          <button
            type="button"
            onClick={() => {
              setShowCompose(true);
              onSelectThread(null);
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: accentColor }}
          >
            <Plus size={12} weight="bold" />
            New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <EnvelopeSimple size={32} className="text-[var(--text-tertiary)] opacity-40 mb-2" />
              <p className="text-[13px] text-[var(--text-secondary)]">No bot conversations yet</p>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-1 max-w-[220px]">
                This is a group chat for your bots. Compose a message to another bot to delegate work or start a thread.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {threads.map((thread) => {
                const isSelected = selectedThreadId === thread.id;
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => {
                      onSelectThread(thread.id);
                      setShowCompose(false);
                    }}
                    className={cn(
                      "text-left p-3 rounded-lg border transition-colors",
                      isSelected
                        ? "border-[var(--palette-border)] bg-[var(--palette-soft)]"
                        : "border-transparent bg-transparent hover:bg-[var(--surface-hover)]"
                    )}
                    style={
                      isSelected
                        ? ({
                            "--palette-border": `${accentColor}40`,
                            "--palette-soft": `color-mix(in srgb, ${accentColor} 12%, transparent)`,
                          } as React.CSSProperties)
                        : {}
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                        {thread.subject}
                      </div>
                      {thread.unreadCount > 0 && (
                        <span className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white"
                          style={{ background: accentColor }}
                        >
                          {thread.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--text-tertiary)] mt-1">
                      {thread.messageCount} message{thread.messageCount === 1 ? "" : "s"} • {relativeTime(thread.lastMessageAt)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </GlassSurface>

      {/* Message pane */}
      <GlassSurface className="flex-1 rounded-xl flex flex-col overflow-hidden">
        {showCompose ? (
          <div className="flex flex-col h-full p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Compose message</h2>
              <button
                type="button"
                onClick={() => setShowCompose(false)}
                className="text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                  Recipient
                </label>
                <select
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)]"
                >
                  <option value="">Select a bot</option>
                  {otherAgents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {getBotDisplayName(a)} (@{a.name})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                  Subject
                </label>
                <Input
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Topic of discussion"
                  className="h-10 bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                  Message
                </label>
                <Textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your message…"
                  rows={8}
                  className="resize-none bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                onClick={() => void handleSend()}
                disabled={!composeTo || !composeSubject || !composeBody.trim() || sending}
                className="gap-1.5"
                style={{ background: accentColor, color: "#fff" }}
              >
                <PaperPlaneTilt size={14} weight="fill" />
                {sending ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        ) : selectedThread ? (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
                  {selectedThread.subject}
                </h2>
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  {selectedThread.messageCount} message{selectedThread.messageCount === 1 ? "" : "s"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCompose(true)}
                className="gap-1.5"
              >
                <PaperPlaneTilt size={14} />
                Reply
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {threadMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[var(--text-secondary)] text-sm">
                  No messages in this thread.
                </div>
              ) : (
                threadMessages.map((message) => (
                  <MessageCard
                    key={message.id}
                    message={message}
                    accentColor={accentColor}
                    onAcknowledge={() => onAcknowledge(bot.id, message.id)}
                  />
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <EnvelopeSimple size={48} className="text-[var(--text-tertiary)] opacity-40 mb-4" />
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
              Select a thread
            </h3>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1 mb-4 max-w-sm">
              Choose a conversation from the list, or start a new one by messaging another bot.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCompose(true)}
              className="gap-1.5"
            >
              <Plus size={14} />
              New message
            </Button>
          </div>
        )}
      </GlassSurface>
    </div>
  );
}

function MessageCard({
  message,
  accentColor,
  onAcknowledge,
}: {
  message: AgentMailMessage;
  accentColor: string;
  onAcknowledge: () => void;
}) {
  const isUnread = message.status === "unread";
  const isAcknowledged = message.status === "acknowledged";

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        isUnread
          ? "border-[var(--palette-border)] bg-[var(--palette-soft)]"
          : "border-[var(--border-subtle)] bg-[var(--bg-card)]"
      )}
      style={
        isUnread
          ? ({
              "--palette-border": `${accentColor}40`,
              "--palette-soft": `color-mix(in srgb, ${accentColor} 8%, transparent)`,
            } as React.CSSProperties)
          : {}
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[13px] font-semibold text-[var(--text-primary)]">
              {message.subject}
            </span>
            {isUnread && (
              <span
                className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white"
                style={{ background: accentColor }}
              >
                NEW
              </span>
            )}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)]">
            From{" "}
            <span className="font-medium text-[var(--text-primary)]">
              {message.fromAgentName || message.fromAgentId}
            </span>{" "}
            • {relativeTime(message.timestamp)}
          </div>
          <p className="text-[13px] mt-2 leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
            {message.body}
          </p>
        </div>
        {message.requiresAck && !isAcknowledged && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void onAcknowledge()}
            className="shrink-0 gap-1.5"
          >
            <Check size={14} />
            Acknowledge
          </Button>
        )}
      </div>
    </div>
  );
}
