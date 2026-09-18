/**
 * Team map graph from Allternit group chats (OpenMaus team-map.ts shape).
 */

import type { Agent } from '@/lib/agents/agent.types';
import { getBotDisplayName } from './bot-profile';
import { isChiefOfStaff } from './bot-roster-preview';
import type { GroupChat } from './group-chat.types';

export interface TeamMapNode {
  id: string;
  name: string;
  chiefOfStaff: boolean;
}

export interface TeamMapEdge {
  sourceBotId: string;
  targetBotId: string;
  groupId: string;
  groupName: string;
  lastAt: number;
}

export function buildTeamMapNodes(bots: Agent[]): TeamMapNode[] {
  return bots.map((bot) => ({
    id: bot.id,
    name: getBotDisplayName(bot),
    chiefOfStaff: isChiefOfStaff(bot),
  }));
}

export function buildTeamMapEdges(groups: GroupChat[] | Record<string, GroupChat>): TeamMapEdge[] {
  const edges: TeamMapEdge[] = [];
  const list = Array.isArray(groups) ? groups : Object.values(groups);
  for (const group of list) {
    const ids = group.members.map((member) => member.botId);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        edges.push({
          sourceBotId: ids[i],
          targetBotId: ids[j],
          groupId: group.id,
          groupName: group.name,
          lastAt: new Date(group.updatedAt || group.createdAt || 0).getTime(),
        });
      }
    }
  }
  return edges;
}
