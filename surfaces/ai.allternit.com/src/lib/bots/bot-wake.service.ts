/**
 * Async bot wake — Grok/Hermes handoff.
 *
 * Delivers a message into a bot's canonical chat and optionally waits for the
 * turn to finish. DMs are fire-and-forget; group rounds wait so the room can
 * serialize replies.
 */

import { openBotCanonicalChat } from './bot-canonical-chat.service';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('BotWake');

export interface WakeBotOptions {
  botId: string;
  botName: string;
  message: string;
  waitForReply?: boolean;
}

export async function wakeBot(options: WakeBotOptions): Promise<string | undefined> {
  const { botId, botName, message, waitForReply = false } = options;
  if (!message.trim()) return undefined;

  const sessionId = await openBotCanonicalChat({
    botId,
    botName,
    kickoff: '',
    setActive: false,
  });

  const store = useChatSessionStore.getState();
  logger.info({ botId, sessionId, waitForReply }, 'Waking bot');

  const send = store.sendMessageStream
    ? store.sendMessageStream(sessionId, { text: message })
    : store.sendMessage(sessionId, { text: message });

  if (!waitForReply) {
    void send.catch((err) => {
      logger.error({ err, botId }, 'Fire-and-forget wake failed');
    });
    return undefined;
  }

  await send;
  const session = useChatSessionStore.getState().sessions.find((s) => s.id === sessionId);
  const lastAssistant = [...(session?.messages ?? [])]
    .reverse()
    .find((m) => m.role === 'assistant');
  return typeof lastAssistant?.content === 'string' ? lastAssistant.content : undefined;
}
