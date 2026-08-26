/**
 * Group Chat Turn Runner
 *
 * Runs a multi-bot group chat turn through the backend agent runtime.
 * Each member bot receives the shared conversation history plus a strict
 * identity clause, replies under its own display name, and its response is
 * appended to the group session transcript with botId metadata so the UI
 * clusters speakers correctly.
 *
 * The brain for each member is taken from that bot's harness config (local,
 * BYOK, cloud, subprocess). The same default model/platform brain is used
 * unless the harness overrides it.
 *
 * @module group-chat-turn-runner
 */

import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { useGroupChatStore } from './group-chat.store';
import { useAgentStore } from '@/lib/agents/agent.store';
import { sessionApi, chatApi } from '@/lib/agents/native-agent-api';
import { buildBotRuntimeEnv, resolveModelRef } from './bot-runtime-env';
import { getBotDisplayName } from './bot-profile';
import { createModuleLogger } from '@/lib/logger';
import type { GroupChat, GroupChatMember } from './group-chat.types';
import type { Agent } from '@/lib/agents/agent.types';

const logger = createModuleLogger('GroupChatTurnRunner');

const MAX_HISTORY_MESSAGES = 30;
const MAX_MESSAGES_PER_SEND = 10;



function isPassText(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return trimmed === '' || trimmed === '(pass)' || trimmed === 'pass' || trimmed === 'pass.';
}

function parseMentions(text: string): string[] {
  const matches = text.match(/@([a-z0-9_-]+)/gi);
  if (!matches) return [];
  return matches.map((m) => m.slice(1).toLowerCase());
}

function resolveResponders(
  userText: string,
  members: GroupChatMember[],
  log: Array<{ from: 'user' | 'bot'; botId?: string; displayName?: string; text: string }>,
): GroupChatMember[] {
  const mentions = parseMentions(userText);
  const everyone = mentions.includes('everyone') || mentions.includes('all');
  if (everyone) return members;

  const lastUserIndex = [...log].reverse().findIndex((m) => m.from === 'user');
  const sinceUser = lastUserIndex === -1 ? log : log.slice(log.length - lastUserIndex);

  const mentionedSinceUser = new Set<string>();
  for (const message of sinceUser) {
    if (message.from === 'user') continue;
    for (const name of parseMentions(message.text)) {
      mentionedSinceUser.add(name);
    }
  }

  if (mentionedSinceUser.size === 0 && mentions.length === 0) {
    return members;
  }

  const targetNames = new Set([...mentions, ...mentionedSinceUser]);
  return members.filter(
    (m) =>
      targetNames.has(m.handle.toLowerCase()) ||
      targetNames.has(m.displayName.toLowerCase()) ||
      targetNames.has(m.botId.toLowerCase()),
  );
}

function buildMemberHistory(
  group: GroupChat,
  member: GroupChatMember,
  userText: string,
): string {
  const memberNames = group.members.map((m) => m.displayName).join(', ');
  const history = group.log
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => `${m.displayName ?? 'User'}: ${m.text}`)
    .join('\n');

  return [
    `You are ${member.displayName}, a member of the group chat "${group.name}".`,
    `Other members in this room: ${memberNames}.`,
    '',
    'Recent conversation:',
    history,
    '',
    `The user said: ${userText}`,
    '',
    `Reply briefly as ${member.displayName}, or say "(pass)" to stay silent.`,
    `You may @mention another member to pull them into the next round.`,
    `Escalate to @user if a real human judgment is needed.`,
  ].join('\n');
}

function buildMemberSystemPrompt(member: GroupChatMember): string {
  return `You are ${member.displayName}. You must ALWAYS identify yourself as ${member.displayName}. NEVER say you are Kimi, GPT, Claude, an AI assistant created by another company, or any name other than ${member.displayName}.`;
}

