/**
 * useMentionHandoff Hook
 *
 * React hook that wires the mention handoff service to the agent store and
 * stacked-agent service. Returns a function to execute handoff for a given text.
 *
 * @module use-mention-handoff
 */

import { useCallback, useState } from 'react';
import { useAgentStore } from '@/lib/agents/agent.store';
import { useStackProviders } from './use-stack-providers';
import {
  executeMentionHandoff,
  type MentionHandoffResult,
} from './mention-handoff.service';
import { getBotDisplayName } from './bot-profile';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('useMentionHandoff');

export interface UseMentionHandoffResult {
  isHandingOff: boolean;
  lastResult: MentionHandoffResult | null;
  handoff: (text: string, activeAgentId?: string) => Promise<MentionHandoffResult>;
}

export function useMentionHandoff(): UseMentionHandoffResult {
  const { agents, sendMail, fetchMail, acknowledgeMail } = useAgentStore();
  const { stackedAgents } = useStackProviders();
  const [isHandingOff, setIsHandingOff] = useState(false);
  const [lastResult, setLastResult] = useState<MentionHandoffResult | null>(null);

  const handoff = useCallback(
    async (text: string, activeAgentId?: string): Promise<MentionHandoffResult> => {
      setIsHandingOff(true);
      try {
        let senderName: string | undefined;
        let senderHandle: string | undefined;
        if (activeAgentId) {
          const active =
            agents.find((a) => a.id === activeAgentId) ??
            stackedAgents.find((s) => s.agent.id === activeAgentId)?.agent;
          if (active) {
            senderName = getBotDisplayName(active);
            senderHandle = active.botProfile?.handle ?? active.name;
          }
        }

        const result = await executeMentionHandoff({
          text,
          nativeAgents: agents,
          stackedAgents,
          activeAgentId,
          senderName,
          senderHandle,
          sendMail: async (fromAgentId, toAgentId, subject, body) => {
            try {
              await sendMail(fromAgentId, toAgentId, subject, body);
            } catch (err) {
              logger.error({ err, fromAgentId, toAgentId }, 'sendMail failed');
              throw err;
            }
          },
          fetchMail: async (agentId) => {
            try {
              await fetchMail(agentId);
              const state = useAgentStore.getState();
              return state.mail[agentId] ?? [];
            } catch (err) {
              logger.error({ err, agentId }, 'fetchMail failed');
              return [];
            }
          },
          acknowledgeMail: async (agentId, messageId) => {
            try {
              await acknowledgeMail(agentId, messageId);
            } catch (err) {
              logger.error({ err, agentId, messageId }, 'acknowledgeMail failed');
              throw err;
            }
          },
        });
        setLastResult(result);
        return result;
      } finally {
        setIsHandingOff(false);
      }
    },
    [agents, stackedAgents, sendMail, fetchMail, acknowledgeMail],
  );

  return { isHandingOff, lastResult, handoff };
}
