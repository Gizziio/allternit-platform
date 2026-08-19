/**
 * Mention Handoff Service
 *
 * Detects `@botname` mentions in a user message, resolves them against the
 * unified roster (native Allternit bots + stacked external bots), and executes
 * a handoff. Native bots receive Rails mail; external provider bots are invoked
 * through their provider's `sendMessage`. Replies are collected and appended to
 * the active agent's prompt so the user gets a single synthesized response.
 *
 * @module mention-handoff.service
 */

import type { Agent } from '@/lib/agents/agent.types';
import { isBot, getBotDisplayName } from '@/lib/bots/bot-profile';
import type { StackedAgent } from '@/lib/bots/stacked-agent.service';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('MentionHandoff');

export interface MentionTarget {
  /** Raw mention text including the @ */
  mention: string;
  /** Bot name without the @ */
  name: string;
  /** Resolved agent, if any */
  agent?: Agent;
  /** Resolved stacked agent, if any */
  stacked?: StackedAgent;
}

export interface MentionReply {
  mention: string;
  displayName: string;
  providerId?: string;
  reply: string;
  error?: string;
}

export interface MentionHandoffResult {
  /** User text with @mentions stripped */
  cleanText: string;
  /** List of targets that were resolved */
  targets: MentionTarget[];
  /** Replies collected from each target */
  replies: MentionReply[];
  /** Ready-to-append handoff note for the active agent */
  handoffNote: string;
}

export interface MentionHandoffOptions {
  /** Text the user typed */
  text: string;
  /** Native Allternit agents */
  nativeAgents: Agent[];
  /** Stacked external agents */
  stackedAgents: StackedAgent[];
  /** Optional id of the agent currently handling the chat */
  activeAgentId?: string;
  /** Display name of the sender (active agent or user). */
  senderName?: string;
  /** Handle of the sender for attribution. */
  senderHandle?: string;
  /** Function used to send Rails mail to native bots */
  sendMail: (fromAgentId: string, toAgentId: string, subject: string, body: string) => Promise<void>;
  /** Function used to read native bot mail replies */
  fetchMail: (agentId: string) => Promise<
    Array<{
      id?: string;
      fromAgentId?: string;
      body?: string;
      subject?: string;
      status?: string;
    }>
  >;
  /** Optional function used to acknowledge a consumed native bot mail reply */
  acknowledgeMail?: (agentId: string, messageId: string) => Promise<void>;
  /** How long to wait for a native bot mail reply (ms). Default 5000. */
  mailReplyTimeoutMs?: number;
  /** Interval between native bot mail polls (ms). Default 250. */
  mailPollIntervalMs?: number;
}

const MENTION_RE = /(?:^|\s)@([a-z0-9][a-z0-9_\-\.]*)/gi;
const DEFAULT_SENDER_NAME = 'you';
const DEFAULT_SENDER_HANDLE = 'user';

/**
 * Shell-escape a value for use as a single quoted argument.
 */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\"'\"'")}'`;
}

/**
 * Shell-escape a value for interpolation inside an already double-quoted string.
 */
