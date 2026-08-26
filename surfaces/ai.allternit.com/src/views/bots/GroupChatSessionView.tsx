'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  PaperPlaneTilt,
  User,
  CircleNotch,
  UsersThree,
  CaretLeft,
  Copy,
} from '@phosphor-icons/react';

import {
  MODE_COLORS,
  TEXT,
} from '@/design/allternit.tokens';

import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { UnifiedMessageRenderer } from '@/components/ai-elements/UnifiedMessageRenderer';
import { parseStructuredContent } from '@/lib/ai/rust-stream-adapter-extended';
import { useAgentStore } from '@/lib/agents/agent.store';
import { getBotDisplayName, getBotTagline } from '@/lib/bots/bot-profile';
import { useGroupChatStore } from '@/lib/bots/group-chat.store';
import { runGroupChatTurn } from '@/lib/bots/group-chat-turn-runner';
import { BotAvatar } from '@/views/bots/BotAvatar';
import { cn } from '@/lib/utils';
import type { ModeSessionMessage } from '@/lib/agents/mode-session-store';
import { AgentSessionLayout, CanvasPanel } from '@/views/agent-sessions/AgentSessionLayout';
import type { Agent } from '@/lib/agents/agent.types';

interface GroupChatSessionViewProps {
  sessionId: string;
  onClose?: () => void;
}

type SpeakerKey = string;

function getSpeakerKey(message: ModeSessionMessage): SpeakerKey {
  if (message.role === 'user') return 'user';
  return (
    (message.metadata?.botId as string | undefined) ??
    (message.metadata?.agentId as string | undefined) ??
    'assistant'
  );
}

function buildMessageClusters(messages: ModeSessionMessage[]) {
  const clusters: { speakerKey: SpeakerKey; messages: ModeSessionMessage[] }[] = [];
  for (const message of messages) {
    const key = getSpeakerKey(message);
    const last = clusters[clusters.length - 1];
    if (last && last.speakerKey === key) {
      last.messages.push(message);
    } else {
      clusters.push({ speakerKey: key, messages: [message] });
    }
  }
  return clusters;
}

