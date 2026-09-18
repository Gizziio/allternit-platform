import { describe, expect, it } from 'vitest';
import type { Agent } from '@/lib/agents/agent.types';
import type { GroupChat } from './group-chat.types';
import {
  botRailPreview,
  botTitle,
  groupLastMessagePreview,
  isChiefOfStaff,
  lastMessagePreview,
} from './bot-roster-preview';

function bot(partial: Partial<NonNullable<Agent['botProfile']>>): Pick<Agent, 'botProfile'> {
  return {
    botProfile: {
      displayName: 'Scout',
      ...partial,
    },
  };
}

describe('bot-roster-preview', () => {
  it('keeps title and Chief of Staff as separate OpenMaus fields', () => {
    expect(botTitle(bot({ title: 'Keyword Researcher' }))).toBe('Keyword Researcher');
    expect(isChiefOfStaff(bot({ chiefOfStaff: true }))).toBe(true);
    expect(isChiefOfStaff(bot({ tagline: 'Chief of Staff', botCategory: 'ops' }))).toBe(false);
  });

  it('takes the last non-empty message and truncates', () => {
    expect(lastMessagePreview([])).toBe('');
    expect(
      lastMessagePreview([
        { role: 'user', content: '   ' },
        { role: 'assistant', content: 'Hi! I am Accountant. Regarding the invoice.' },
      ]),
    ).toMatch(/^Hi! I am Accountant\. Regarding the invoic/);
  });

  it('uses the newest session for that bot, not only the canonical pin', () => {
    expect(
      botRailPreview('bot-1', [
        {
          id: 'old',
          name: 'Bot Chat',
          updatedAt: '2026-09-01T00:00:00Z',
          metadata: { isBot: true, botCanonicalFor: 'bot-1' },
          messages: [{ role: 'assistant', content: 'old line' }],
        },
        {
          id: 'new',
          name: 'Later thread',
          updatedAt: '2026-09-16T00:00:00Z',
          metadata: { isBot: true, agentId: 'bot-1' },
          messages: [{ role: 'user', content: 'examine all the files' }],
        },
      ]),
    ).toBe('examine all the files');
  });

  it('labels group previews with the sender', () => {
    const group = {
      log: [{ from: 'user', text: 'lets go', timestamp: '', id: '1' }],
    } as GroupChat;
    expect(groupLastMessagePreview(group)).toBe('You: lets go');
    expect(groupLastMessagePreview({ log: [] } as unknown as GroupChat)).toBe('No messages yet');
  });
});
