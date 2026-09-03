import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import type { Agent } from '@/lib/agents/agent.types';
import { getBotDisplayName } from './bot-profile';
import { useGroupChatStore } from './group-chat.store';
import type { GroupChatMember } from './group-chat.types';

export interface StartBotGroupChatInput {
  bots: Agent[];
  name?: string;
}

export interface StartBotGroupChatResult {
  sessionId: string;
}

/**
 * Create a local-only group-chat session for the selected packaged bots.
 *
 * The group definition lives in group-chat.store.ts; the session carries a
 * groupId reference and renders the transcript. This lets membership be edited
 * after creation and keeps the transcript in the canonical chat session store.
 */
export async function startBotGroupChat(
  input: StartBotGroupChatInput
): Promise<StartBotGroupChatResult | null> {
  const { bots, name } = input;
  if (bots.length < 2 || bots.length > 6) return null;

  const sessionStore = useChatSessionStore.getState();
  const groupStore = useGroupChatStore.getState();

  const members: GroupChatMember[] = bots.map((bot) => {
    const displayName = getBotDisplayName(bot);
    const handle =
      bot.botProfile?.handle ??
      (displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ||
        bot.id.slice(0, 8));
    return {
      botId: bot.id,
      displayName,
      handle,
      source: 'native' as const,
    };
  });

  const sessionName =
    name?.trim() ||
    `${members.map((p) => p.displayName).join(', ').slice(0, 60)}` ||
    'Group Chat';

  const groupId = groupStore.createGroup(sessionName, members);

  const botProfiles = bots.map((bot) => ({
    id: bot.id,
    displayName: getBotDisplayName(bot),
    accentColor: bot.botProfile?.accentColor,
    botCategory: bot.botProfile?.botCategory,
    welcomeMessage: bot.botProfile?.welcomeMessage,
    tagline: bot.botProfile?.tagline,
  }));

  const systemPrompts = bots
    .map((bot) => {
      const displayName = getBotDisplayName(bot);
      const identity = `You are ${displayName}. You must ALWAYS identify yourself as ${displayName}. NEVER say you are Kimi, GPT, Claude, an AI assistant created by another company, or any name other than ${displayName}.`;
      return [identity, bot.systemPrompt ?? ''].filter(Boolean).join('\n\n').trim();
    })
    .join('\n\n---\n\n');

  const sessionId = await sessionStore.createSession({
    name: sessionName,
    description: `Group chat with ${bots.length} bots`,
    sessionMode: 'agent',
    agentId: bots[0].id,
    agentName: botProfiles[0].displayName,
    systemPrompt: systemPrompts,
    metadata: {
      isBot: true,
      isGroupChat: true,
      groupId,
      botIds: bots.map((b) => b.id),
      botProfiles,
      originSurface: 'chat',
    },
  });

  return { sessionId };
}