export function shellDoubleQuote(value: string): string {
  return value.replace(/[\\"`$]/g, '\\$&');
}

/**
 * Format a handoff message with Hermes-style attribution.
 */
export function formatAttributionMessage(
  senderName: string,
  senderHandle: string,
  message: string,
): string {
  return `Message from 🤖 ${senderName} (@${senderHandle}): ${message}`;
}

/**
 * Build the Hermes CLI command a local bot would run to hand off to another bot.
 */
export function buildHermesHandoffCommand(
  targetBot: string,
  senderName: string,
  senderHandle: string,
  message: string,
): string {
  const quotedMessage = shellDoubleQuote(formatAttributionMessage(senderName, senderHandle, message));
  return `hermes -p ${shellQuote(targetBot)} chat --in ~ -c "Bot Chat" --create-if-missing -Q -q "${quotedMessage}"`;
}
const DEFAULT_MAIL_REPLY_TIMEOUT_MS = 5000;
const DEFAULT_MAIL_POLL_INTERVAL_MS = 250;

/**
 * Parse mentions from text without resolving them.
 */
export function parseMentions(text: string): Array<{ mention: string; name: string }> {
  const seen = new Set<string>();
  const results: Array<{ mention: string; name: string }> = [];

  for (const match of text.matchAll(MENTION_RE)) {
    const name = match[1].toLowerCase();
    if (seen.has(name)) continue;
    seen.add(name);
    results.push({ mention: match[0].trimStart(), name });
  }

  return results;
}

/**
 * Resolve a mention name against native and stacked agents.
 */
export function resolveMention(
  name: string,
  nativeAgents: Agent[],
  stackedAgents: StackedAgent[],
): MentionTarget | undefined {
  const lower = name.toLowerCase();

  const native = nativeAgents.find((a) => {
    if (!isBot(a)) return false;
    return (
      a.name.toLowerCase() === lower ||
      (a.botProfile?.handle ?? '').toLowerCase() === lower ||
      (a.botProfile?.displayName ?? '').toLowerCase() === lower
    );
  });

  if (native) {
    return { mention: `@${name}`, name, agent: native };
  }

  const stacked = stackedAgents.find((s) => {
    const a = s.agent;
    return (
      a.name.toLowerCase() === lower ||
      (a.botProfile?.displayName ?? '').toLowerCase() === lower
    );
  });

  if (stacked) {
    return { mention: `@${name}`, name, stacked };
  }

  return undefined;
}

/**
 * Execute handoffs for all resolved mentions in the text and return a note that
 * can be appended to the active agent's prompt.
 */
export async function executeMentionHandoff(
  options: MentionHandoffOptions,
): Promise<MentionHandoffResult> {
  const { text, nativeAgents, stackedAgents } = options;
  const parsed = parseMentions(text);

  if (parsed.length === 0) {
    return {
      cleanText: text,
      targets: [],
      replies: [],
      handoffNote: '',
    };
  }

  const sender = resolveSender(options, nativeAgents, stackedAgents);

  const targets: MentionTarget[] = [];
  for (const p of parsed) {
    const resolved = resolveMention(p.name, nativeAgents, stackedAgents);
    if (resolved) {
      targets.push(resolved);
    }
  }

  const replies: MentionReply[] = [];
  for (const target of targets) {
    try {
      const reply = await handoffToTarget(target, options, sender);
      replies.push(reply);
    } catch (err) {
      logger.error({ err, target: target.name }, 'Handoff failed');
      replies.push({
        mention: target.mention,
        displayName: getDisplayName(target),
        providerId: target.stacked?.external.providerId,
        reply: '',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const cleanText = text.replace(MENTION_RE, (match) => {
    const name = match.trimStart().slice(1).toLowerCase();
    const target = targets.find((t) => t.name.toLowerCase() === name);
    return target ? '' : match;
  });

  const handoffNote = buildHandoffNote(targets, replies);

  return {
    cleanText: cleanText.replace(/\s+/g, ' ').trim(),
    targets,
    replies,
    handoffNote,
  };
}

function resolveSender(
  options: MentionHandoffOptions,
  nativeAgents: Agent[],
  stackedAgents: StackedAgent[],
): { name: string; handle: string } {
  if (options.senderName && options.senderHandle) {
    return { name: options.senderName, handle: options.senderHandle };
  }

  const activeId = options.activeAgentId;
  if (activeId) {
    const native = nativeAgents.find((a) => a.id === activeId);
    if (native) {
      return {
        name: getBotDisplayName(native),
        handle: native.botProfile?.handle ?? native.name,
      };
    }
    const stacked = stackedAgents.find((s) => s.agent.id === activeId);
    if (stacked) {
      return {
        name: getBotDisplayName(stacked.agent),
        handle: stacked.agent.botProfile?.handle ?? stacked.agent.name,
      };
    }
  }

  return {
    name: options.senderName ?? DEFAULT_SENDER_NAME,
    handle: options.senderHandle ?? DEFAULT_SENDER_HANDLE,
  };
}

async function handoffToTarget(
  target: MentionTarget,
  options: MentionHandoffOptions,
  sender: { name: string; handle: string },
): Promise<MentionReply> {
  const displayName = getDisplayName(target);
  const attributedBody = formatAttributionMessage(sender.name, sender.handle, options.text);

  if (target.agent) {
    // Native bot: send Rails mail and poll for a reply.
    const fromAgentId = options.activeAgentId ?? 'user';
    const toAgentId = target.agent.id;
    const subject = `Mention from @${sender.handle}`;
    const body = attributedBody;

    logger.info({ fromAgentId, toAgentId, sender: sender.handle }, 'Handing off mention to native bot via mail');
    await options.sendMail(fromAgentId, toAgentId, subject, body);

    // Poll the target bot's inbox until a reply arrives or we time out.
    const replyMessage = await pollForMailReply(toAgentId, options);

    if (replyMessage?.id && options.acknowledgeMail) {
      try {
        await options.acknowledgeMail(toAgentId, replyMessage.id);
      } catch (err) {
        logger.warn({ err, toAgentId, messageId: replyMessage.id }, 'Failed to acknowledge mention reply');
      }
    }

    return {
      mention: target.mention,
      displayName,
      reply: replyMessage?.body ?? '(waiting for reply)',
    };
  }

  if (target.stacked) {
    // External bot: invoke provider.sendMessage directly.
    const provider = target.stacked.provider;
    const externalId = target.stacked.external.externalId;
    const session = `Allternit Mention`;
    const message = attributedBody;

    logger.info({ providerId: provider.id, externalId, sender: sender.handle }, 'Handing off mention to external bot');
    const chunks: string[] = [];
    for await (const chunk of provider.sendMessage(externalId, session, message)) {
      chunks.push(chunk);
    }

    return {
      mention: target.mention,
      displayName,
      providerId: provider.id,
      reply: chunks.join('\n').trim(),
    };
  }

  throw new Error('Unresolved mention target');
}

async function pollForMailReply(
  toAgentId: string,
  options: MentionHandoffOptions,
): Promise<{ id?: string; body?: string } | undefined> {
  const timeoutMs = options.mailReplyTimeoutMs ?? DEFAULT_MAIL_REPLY_TIMEOUT_MS;
  const intervalMs = options.mailPollIntervalMs ?? DEFAULT_MAIL_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const mail = await options.fetchMail(toAgentId);
    const replyMessage = mail
      .filter((m) => m.fromAgentId === toAgentId && m.status === 'unread')
      .sort((a, b) => (b.subject ?? '').localeCompare(a.subject ?? ''))[0];

    if (replyMessage) {
      return replyMessage;
    }

    await wait(intervalMs);
  }

  return undefined;
}

function buildHandoffNote(targets: MentionTarget[], replies: MentionReply[]): string {
  if (targets.length === 0) return '';

  const lines = [
    '',
    '[@mention handoff]',
    `The user mentioned ${targets.map((t) => getDisplayName(t)).join(' and ')}.`,
  ];

  for (const reply of replies) {
    if (reply.error) {
      lines.push(`- ${reply.displayName}: could not deliver (${reply.error}).`);
    } else {
      lines.push(`- ${reply.displayName} replied:\n${reply.reply || '(no reply yet)'}`);
    }
  }

  lines.push('Synthesize the above into your response to the user.');

  return '\n' + lines.join('\n');
}

function getDisplayName(target: MentionTarget): string {
  if (target.agent) return getBotDisplayName(target.agent);
  if (target.stacked) return getBotDisplayName(target.stacked.agent);
  return target.name;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
