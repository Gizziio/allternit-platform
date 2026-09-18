/**
 * Roster copy matched to OpenMaus Sidebar.tsx `preview` / `BotListItem`.
 *
 * Title is `bot.title` (line above the name). Chief of Staff is the
 * `chiefOfStaff` flag (crown under the name). Neither is inferred from
 * category or a sentence tagline.
 */

import type { Agent } from '@/lib/agents/agent.types';
import type { GroupChat } from './group-chat.types';

const PREVIEW_MAX = 42;

export function lastMessagePreview(
  messages: Array<{ role?: string; content?: string; text?: string; parts?: Array<{ type?: string; text?: string }> }> | undefined,
  maxLength = PREVIEW_MAX,
): string {
  if (!messages || messages.length === 0) return '';
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    let raw = (msg?.content || msg?.text || '').replace(/\s+/g, ' ').trim();
    if (!raw && Array.isArray(msg?.parts)) {
      raw = msg.parts
        .map((part) => (part?.type === 'text' || !part?.type ? part?.text : '') || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    if (!raw) continue;
    return raw.length > maxLength ? `${raw.slice(0, maxLength)}…` : raw;
  }
  return '';
}

/** Newest session for this bot: last chat line, else session name. */
export function botRailPreview(
  botId: string,
  sessions: Array<{
    id: string;
    name?: string;
    updatedAt?: string;
    createdAt?: string;
    messages?: Array<{ role?: string; content?: string; text?: string; parts?: Array<{ type?: string; text?: string }> }>;
    metadata?: Record<string, unknown>;
  }>,
): string {
  const owned = sessions.filter((session) => {
    const meta = session.metadata ?? {};
    if (meta.isGroupChat === true) return false;
    const owner =
      (typeof meta.botThreadOf === 'string' && meta.botThreadOf) ||
      (typeof meta.botCanonicalFor === 'string' && meta.botCanonicalFor) ||
      (typeof meta.agentId === 'string' && meta.agentId) ||
      '';
    return owner === botId;
  });
  if (owned.length === 0) return '';
  owned.sort((a, b) => {
    const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return tb - ta;
  });
  const newest = owned[0];
  return lastMessagePreview(newest.messages) || (newest.name?.trim() && newest.name !== 'New thread' ? newest.name : '');
}

export function groupLastMessagePreview(group: GroupChat | undefined, maxLength = PREVIEW_MAX): string {
  const last = group?.log?.at(-1);
  if (!last?.text?.trim()) return 'No messages yet';
  const who = last.from === 'user' ? 'You' : (last.displayName || 'Bot');
  const text = last.text.replace(/\s+/g, ' ').trim();
  const line = `${who}: ${text}`;
  return line.length > maxLength ? `${line.slice(0, maxLength)}…` : line;
}

/** OpenMaus `bot.title` — own line above the name. */
export function botTitle(bot: Pick<Agent, 'botProfile'>): string {
  return (bot.botProfile?.title ?? '').trim();
}

/** OpenMaus `bot.chiefOfStaff` — crown label under the name. */
export function isChiefOfStaff(bot: Pick<Agent, 'botProfile'>): boolean {
  return bot.botProfile?.chiefOfStaff === true;
}
