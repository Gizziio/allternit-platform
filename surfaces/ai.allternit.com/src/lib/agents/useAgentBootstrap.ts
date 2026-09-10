"use client";

import { useEffect, useRef } from 'react';
import { useAgentStore, agentWorkspaceService, defineAgent } from '@/lib/agents';
import type { AgentDefinition } from '@/lib/agents';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('useAgentBootstrap');

const BOOTSTRAP_KEY = 'allternit:agent-bootstrap:v1';

const GIZZI_SEED: AgentDefinition = {
  // Client-stable id: the API create is idempotent on id (see agent.service
  // createAgent + the API's CreateAgentBody.id), so the packaged assistant
  // gets ONE row with a predictable identity instead of a fresh uuid whenever
  // the bootstrap runs before the agent store has hydrated.
  id: 'gizzi-packaged-assistant',
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
  avatar: {
    type: 'mascot',
    mascotTemplate: 'gizzi',
    currentEmotion: 'pleased',
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
    // Client-stable ids make the (now idempotent) API create return the
    // existing row instead of minting a duplicate whenever bootstrap runs
    // before the agent store has hydrated.
    id: 'vendor-deep-research',
    name: 'Deep Research',
    description: 'Get in-depth answers grounded in web research. Gathers and analyzes information from multiple sources to create a single, coherent summary.',
    capabilities: ['research', 'web-search', 'citations'],
  },
  {
    id: 'vendor-code-assistant',
    name: 'Code Assistant',
    description: 'Generate, review, and refactor code across any language. Understands context and suggests improvements.',
    capabilities: ['code', 'review', 'refactor'],
  },
  {
    id: 'vendor-data-analyst',
    name: 'Data Analyst',
    description: 'Upload CSV or Excel files and get automatic charts, insights, and SQL queries.',
    capabilities: ['data', 'charts', 'sql'],
  },
].map((seed) => ({ ...seed, type: 'specialist' as const, temperature: 0.3, source: 'vendor' as const }));

const ORG_SEEDS: AgentDefinition[] = [
  {
    id: 'org-data-catalyst',
    name: 'Data Catalyst',
    description: 'Analyze complex datasets to surface actionable business insights.',
    capabilities: ['analytics', 'reporting', 'forecasting'],
  },
  {
    id: 'org-architect',
    name: 'Architect',
    description: 'Design and build complex system architectures with best practices.',
    capabilities: ['architecture', 'design', 'documentation'],
  },
].map((seed) => ({ ...seed, type: 'specialist' as const, temperature: 0.4, source: 'organization' as const, character: { primaryColor: '#8b5cf6' } }));

// Every name the bootstrap owns. Maps lowercase name → the client-stable id
// of the row that should survive dedupe. Rows under these names were seeded
// by the platform, so duplicates left by earlier races are safe to delete.
const SEED_CANONICAL_IDS: Record<string, string> = {
  gizzi: 'gizzi-packaged-assistant',
  'deep research': 'vendor-deep-research',
  'code assistant': 'vendor-code-assistant',
  'data analyst': 'vendor-data-analyst',
  'data catalyst': 'org-data-catalyst',
  'architect': 'org-architect',
};

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

      // Dedupe every platform-seeded name. Cold-start races (store fetch
      // timeout → empty list) used to create a second row per seed on the
      // next boot; earlier versions also matched case-variant names. Keep the
      // row with the client-stable seed id when present, delete the rest.
      let deduped = false;
      for (const [seedName, canonicalId] of Object.entries(SEED_CANONICAL_IDS)) {
        const matches = currentAgents.filter((a) => a.name.toLowerCase() === seedName);
        if (matches.length <= 1) continue;
        const keeper = matches.find((a) => a.id === canonicalId) ?? matches[0];
        const { deleteAgent } = useAgentStore.getState();
        for (const dup of matches.filter((a) => a.id !== keeper.id)) {
          try { await deleteAgent(dup.id); } catch {}
        }
        deduped = true;
      }
      if (deduped) {
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