export function GroupChatSessionView({ sessionId, onClose }: GroupChatSessionViewProps) {
  const mode = 'chat';
  const modeColors = MODE_COLORS[mode];

  const sessions = useChatSessionStore((s) => s.sessions);
  const session = useMemo(
    () => sessions.find((s) => s.id === sessionId) ?? null,
    [sessions, sessionId]
  );
  const messages = session?.messages ?? [];

  const groupId = session?.metadata?.groupId as string | undefined;
  const group = useGroupChatStore(
    useCallback((state) => (groupId ? state.groups[groupId] : undefined), [groupId])
  );

  const agents = useAgentStore((s) => s.agents);
  const memberBots = useMemo(() => {
    if (!group) return [];
    return group.members
      .map((m) => agents.find((a) => a.id === m.botId))
      .filter(Boolean) as Agent[];
  }, [group, agents]);

  const sendMessageStream = useChatSessionStore((s) => s.sendMessageStream);
  const setStreamingBySession = useChatSessionStore((s) => s.setStreamingBySession);
  const streamingState = useChatSessionStore((s) => s.streamingBySession?.[sessionId]);
  const isStreaming = streamingState?.isStreaming ?? false;

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isGroupChat = Boolean(session?.metadata?.isGroupChat);
  const groupName = group?.name ?? session?.name ?? 'Group Chat';

  const clusters = useMemo(() => buildMessageClusters(messages), [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isStreaming]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming || !sessionId) return;
    const text = input.trim();
    setInput('');

    if (isGroupChat) {
      setStreamingBySession(sessionId, true);
      try {
        await runGroupChatTurn(sessionId, text);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Group chat send failed:', error);
      } finally {
        setStreamingBySession(sessionId, false);
      }
      return;
    }

    try {
      await sendMessageStream(sessionId, { text });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Group chat send failed:', error);
    }
  }, [input, isStreaming, sessionId, sendMessageStream, setStreamingBySession, isGroupChat]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend]
  );

  const working = isStreaming;

  if (!session) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-[var(--text-secondary)]">
        <p className="text-sm">Group chat session not found.</p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white"
          >
            <CaretLeft size={14} weight="bold" />
            Back
          </button>
        )}
      </div>
    );
  }

  return (
    <AgentSessionLayout
      mode={mode}
      title="Group Chat"
      agentName={groupName}
      status={working ? 'streaming' : 'idle'}
      onClose={onClose}
      headerActions={
        <div className="flex items-center gap-3">
          <div className="flex shrink-0 -space-x-2">
            {memberBots.slice(0, 4).map((bot) => (
              <div key={bot.id} className="relative rounded-full border-2 border-[var(--bg-primary)]">
                <BotAvatar bot={bot} size={22} className="rounded-full" />
              </div>
            ))}
            {memberBots.length > 4 && (
              <div className="flex size-[22px] items-center justify-center rounded-full border-2 border-[var(--bg-primary)] bg-[var(--surface-hover)] text-[9px] font-medium text-[var(--text-secondary)]">
                +{memberBots.length - 4}
              </div>
            )}
          </div>
          <span className="hidden text-[11px] text-[var(--text-tertiary)] sm:inline">
            {memberBots.length} bot{memberBots.length === 1 ? '' : 's'}
          </span>
          {working && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
              <CircleNotch size={10} className="animate-spin" style={{ color: modeColors.accent }} />
              Working
            </span>
          )}
        </div>
      }
      computerView={<GroupMembersPanel mode={mode} bots={memberBots} groupName={groupName} />}
    >
      {/* Chat Interface */}
      <div
        className="flex flex-col h-full relative"
        style={{ background: '#0D0B09' }}
      >
        {/* Mode wash */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            background: `radial-gradient(120% 88% at 50% 0%, ${modeColors.fog} 0%, transparent 58%)`,
          }}
        />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-[1]">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full space-y-6">
              <div className="flex flex-wrap items-center justify-center gap-2">
                {memberBots.map((bot) => (
                  <BotAvatar
                    key={bot.id}
                    bot={bot}
                    size={48}
                    className="rounded-full border-2 border-[var(--bg-primary)]"
                  />
                ))}
                {memberBots.length === 0 && (
                  <div className="flex size-12 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--text-secondary)]">
                    <UsersThree size={24} weight="bold" />
                  </div>
                )}
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2" style={{ color: TEXT.primary }}>
                  {groupName}
                </h3>
                <p className="text-sm" style={{ color: TEXT.secondary }}>
                  Start the conversation. Every bot in the group will see your message and can reply.
                </p>
              </div>
            </div>
          )}

          {clusters.map((cluster, clusterIndex) => (
            <GroupChatMessageCluster
              key={`${cluster.speakerKey}-${clusterIndex}`}
              cluster={cluster}
              bots={memberBots}
              isLast={clusterIndex === clusters.length - 1}
              mode={mode}
            />
          ))}

          {working && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 p-4"
            >
              <CircleNotch size={16} className="animate-spin" style={{ color: modeColors.accent }} />
              <span className="text-sm" style={{ color: TEXT.tertiary }}>
                Bots are thinking…
              </span>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          className="p-4 border-t relative z-[2]"
          style={{ borderColor: modeColors.border, background: 'var(--surface-panel)' }}
        >
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                aria-label="Message the group"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message the group…"
                rows={1}
                className="w-full px-4 py-3 rounded-xl outline-none resize-none"
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: `1px solid ${modeColors.border}`,
                  color: TEXT.primary,
                  minHeight: '48px',
                  maxHeight: '120px',
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!input.trim() || working}
              className="shrink-0 rounded-xl p-3 transition-all disabled:opacity-50"
              style={{ background: modeColors.accent, color: '#0D0B09' }}
              title="Send message"
            >
              {working ? (
                <CircleNotch size={20} className="animate-spin" />
              ) : (
                <PaperPlaneTilt size={20} weight="fill" />
              )}
            </button>
          </div>
        </div>
      </div>
    </AgentSessionLayout>
  );
}

