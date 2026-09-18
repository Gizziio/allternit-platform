/**
 * Bot sub-threads — OpenMaus `newTask` / `BotThreadList` mapped onto Hub sessions.
 *
 * Each bot keeps a canonical chat (`botCanonicalFor` / roster pin). Extra
 * threads are more chat sessions for the same bot (`botThreadOf`) and do not
 * replace the pin. Creating a thread never wipes the others.
 */

import type { ModeSession } from '@/lib/agents/mode-session-store';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { useBotRosterStore } from './bot-roster.store';
import { lastMessagePreview } from './bot-roster-preview';
import { openBotChatView } from './bot-canonical-chat.service';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('BotThreads');

export const BOT_THREAD_OF_KEY = 'botThreadOf';

export interface BotThread {
  sessionId: string;
  title: string;
  updatedAt: number;
  archived: boolean;
  unread: number;
  isCanonical: boolean;
  lastMessage: string;
  busy: boolean;
  folderId: string | null;
}

export function isBotThreadSession(session: ModeSession, botId: string): boolean {
  const meta = session.metadata ?? {};
  if (meta.isGroupChat === true) return false;
  if (meta.isBot !== true && meta.sessionMode !== 'agent') return false;
  const owner =
    (typeof meta.botThreadOf === 'string' && meta.botThreadOf) ||
    (typeof meta.botCanonicalFor === 'string' && meta.botCanonicalFor) ||
    (typeof meta.agentId === 'string' && meta.agentId) ||
    '';
  return owner === botId;
}

export function listBotThreads(
  botId: string,
  sessions: ModeSession[],
  canonicalId: string | undefined,
  unreadCounts: Record<string, number> = {},
  streamingBySession: Record<string, { isStreaming?: boolean } | undefined> = {},
): BotThread[] {
  return sessions
    .filter((session) => isBotThreadSession(session, botId))
    .map((session) => {
      const archived = session.metadata?.archived === true || session.isActive === false;
      return {
        sessionId: session.id,
        title: session.name?.trim() || 'New thread',
        updatedAt: new Date(session.updatedAt || session.createdAt || 0).getTime(),
        archived,
        unread: unreadCounts[session.id] || 0,
        isCanonical: session.id === canonicalId || session.metadata?.botCanonicalFor === botId,
        lastMessage: lastMessagePreview(session.messages),
        busy: Boolean(streamingBySession[session.id]?.isStreaming),
        folderId: typeof session.metadata?.botFolderId === 'string' ? session.metadata.botFolderId : null,
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** OpenMaus `visibleSidebarThreads`: six recent open threads plus anything that demands attention. */
export function visibleBotThreads(threads: BotThread[], activeId: string, showAll = false): BotThread[] {
  if (showAll) return threads;
  let open = 0;
  return threads.filter((thread) => {
    const attention =
      thread.sessionId === activeId || thread.busy || thread.unread > 0;
    if (thread.archived) return attention;
    return open++ < 6 || attention;
  });
}

export function threadByline(thread: Pick<BotThread, 'archived' | 'lastMessage'>): string | null {
  if (thread.archived) return 'Archived';
  return thread.lastMessage || null;
}

export async function renameBotThread(sessionId: string, title: string): Promise<void> {
  const next = title.trim() || 'New thread';
  await useChatSessionStore.getState().updateSession(sessionId, { name: next });
}

export async function archiveBotThread(sessionId: string, archived: boolean): Promise<void> {
  await useChatSessionStore.getState().updateSession(sessionId, {
    metadata: { archived },
  });
}

export async function deleteBotThread(sessionId: string, botId: string): Promise<void> {
  const store = useChatSessionStore.getState();
  const roster = useBotRosterStore.getState();
  const canonical = roster.canonicalChatIds[botId];
  await store.deleteSession(sessionId);
  if (canonical === sessionId) {
    const remaining = listBotThreads(botId, store.sessions ?? [], undefined).filter(
      (thread) => thread.sessionId !== sessionId && !thread.archived,
    );
    roster.setCanonicalChatId(botId, remaining[0]?.sessionId ?? null);
  }
}

export async function moveBotThread(sessionId: string, folderId: string | null): Promise<void> {
  await useChatSessionStore.getState().updateSession(sessionId, {
    metadata: { botFolderId: folderId },
  });
}

export async function createBotThread(botId: string, botName: string, folderId?: string): Promise<string> {
  const store = useChatSessionStore.getState();
  const sessionId = await store.createSession({
    name: 'New thread',
    sessionMode: 'agent',
    agentId: botId,
    agentName: botName,
    metadata: {
      isBot: true,
      agentId: botId,
      botName,
      [BOT_THREAD_OF_KEY]: botId,
      ...(folderId ? { botFolderId: folderId } : {}),
    },
  });
  const canonical = useBotRosterStore.getState().canonicalChatIds[botId];
  if (!canonical) {
    useBotRosterStore.getState().setCanonicalChatId(botId, sessionId);
  }
  store.setActiveSession(sessionId);
  openBotChatView(sessionId, botId, 'bot-launchpad');
  logger.info({ botId, sessionId, canonicalKept: Boolean(canonical) }, 'Created bot sub-thread');
  return sessionId;
}
