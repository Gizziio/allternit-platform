/**
 * Group Chat Service
 *
 * Runs bounded serial rounds for bot group chats. When a user sends a message,
 * the engine resolves which members should respond, invokes each in turn via the
 * mention handoff service, and repeats up to a maximum number of rounds or
 * messages. Members may pass with "(pass)" to stay silent.
 *
 * @module group-chat.service
 */

import type {
  GroupChat,
  GroupChatMember,
  GroupChatMessage,
  GroupChatRunOptions,
  GroupChatRunResult,
  GroupChatRoundResult,
} from './group-chat.types';
import type { MentionHandoffOptions } from './mention-handoff.service';
import { executeMentionHandoff, parseMentions } from './mention-handoff.service';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('GroupChatService');

export const GROUP_CHAT_DEFAULTS = {
  maxRounds: 3,
  maxMessages: 10,
  turnTimeoutMs: 180_000,
};

/**
 * Parse @mentions from group chat text. Supports @name, @name-device,
 * display titles, and @everyone/@all.
 */
export function parseGroupChatMentions(text: string): string[] {
  const parsed = parseMentions(text);
  const names = parsed.map((m) => m.name.toLowerCase());
  if (text.toLowerCase().includes('@everyone') || text.toLowerCase().includes('@all')) {
    names.push('everyone');
  }
  return [...new Set(names)];
}

/**
 * Determine which members should respond in the next round.
 *
 * - If @everyone/@all is present, or no member mentions since the last user
 *   message, everyone responds.
 * - Otherwise only explicitly @mentioned members respond.
 */
export function resolveGroupResponders(
  text: string,
  members: GroupChatMember[],
  log: GroupChatMessage[],
): GroupChatMember[] {
  const mentions = parseGroupChatMentions(text);
  const everyone = mentions.includes('everyone');

  if (everyone) {
    return members;
  }

  // Find the index of the last user message.
  const lastUserIndex = [...log].reverse().findIndex((m) => m.from === 'user');
  const sinceUser =
    lastUserIndex === -1 ? log : log.slice(log.length - lastUserIndex);

  const mentionedSinceUser = new Set<string>();
  for (const message of sinceUser) {
    if (message.from === 'user') continue;
    const names = parseGroupChatMentions(message.text);
    for (const name of names) {
      mentionedSinceUser.add(name);
    }
  }

  // If no member has been mentioned since the last user message, everyone.
  if (mentionedSinceUser.size === 0) {
    return members;
  }

  // Otherwise, members mentioned in the triggering text plus anyone pulled in
  // by another bot since the last user message.
  const targetNames = new Set([...mentions, ...mentionedSinceUser]);
  return members.filter(
    (m) =>
      targetNames.has(m.handle.toLowerCase()) ||
      targetNames.has(m.displayName.toLowerCase()) ||
      targetNames.has(m.botId.toLowerCase()),
  );
}

function isPassText(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return trimmed === '' || trimmed === '(pass)' || trimmed === 'pass' || trimmed === 'pass.';
}

function rotateMembers<T>(items: T[], offset: number): T[] {
  return [...items.slice(offset), ...items.slice(0, offset)];
}

export interface MemberTurnAdapter {
  /** Invoke a single member turn and return the reply text (or undefined if passed). */
  runTurn: (member: GroupChatMember, prompt: string) => Promise<string | undefined>;
}

/**
 * Build a mention-handoff based adapter for member turns.
 */
export function createMentionHandoffAdapter(
  baseOptions: Omit<MentionHandoffOptions, 'text'>,
): MemberTurnAdapter {
  return {
    runTurn: async (member, prompt) => {
      const result = await executeMentionHandoff({
        ...baseOptions,
        text: `@${member.handle} ${prompt}`,
        senderName: 'Group Chat',
        senderHandle: 'group',
      });
      const reply = result.replies[0];
      if (!reply || reply.error) return undefined;
      return reply.reply;
    },
  };
}

/**
 * Run a group chat from a user message.
 */
export async function runGroupChat(
  options: GroupChatRunOptions,
  adapter: MemberTurnAdapter,
): Promise<GroupChatRunResult> {
  const {
    group,
    userText,
    maxRounds = GROUP_CHAT_DEFAULTS.maxRounds,
    maxMessages = GROUP_CHAT_DEFAULTS.maxMessages,
  } = options;

  const result: GroupChatRunResult = { rounds: [], settled: false, failedMemberIds: [] };
  let messageCount = 0;
  let roundOffset = 0;

  for (let round = 1; round <= maxRounds; round++) {
    const responders = resolveGroupResponders(userText, group.members, group.log);
    if (responders.length === 0) {
      result.settled = true;
      break;
    }

    // Rotate order each round so the same bot does not always lead.
    const ordered = rotateMembers(responders, roundOffset % responders.length);
    const replies: GroupChatMessage[] = [];
    let allPassed = true;

    for (const member of ordered) {
      if (messageCount >= maxMessages) {
        result.stopReason = 'max_messages';
        return result;
      }

      const prompt = buildMemberPrompt(group, member, userText, round);

      try {
        const replyText = await adapter.runTurn(member, prompt);
        if (replyText === undefined || isPassText(replyText)) {
          continue;
        }
        allPassed = false;
        messageCount++;
        replies.push({
          id: `gcm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          from: 'bot',
          botId: member.botId,
          displayName: member.displayName,
          text: replyText,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        logger.error({ err, member: member.botId, group: group.id }, 'Member turn failed');
        result.failedMemberIds = result.failedMemberIds ?? [];
        if (!result.failedMemberIds.includes(member.botId)) {
          result.failedMemberIds.push(member.botId);
        }
      }
    }

    const roundResult: GroupChatRoundResult = { round, replies, allPassed };
    result.rounds.push(roundResult);

    if (allPassed) {
      result.settled = true;
      break;
    }

    roundOffset++;
  }

  if (!result.settled && !result.stopReason) {
    result.stopReason = 'max_rounds';
  }

  return result;
}

function buildMemberPrompt(
  group: GroupChat,
  member: GroupChatMember,
  userText: string,
  round: number,
): string {
  const memberNames = group.members.map((m) => m.displayName).join(', ');
  const history = group.log
    .slice(-20)
    .map((m) => `${m.displayName ?? 'User'}: ${m.text}`)
    .join('\n');

  return [
    `You are in a group chat named "${group.name}" with: ${memberNames}.`,
    '',
    'Recent conversation:',
    history,
    '',
    `The user said: ${userText}`,
    '',
    `This is round ${round}. Reply briefly, or say "(pass)" to stay silent.`,
    `You may @mention another member to pull them into the next round.`,
    `Escalate to @user if a real human judgment is needed.`,
  ].join('\n');
}
