"use client";

import { useEffect, useRef } from 'react';
import { useAgentStore, agentWorkspaceService, defineAgent } from '@/lib/agents';
import type { AgentDefinition } from '@/lib/agents';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('useAgentBootstrap');

const BOOTSTRAP_KEY = 'allternit:agent-bootstrap:v1';

const GIZZI_SEED: AgentDefinition = {
  name: 'gizzi',
  description: 'Your personal Allternit platform assistant. Always here to help.',
  instructions: 'You are Gizzi, the friendly platform assistant for Allternit. Help users navigate and use the platform effectively.',
  capabilities: ['chat', 'help', 'navigation'],
  source: 'personal',
  allowedSurfaces: ['chat', 'cowork', 'code', 'design', 'browser'],
  isBot: true,
  botProfile: {
    displayName: 'Gizzi',
    tagline: 'Your default assistant',
    welcomeMessage: 'Hey, I’m Gizzi. What are we working on?',
    starterPrompts: [
      'Help me get started with Allternit',
      'Summarize my recent activity',
      'Walk me through creating a bot',
    ],
    accentColor: '#06b6d4',
    groupChatEnabled: false,
    botCategory: 'custom',
  },
  character: {
    className: 'Assistant',
    personalityTraits: ['friendly', 'helpful'],
    backstory: 'The default Allternit platform assistant.',
    domain: 'platform assistance',
    inputs: ['questions', 'commands'],
    outputs: ['answers', 'guidance'],
    voiceStyle: 'helpful and concise',
    mascot: 'gizzi',
    primaryColor: '#06b6d4',
  },
};

const VENDOR_SEEDS: AgentDefinition[] = [
  {
    name: 'Deep Research',
    description: 'Get in-depth answers grounded in web research. Gathers and analyzes information from multiple sources to create a single, coherent summary.',
    capabilities: ['research', 'web-search', 'citations'],
  },
  {
    name: 'Code Assistant',
    description: 'Generate, review, and refactor code across any language. Understands context and suggests improvements.',
    capabilities: ['code', 'review', 'refactor'],
  },
  {
    name: 'Data Analyst',
    description: 'Upload CSV or Excel files and get automatic charts, insights, and SQL queries.',
    capabilities: ['data', 'charts', 'sql'],
  },
].map((seed) => ({ ...seed, type: 'specialist' as const, temperature: 0.3, source: 'vendor' as const }));

const ORG_SEEDS: AgentDefinition[] = [
  {
    name: 'Data Catalyst',
    description: 'Analyze complex datasets to surface actionable business insights.',
    capabilities: ['analytics', 'reporting', 'forecasting'],
  },
  {
    name: 'Architect',
    description: 'Design and build complex system architectures with best practices.',
    capabilities: ['architecture', 'design', 'documentation'],
  },
].map((seed) => ({ ...seed, type: 'specialist' as const, temperature: 0.4, source: 'organization' as const, character: { primaryColor: '#8b5cf6' } }));

interface UseAgentBootstrapOptions {
  enabled?: boolean;
}

export function useAgentBootstrap({ enabled = true }: UseAgentBootstrapOptions = {}) {
  const { createAgent, fetchAgents } = useAgentStore();
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (bootstrappedRef.current) return;

    const bootstrap = async () => {
      bootstrappedRef.current = true;
      const hasBootstrapped = typeof window !== 'undefined' && localStorage.getItem(BOOTSTRAP_KEY) === '1';

      await fetchAgents();
      let currentAgents = useAgentStore.getState().agents;

      // Ensure exactly one canonical Gizzi packaged bot exists. Keep a single
      // lowercase packaged bot if it already exists; remove all other variants
      // (capitalized names, legacy non-bot rows, etc.) that cause duplicates.
      const canonicalGizzi = currentAgents.find(
        (a) => a.name === 'gizzi' && a.isBot === true,
      );
      const gizziVariants = currentAgents.filter(
        (a) => a.name.toLowerCase() === 'gizzi' && a.id !== canonicalGizzi?.id,
      );
      if (gizziVariants.length > 0) {
        const { deleteAgent } = useAgentStore.getState();
        for (const variant of gizziVariants) {
          try { await deleteAgent(variant.id); } catch {}
        }
        await fetchAgents();
        currentAgents = useAgentStore.getState().agents;
      }

      const gizziExists = currentAgents.some((a) => a.name === 'gizzi' && a.isBot === true);
      if (!gizziExists) {
        try {
          const gizziInput = defineAgent(GIZZI_SEED);
          // agentWorkspaceService.create() registers the agent record itself
          // and scaffolds its workspace; calling createAgent() here as well
          // would persist a duplicate, orphaned Gizzi row.
          await agentWorkspaceService.create(gizziInput, 'allternit-standard');
        } catch (e) {
          logger.error({ err: e }, 'Gizzi creation failed');
        }
      }

      // Seed vendor and organization agents only once.
      if (!hasBootstrapped) {
        for (const seed of [...VENDOR_SEEDS, ...ORG_SEEDS]) {
          // Legacy rows predate source persistence (a.source === undefined) — match them by name.
          const exists = currentAgents.some((a) => a.name === seed.name && (a.source === seed.source || a.source === undefined));
          if (!exists) {
            try {
              await createAgent(defineAgent(seed));
            } catch (e) {
              logger.error({ err: e }, `Failed to seed ${seed.source} agent ${seed.name}:`);
            }
          }
        }
      }

      await fetchAgents();

      if (typeof window !== 'undefined') {
        localStorage.setItem(BOOTSTRAP_KEY, '1');
      }
    };

    void bootstrap();
  }, [createAgent, fetchAgents]);
}
