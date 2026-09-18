import { describe, expect, it } from 'vitest';
import type { Agent } from '@/lib/agents/agent.types';
import type { GroupChat } from './group-chat.types';
import { buildTeamMapEdges, buildTeamMapNodes } from './bot-team-map';

describe('bot-team-map', () => {
  it('builds pair edges from group membership without inventing bots', () => {
    const nodes = buildTeamMapNodes([
      { id: 'a', botProfile: { displayName: 'Ada', chiefOfStaff: true } },
      { id: 'b', botProfile: { displayName: 'Lin' } },
    ] as Agent[]);
    expect(nodes[0].chiefOfStaff).toBe(true);
    const edges = buildTeamMapEdges({
      g1: {
        id: 'g1',
        name: 'Gym',
        members: [
          { botId: 'a', displayName: 'Ada', handle: 'ada', source: 'native' },
          { botId: 'b', displayName: 'Lin', handle: 'lin', source: 'native' },
        ],
        log: [],
        createdAt: '2026-09-15',
        updatedAt: '2026-09-15',
      } as GroupChat,
    });
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ sourceBotId: 'a', targetBotId: 'b', groupName: 'Gym' });
  });
});
