import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { allternitAiSessionApi } from '@/services/allternit-ai/session-api';
import { resolveAgentSecrets } from '@/lib/agents/agent-secrets-resolver';
import { resolveAgentConnectors } from '@/lib/agents/agent-connectors-resolver';
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
        // Resolve declared secrets and connectors so the runtime can inject
        // them without storing credential material in the agent record.
        const [secretsResult, connectorsResult] = await Promise.all([
          resolveAgentSecrets(agent.id, agent.secretRefs),
          resolveAgentConnectors(agent.id, agent.connectorBindings),
        ]);

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
            harness: agent.harness,
            allowedTools: agent.allowedTools,
            allowedSkills: agent.allowedSkills,
            connectorBindings: agent.connectorBindings,
            secretRefs: agent.secretRefs,
            resolvedSecrets: secretsResult.secrets,
            missingSecrets: secretsResult.missing,
            resolvedConnectors: connectorsResult.credentials,
            missingConnectors: connectorsResult.missing,
            messagingConfig: agent.messagingConfig,
            identityChannels: agent.identityChannels,
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
