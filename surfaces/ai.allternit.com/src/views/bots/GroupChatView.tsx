"use client";

/**
 * Group Chat View
 *
 * Renders a single group channel: header with members/bulletin, scrollable
 * message log, and a composer. Sends user messages into the group-chat engine,
 * which runs bounded rounds through the mention-handoff service.
 *
 * @module GroupChatView
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAgentsWithSwarms } from "@/lib/agents";
import { useAgentStore } from "@/lib/agents/agent.store";
import { useStackProviders } from "@/lib/bots/use-stack-providers";
import {
  useGroupChatStore,
  type GroupChatState,
} from "@/lib/bots/group-chat.store";
import type { GroupChatMessage } from "@/lib/bots/group-chat.types";
import {
  runGroupChat,
  createMentionHandoffAdapter,
  type MemberTurnAdapter,
} from "@/lib/bots/group-chat.service";
import { getBotDisplayName } from "@/lib/bots/bot-profile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GlassSurface } from "@/design/GlassSurface";
import {
  ArrowLeft,
  Gear,
  Users,
  Folder,
  Robot,
  CircleNotch,
  Warning,
  X,
} from "@phosphor-icons/react";
import { BotAvatar } from "./BotAvatar";
import { GroupChatAvatar } from "./GroupChatAvatar";
import { GroupChatComposer } from "./GroupChatComposer";
import {
  GroupChatChannelDialog,
  type GroupChatChannelFormData,
} from "./GroupChatChannelDialog";

export interface GroupChatViewProps {
  groupId: string;
  onBack?: () => void;
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
  return `${day}d ago`;
}

const MESSAGE_PAGE_SIZE = 100;

export function GroupChatView({ groupId, onBack }: GroupChatViewProps) {
  const group = useGroupChatStore((s: GroupChatState) => s.groups[groupId]);
  const addMessage = useGroupChatStore((s: GroupChatState) => s.addMessage);
  const appendLog = useGroupChatStore((s: GroupChatState) => s.appendLog);
  const updateGroup = useGroupChatStore((s: GroupChatState) => s.updateGroup);
  const markGroupRead = useGroupChatStore((s: GroupChatState) => s.markGroupRead);
  const setActiveGroup = useGroupChatStore((s: GroupChatState) => s.setActiveGroup);

  const agents = useAgentsWithSwarms();
  const { stackedAgents } = useStackProviders();
  const sendMail = useAgentStore((s) => s.sendMail);
  const fetchMail = useAgentStore((s) => s.fetchMail);
  const acknowledgeMail = useAgentStore((s) => s.acknowledgeMail);

  const fetchMailForGroup = useCallback(
    async (agentId: string) => {
      await fetchMail(agentId);
      return useAgentStore.getState().mail[agentId] ?? [];
    },
    [fetchMail]
  );

  const [isRunning, setIsRunning] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [visibleMessageCount, setVisibleMessageCount] = useState(MESSAGE_PAGE_SIZE);
  const [runError, setRunError] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveGroup(groupId);
    markGroupRead(groupId);
    setVisibleMessageCount(MESSAGE_PAGE_SIZE);
    return () => {
      setActiveGroup(null);
    };
  }, [groupId, setActiveGroup, markGroupRead]);

  useEffect(() => {
    if (group) {
      markGroupRead(groupId);
    }
  }, [group?.log.length, groupId, markGroupRead]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [group?.log.length]);

  const adapter = useMemo<MemberTurnAdapter>(() => {
    return createMentionHandoffAdapter({
      nativeAgents: agents,
      stackedAgents,
      sendMail,
      fetchMail: fetchMailForGroup,
      acknowledgeMail,
      senderName: "Group Chat",
      senderHandle: "group",
      mailReplyTimeoutMs: 30_000,
    });
  }, [agents, stackedAgents, sendMail, fetchMailForGroup, acknowledgeMail]);

  const memberMap = useMemo(() => {
    const map = new Map(
      group?.members.map((m) => [m.botId, m]) ?? []
    );
    return map;
  }, [group?.members]);

  const visibleLog = useMemo(
    () => group?.log.slice(-visibleMessageCount) ?? [],
    [group?.log, visibleMessageCount]
  );
  const hasMoreMessages = (group?.log.length ?? 0) > visibleMessageCount;

  const handleSend = useCallback(
    async (text: string) => {
      if (!group || isRunning) return;

      const userMessage: GroupChatMessage = {
        id: `gcm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        from: "user",
        displayName: "You",
        text,
      };

      // Optimistically write the user message to the store so it renders
      // immediately, and build an updated group snapshot for the engine so the
      // prompt history includes the message just sent.
      addMessage(groupId, userMessage);
      const groupWithUserMessage = {
        ...group,
        log: [...group.log, userMessage],
      };

      setIsRunning(true);
      setRunError(null);
      try {
        const result = await runGroupChat(
          {
            group: groupWithUserMessage,
            userText: text,
          },
          adapter
        );
        const replies = result.rounds.flatMap((r) => r.replies);
        if (replies.length > 0) {
          appendLog(groupId, replies);
        }
        if (result.failedMemberIds && result.failedMemberIds.length > 0) {
          const names = result.failedMemberIds
            .map((id) => memberMap.get(id)?.displayName ?? id)
            .join(", ");
          setRunError(`${names} failed to respond.`);
        }
      } catch (err) {
        console.error("[GroupChatView] run failed:", err);
        setRunError("The group round failed to complete. Try again or @mention a specific bot.");
      } finally {
        setIsRunning(false);
      }
    },
    [group, groupId, isRunning, addMessage, appendLog, adapter]
  );

  const handleSaveChannel = useCallback(
    (data: GroupChatChannelFormData) => {
      if (!group) return;
      updateGroup(groupId, {
        name: data.name,
        members: data.members,
        metadata: data.metadata,
      });
    },
    [group, groupId, updateGroup]
  );

  if (!group) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-[var(--text-secondary)]">
        <Robot size={48} weight="duotone" className="mb-4 opacity-40" />
        <p className="text-sm">Channel not found.</p>
        {onBack && (
          <Button variant="outline" size="sm" onClick={onBack} className="mt-4">
            Go back
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[var(--bg-elevated)] text-[var(--text-primary)] pt-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-panel)] px-4 py-3">
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
          <GroupChatAvatar
            name={group.name}
            members={group.members}
            size={44}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold">{group.name}</h2>
              <span className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] bg-[var(--surface-hover)] rounded-full px-1.5 py-0.5">
                <Users size={11} />
                {group.members.length}
              </span>
            </div>
            {group.metadata?.bulletin ? (
              <p className="truncate text-xs text-[var(--text-secondary)]">
                {group.metadata.bulletin}
              </p>
            ) : (
              <p className="truncate text-xs text-[var(--text-tertiary)]">
                {group.members.map((m) => m.displayName).join(", ")}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {group.metadata?.workingFolder && (
            <div
              className="hidden sm:flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-secondary)]"
              title={group.metadata.workingFolder}
            >
              <Folder size={12} />
              <span className="max-w-[140px] truncate">
                {group.metadata.workingFolder}
              </span>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowEditDialog(true)}
            aria-label="Channel settings"
          >
            <Gear size={18} />
          </Button>
        </div>
      </div>

      {/* Member rail */}
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface-panel)] px-4 py-2 overflow-x-auto">
        {group.members.map((member) => {
          const agent = agents.find((a) => a.id === member.botId);
          const isDefault = group.metadata?.defaultResponderId === member.botId;
          return (
            <div
              key={member.botId}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] text-[var(--text-secondary)] shrink-0 transition-colors",
                isDefault
                  ? "border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/8 text-[var(--accent-primary)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:border-[var(--border-default)]"
              )}
              title={isDefault ? "Default responder" : member.displayName}
            >
              {agent ? (
                <BotAvatar bot={agent} size={16} />
              ) : (
                <GroupChatAvatar name={member.displayName} size={16} />
              )}
              <span className="truncate max-w-[100px]">{member.displayName}</span>
              {isDefault && (
                <span className="text-[10px] opacity-80 font-medium">default</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Message log */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {group.log.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-6 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
              <Users size={24} weight="duotone" />
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Welcome to #{group.name}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
              Send a message to start the group round. Bots pass by default unless
              @mentioned or pulled in by another member.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {hasMoreMessages && (
              <button
                type="button"
                onClick={() => setVisibleMessageCount((c) => c + MESSAGE_PAGE_SIZE)}
                className="mx-auto text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] py-1 px-3 rounded-full border border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                Load earlier messages
              </button>
            )}
            {visibleLog.map((message) => {
              const isUser = message.from === "user";
              const member = memberMap.get(message.botId ?? "");
              const agent =
                message.botId && !member?.providerId
                  ? agents.find((a) => a.id === message.botId)
                  : undefined;

              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    isUser ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div className="shrink-0 pt-0.5">
                    {isUser ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-primary)] text-[11px] font-semibold text-[var(--ui-text-inverse)]">
                        You
                      </div>
                    ) : agent ? (
                      <BotAvatar bot={agent} size={32} />
                    ) : (
                      <GroupChatAvatar
                        name={member?.displayName ?? message.displayName ?? "Bot"}
                        size={32}
                      />
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
                        {isUser
                          ? "You"
                          : message.displayName ?? member?.displayName ?? "Bot"}
                      </span>
                      <span>{relativeTime(message.timestamp)}</span>
                    </div>
                    <div
                      className={cn(
                        "mt-1 whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm",
                        isUser
                          ? "rounded-tr-none bg-[var(--accent-chat)] text-[var(--ui-text-inverse)]"
                          : "rounded-tl-none border border-[var(--border-subtle)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                      )}
                    >
                      {message.text}
                    </div>
                  </div>
                </div>
              );
            })}
            {isRunning && (
              <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-tertiary)] py-1">
                <CircleNotch size={14} className="animate-spin" />
                Bots are thinking…
              </div>
            )}
            <div ref={logEndRef} />
          </div>
        )}
      </div>

      {/* Error banner */}
      {runError && (
        <div className="flex items-center justify-between gap-3 border-t border-[var(--status-error)]/20 bg-[var(--status-error)]/8 px-4 py-2 text-xs text-[var(--status-error)]">
          <div className="flex items-center gap-2">
            <Warning size={14} weight="fill" />
            <span>{runError}</span>
          </div>
          <button
            type="button"
            onClick={() => setRunError(null)}
            className="rounded p-1 hover:bg-[var(--status-error)]/10"
            aria-label="Dismiss error"
          >
            <X size={12} weight="bold" />
          </button>
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-[var(--border-subtle)] p-3">
        <GroupChatComposer
          group={group}
          onSend={handleSend}
          isLoading={isRunning}
          placeholder={`Message #${group.name}…`}
        />
      </div>

      <GroupChatChannelDialog
        group={group}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSave={handleSaveChannel}
      />
    </div>
  );
}

export default GroupChatView;
