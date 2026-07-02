"use client";

import { useEffect, useRef } from 'react';
import { useAgentStore, agentWorkspaceService } from '@/lib/agents';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('useAgentSeeding');

export function useAgentSeeding() {
  const { createAgent, fetchAgents } = useAgentStore();
  const seedingRef = useRef(false);

  useEffect(() => {
    const seedAgents = async () => {
      if (seedingRef.current) return;
      
      await fetchAgents();
      const currentAgents = useAgentStore.getState().agents;
      
      // Deduplicate Gizzi
      const gizziAgents = currentAgents.filter((a: any) => a.name === 'Gizzi');
      if (gizziAgents.length > 1) {
        const { deleteAgent } = useAgentStore.getState();
        for (let i = 1; i < gizziAgents.length; i++) {
          try { await deleteAgent(gizziAgents[i].id); } catch (e) {}
        }
        await fetchAgents();
      }
      
      // Seed personal agent: Gizzi
      if (gizziAgents.length === 0) {
        seedingRef.current = true;
        try {
          await createAgent({
            name: 'Gizzi',
            description: 'Your personal Allternit platform assistant. Always here to help.',
            type: 'worker',
            model: 'gpt-4o',
            provider: 'openai',
            capabilities: ['chat', 'help', 'navigation'],
            systemPrompt: 'You are Gizzi, the friendly platform assistant for Allternit. Help users navigate and use the platform effectively.',
            tools: [],
            maxIterations: 10,
            temperature: 0.7,
            source: 'personal',
          });
          await agentWorkspaceService.create({
            name: 'Gizzi',
            description: 'Your personal Allternit platform assistant. Always here to help.',
            type: 'worker',
            model: 'gpt-4o',
            provider: 'openai',
            capabilities: ['chat', 'help', 'navigation'],
            systemPrompt: 'You are Gizzi, the friendly platform assistant for Allternit. Help users navigate and use the platform effectively.',
            tools: [],
            maxIterations: 10,
            temperature: 0.7,
          }, 'allternit-standard');
        } catch (e) {
          logger.error({ err: e }, 'Gizzi creation failed');
        }
      }
      
      // Seed vendor agents
      const vendorSeeds = [
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
      ];
      
      for (const seed of vendorSeeds) {
        const exists = currentAgents.some((a: any) => a.name === seed.name && a.source === 'vendor');
        if (!exists) {
          try {
            await createAgent({
              name: seed.name,
              description: seed.description,
              type: 'specialist',
              model: 'gpt-4o',
              provider: 'openai',
              capabilities: seed.capabilities,
              tools: [],
              maxIterations: 10,
              temperature: 0.3,
              source: 'vendor',
            });
          } catch (e) {
            logger.error({ err: e }, `Failed to seed vendor agent ${seed.name}:`);
          }
        }
      }
      
      // Seed organization agents
      const orgSeeds = [
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
      ];
      
      for (const seed of orgSeeds) {
        const exists = currentAgents.some((a: any) => a.name === seed.name && a.source === 'organization');
        if (!exists) {
          try {
            await createAgent({
              name: seed.name,
              description: seed.description,
              type: 'specialist',
              model: 'gpt-4o',
              provider: 'openai',
              capabilities: seed.capabilities,
              tools: [],
              maxIterations: 10,
              temperature: 0.4,
              source: 'organization',
            });
          } catch (e) {
            logger.error({ err: e }, `Failed to seed org agent ${seed.name}:`);
          }
        }
      }
      
      await fetchAgents();
      seedingRef.current = false;
    };
    seedAgents();
  }, [createAgent, fetchAgents]);
}
