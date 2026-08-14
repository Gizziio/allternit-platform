import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { allternitAiSessionApi } from '@/services/allternit-ai/session-api';
import type { Agent } from '../agents/agent.types';

export interface UseBotSessionReturn {
  startSession: (bot: Agent) => Promise<void>;
  isStarting: boolean;
  error: string | null;
}

export function useBotSession(): UseBotSessionReturn {
  const navigate = useNavigate();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startSession = useCallback(
    async (agent: Agent) => {
      setIsStarting(true);
      setError(null);

      try {
        const session = await allternitAiSessionApi.createSession({
          name: agent.botProfile?.displayName ?? agent.name,
          description: agent.description,
          origin_surface: 'chat',
          session_mode: 'agent',
          agentId: agent.id,
          agentName: agent.name,
          metadata: {
            isBot: agent.isBot,
            botProfile: agent.botProfile,
            systemPrompt: agent.systemPrompt,
            starterPrompts: agent.botProfile?.starterPrompts,
            model: agent.model,
            tags: agent.tags,
            category: agent.category,
            trustTier: agent.trustTier,
          },
        });

        navigate(`/shell/sessions/${session.id}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start bot session';
        setError(message);
      } finally {
        setIsStarting(false);
      }
    },
    [navigate]
  );

  return { startSession, isStarting, error };
}