function GroupChatMessageCluster({
  cluster,
  bots,
  mode,
}: {
  cluster: { speakerKey: SpeakerKey; messages: ModeSessionMessage[] };
  bots: Agent[];
  isLast: boolean;
  mode: 'chat';
}) {
  const modeColors = MODE_COLORS[mode];
  const isUser = cluster.speakerKey === 'user';
  const firstMessage = cluster.messages[0];
  const botId = isUser
    ? undefined
    : (firstMessage.metadata?.botId as string | undefined) ??
      (firstMessage.metadata?.agentId as string | undefined);
  const senderBot = botId ? bots.find((b) => b.id === botId) : undefined;
  const senderName = isUser
    ? 'You'
    : senderBot
      ? getBotDisplayName(senderBot)
      : (firstMessage.metadata?.displayName as string | undefined) ?? 'Assistant';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3', isUser ? 'flex-row-reverse' : '')}
    >
      {/* Avatar */}
      <div className="shrink-0 pt-1">
        {isUser ? (
          <div
            className="size-8 rounded-lg flex items-center justify-center"
            style={{ background: modeColors.soft }}
          >
            <User size={16} style={{ color: modeColors.accent }} />
          </div>
        ) : senderBot ? (
          <BotAvatar bot={senderBot} size={32} className="rounded-full" />
        ) : (
          <div className="size-8 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center">
            <UsersThree size={16} weight="bold" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className={cn('flex max-w-[80%] flex-col', isUser ? 'items-end' : 'items-start')}>
        {!isUser && (
          <span className="mb-1 text-[11px] font-medium" style={{ color: TEXT.tertiary }}>
            {senderName}
          </span>
        )}
        <div className="flex flex-col gap-1.5">
          {cluster.messages.map((message, index) => (
            <div
              key={message.id ?? `${cluster.speakerKey}-${index}`}
              className="inline-block px-4 py-3 rounded-2xl text-left text-sm"
              style={{
                background: isUser ? modeColors.soft : 'var(--surface-hover)',
                border: `1px solid ${isUser ? modeColors.border : 'transparent'}`,
                color: TEXT.primary,
                borderRadius: isUser
                  ? '20px 20px 4px 20px'
                  : '20px 20px 20px 4px',
              }}
            >
              {message.role === 'user' ? (
                <p className="whitespace-pre-wrap">{typeof message.content === 'string' ? message.content : ''}</p>
              ) : (
                <UnifiedMessageRenderer
                  parts={parseStructuredContent(message.content)}
                />
              )}
            </div>
          ))}
        </div>

        {/* Timestamp + copy for the last message in the cluster */}
        <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: TEXT.tertiary }}>
          <span>
            {new Date(cluster.messages[cluster.messages.length - 1]?.timestamp ?? Date.now()).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {!isUser && (
            <button
              type="button"
              className="hover:text-white transition-colors"
              onClick={() => void navigator.clipboard.writeText(
                cluster.messages.map((m) => m.content).join('\n\n')
              )}
            >
              <Copy size={12} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function GroupMembersPanel({
  mode,
  bots,
  groupName,
}: {
  mode: 'chat';
  bots: Agent[];
  groupName: string;
}) {
  const modeColors = MODE_COLORS[mode];

  return (
    <CanvasPanel title="Group Members" mode={mode}>
      <div className="flex flex-col gap-3">
        <div className="px-1 text-xs" style={{ color: TEXT.secondary }}>
          {groupName}
        </div>
        {bots.map((bot) => (
          <div
            key={bot.id}
            className="flex items-center gap-3 p-2 rounded-xl"
            style={{ background: 'var(--surface-hover)', border: `1px solid ${modeColors.border}` }}
          >
            <BotAvatar bot={bot} size={36} className="rounded-full" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: TEXT.primary }}>
                {getBotDisplayName(bot)}
              </div>
              <div className="text-xs truncate" style={{ color: TEXT.secondary }}>
                {getBotTagline(bot) || 'Group member'}
              </div>
            </div>
          </div>
        ))}
        {bots.length === 0 && (
          <div className="text-sm text-center py-4" style={{ color: TEXT.secondary }}>
            No bots in this group.
          </div>
        )}
      </div>
    </CanvasPanel>
  );
}

export default GroupChatSessionView;
