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

  const [isRunning, setIsRunning] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveGroup(groupId);
    markGroupRead(groupId);
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
      fetchMail,
      acknowledgeMail,
      senderName: "Group Chat",
      senderHandle: "group",
      mailReplyTimeoutMs: 30_000,
    });
  }, [agents, stackedAgents, sendMail, fetchMail, acknowledgeMail]);

  const memberMap = useMemo(() => {
    const map = new Map(
      group?.members.map((m) => [m.botId, m]) ?? []
    );
    return map;
  }, [group?.members]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!group || isRunning) return;

      addMessage(groupId, {
        from: "user",
        displayName: "You",
        text,
      });

      setIsRunning(true);
      try {
        const result = await runGroupChat(
          {
            group: { ...group, log: [...group.log] },
            userText: text,
          },
          adapter
        );
        const replies = result.rounds.flatMap((r) => r.replies);
        if (replies.length > 0) {
          appendLog(groupId, replies);
        }
      } catch (err) {
        console.error("[GroupChatView] run failed:", err);
        addMessage(groupId, {
          from: "bot",
          displayName: "Group Chat",
          text: "The group round failed to complete. Try again or @mention a specific bot.",
        });
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
    <div className="flex h-full flex-col bg-[var(--bg-elevated)] text-[var(--text-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
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
            size={40}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold">{group.name}</h2>
              <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                <Users size={12} />
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
              className="hidden sm:flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--text-secondary)]"
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
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-2 overflow-x-auto">
        {group.members.map((member) => {
          const agent = agents.find((a) => a.id === member.botId);
          return (
            <div
              key={member.botId}
              className={cn(
                "flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--text-secondary)] shrink-0",
                group.metadata?.defaultResponderId === member.botId &&
                  "border-[var(--accent-primary)]/50 text-[var(--accent-primary)]"
              )}
              title={
                group.metadata?.defaultResponderId === member.botId
                  ? "Default responder"
                  : member.displayName
              }
            >
              {agent ? (
                <BotAvatar bot={agent} size={16} />
              ) : (
                <GroupChatAvatar name={member.displayName} size={16} />
              )}
              <span className="truncate max-w-[100px]">{member.displayName}</span>
              {group.metadata?.defaultResponderId === member.botId && (
                <span className="text-[10px] opacity-70">default</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Message log */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {group.log.length === 0 ? (
          <GlassSurface
            intensity="thin"
            className="mx-auto max-w-md p-5 text-center"
          >
            <Users size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Welcome to #{group.name}
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Send a message to start the group round. Bots pass by default unless
              @mentioned or pulled in by another member.
            </p>
          </GlassSurface>
        ) : (
          <div className="flex flex-col gap-4">
            {group.log.map((message) => {
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
                  <div className="shrink-0">
                    {isUser ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)]">
                        Y
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
                    <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                      <span className="font-medium text-[var(--text-secondary)]">
                        {isUser
                          ? "You"
                          : message.displayName ?? member?.displayName ?? "Bot"}
                      </span>
                      <span>{relativeTime(message.timestamp)}</span>
                    </div>
                    <div
                      className={cn(
                        "mt-1 whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-relaxed",
                        isUser
                          ? "rounded-tr-none bg-[var(--accent-primary)] text-[var(--ui-text-inverse)]"
                          : "rounded-tl-none border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                      )}
                    >
                      {message.text}
                    </div>
                  </div>
                </div>
              );
            })}
            {isRunning && (
              <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                <CircleNotch size={14} className="animate-spin" />
                Bots are thinking…
              </div>
            )}
            <div ref={logEndRef} />
          </div>
        )}
      </div>

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