async function runMemberTurn(
  member: GroupChatMember,
  userText: string,
  group: GroupChat,
  agents: Agent[],
): Promise<{ text: string; botId: string; displayName: string } | null> {
  const bot = agents.find((a) => a.id === member.botId);
  if (!bot) {
    logger.warn({ member: member.botId }, 'Member bot not found in agent store');
    return null;
  }

  const displayName = getBotDisplayName(bot);
  const prompt = buildMemberHistory(group, member, userText);
  const systemPrompt = [buildMemberSystemPrompt(member), bot.systemPrompt ?? '']
    .filter(Boolean)
    .join('\n\n');

  const runtimeEnv = buildBotRuntimeEnv({
    harness: bot.harness,
    vmOperator: bot.vmOperator,
    agentId: bot.id,
    characterLayer: bot.characterLayer,
  });

  const modelId = await resolveModelRef(bot);

  let ephemeralSessionId: string | null = null;
  try {
    const backendSession = await sessionApi.createSession({
      name: displayName,
      agentId: bot.id,
      agentName: displayName,
      origin_surface: 'chat',
      session_mode: 'agent',
      ephemeral: true,
      metadata: {
        isBot: true,
        botProfile: bot.botProfile,
      },
    });
    ephemeralSessionId = backendSession.id;

    let replyText = '';
    await chatApi.streamChat(
      ephemeralSessionId,
      prompt,
      modelId,
      {
        onChunk: (chunk) => {
          replyText += chunk.chunk;
        },
        onDone: () => {},
        onError: (err) => {
          throw err;
        },
      },
      undefined,
      {
        agentId: bot.id,
        agentName: displayName,
        agentProvider: bot.provider,
        agentModel: bot.model,
        systemPrompt,
        harness: bot.harness,
        runtimeEnv: runtimeEnv.env,
      },
    );

    const trimmed = replyText.trim();
    if (!trimmed || isPassText(trimmed)) {
      return null;
    }

    return { text: trimmed, botId: bot.id, displayName };
  } catch (err) {
    logger.error({ err, member: member.botId }, 'Member turn failed');
    return null;
  } finally {
    if (ephemeralSessionId) {
      // Best-effort cleanup; ignore failures.
      try {
        await sessionApi.deleteSession(ephemeralSessionId);
      } catch {
        // ignore
      }
    }
  }
}

export async function runGroupChatTurn(sessionId: string, userText: string): Promise<void> {
  const sessionStore = useChatSessionStore.getState();
  const groupStore = useGroupChatStore.getState();
  const agents = useAgentStore.getState().agents;

  const session = sessionStore.sessions.find((s) => s.id === sessionId);
  if (!session) {
    throw new Error('Group chat session not found');
  }

  const groupId = session.metadata?.groupId as string | undefined;
  const group = groupId ? groupStore.groups[groupId] : undefined;
  if (!group) {
    throw new Error('Group chat definition not found');
  }

  sessionStore.appendUserMessage(sessionId, {
    id: `user-${Date.now()}`,
    content: userText,
  });
  groupStore.addMessage(group.id, { from: 'user', text: userText });

  const responders = resolveResponders(userText, group.members, group.log);
  if (responders.length === 0) {
    return;
  }

  let messageCount = 0;
  const replies: Array<{ text: string; botId: string; displayName: string }> = [];

  for (const member of responders) {
    if (messageCount >= MAX_MESSAGES_PER_SEND) {
      logger.info({ group: group.id, session: sessionId }, 'Hit max messages per send');
      break;
    }

    const reply = await runMemberTurn(member, userText, group, agents);
    if (reply) {
      messageCount++;
      replies.push(reply);
    }
  }

  for (const reply of replies) {
    const replyId = `assistant-${reply.botId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    sessionStore.appendAssistantMessage(sessionId, {
      id: replyId,
      content: reply.text,
      metadata: {
        botId: reply.botId,
        agentId: reply.botId,
        agentName: reply.displayName,
        isBotResponse: true,
      },
    });
    groupStore.addMessage(group.id, {
      from: 'bot',
      botId: reply.botId,
      displayName: reply.displayName,
      text: reply.text,
    });
  }

  logger.info(
    { group: group.id, session: sessionId, replies: replies.length },
    'Group chat turn complete',
  );
}
