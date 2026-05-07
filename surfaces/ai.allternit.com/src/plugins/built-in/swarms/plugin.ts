/**
 * Swarms Plugin - Production Implementation
 * 
 * Multi-agent orchestration
 * Coordinates multiple AI agents for complex tasks
 */

import { generateText } from 'ai';
import { getLanguageModel } from '@/lib/ai/providers';
import type { 
  ModePlugin, 
  PluginConfig, 
  PluginInput, 
  PluginOutput, 
  PluginCapability,
  PluginEvent,
  PluginEventHandler 
} from '../types';

export interface SwarmsConfig extends PluginConfig {
  maxAgents?: number;
  maxRounds?: number;
  enableCoordination?: boolean;
  modelPool?: string[];
}

export interface SwarmAgent {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  model: string;
  temperature: number;
}

export interface SwarmResult {
  agents: SwarmAgent[];
  rounds: Array<{
    round: number;
    agentResponses: Array<{
      agentId: string;
      response: string;
      timestamp: number;
    }>;
    consensus?: string;
  }>;
  finalOutput: string;
  metadata: {
    totalTokens: number;
    duration: number;
    iterations: number;
  };
}

class SwarmsPlugin implements ModePlugin {
  readonly id = 'swarms';
  readonly name = 'Swarms';
  readonly version = '1.0.0';
  readonly capabilities: PluginCapability[] = [
    'multi-agent',
    'agent-coordination',
    'consensus-building',
    'parallel-processing',
    'specialized-agents',
  ];

  isInitialized = false;
  isExecuting = false;
  config: SwarmsConfig = {
    maxAgents: 5,
    maxRounds: 3,
    enableCoordination: true,
    modelPool: [
      'anthropic/claude-3-5-sonnet',
      'openai/gpt-4o',
      'google/gemini-1.5-pro',
    ],
  };

  private eventHandlers: Map<string, Set<PluginEventHandler>> = new Map();
  private abortController: AbortController | null = null;

  on(event: string, handler: PluginEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: PluginEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  private emit(event: PluginEvent): void {
    this.eventHandlers.get(event.type)?.forEach(handler => {
      try {
        handler(event);
      } catch (err) {
        console.error(`[SwarmsPlugin] Event handler error:`, err);
      }
    });
  }

  async initialize(config?: SwarmsConfig): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    this.isInitialized = true;
    this.emit({ type: 'initialized', timestamp: Date.now() });
    console.log('[SwarmsPlugin] Initialized');
  }

  async destroy(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isInitialized = false;
    this.eventHandlers.clear();
    this.emit({ type: 'destroyed', timestamp: Date.now() });
  }

  async execute(input: PluginInput): Promise<PluginOutput> {
    if (!this.isInitialized) {
      throw new Error('Plugin not initialized');
    }

    this.isExecuting = true;
    this.abortController = new AbortController();
    
    this.emit({ type: 'started', timestamp: Date.now() });
    const startTime = Date.now();

    try {
      const task = input.prompt;
      const swarmType = (input.options?.swarmType as string) || this.determineSwarmType(task);
      
      // Create specialized agents for the task
      const agents = this.createAgents(swarmType, task);
      
      // Execute swarm workflow
      const result = await this.executeSwarm(agents, task, input.context);

      return {
        success: true,
        content: this.formatSwarmOutput(result),
        artifacts: result.rounds.flatMap(r => 
          r.agentResponses.map(ar => ({
            type: 'code' as const,
            url: `swarm://${ar.agentId}/${r.round}`,
            name: `${ar.agentId}-response.md`,
            metadata: { 
              agentId: ar.agentId,
              round: r.round,
              timestamp: ar.timestamp,
            },
          }))
        ),
      };

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      
      const output: PluginOutput = {
        success: false,
        error: {
          message: error.message,
          code: 'SWARM_ERROR',
          recoverable: error.message.includes('timeout'),
        },
      };

      this.emit({ type: 'error', payload: error, timestamp: Date.now() });
      return output;

    } finally {
      this.isExecuting = false;
      this.abortController = null;
    }
  }

  async cancel(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  hasCapability(capability: PluginCapability): boolean {
    return this.capabilities.includes(capability);
  }

  async health(): Promise<{ healthy: boolean; message?: string }> {
    return { healthy: true };
  }

  private determineSwarmType(task: string): string {
    const lower = task.toLowerCase();
    if (lower.includes('code') || lower.includes('program') || lower.includes('debug')) {
      return 'coding';
    }
    if (lower.includes('write') || lower.includes('content') || lower.includes('blog')) {
      return 'writing';
    }
    if (lower.includes('research') || lower.includes('analyze') || lower.includes('study')) {
      return 'research';
    }
    if (lower.includes('design') || lower.includes('ui') || lower.includes('ux')) {
      return 'design';
    }
    return 'general';
  }

  private createAgents(swarmType: string, task: string): SwarmAgent[] {
    const baseModel = this.config.modelPool?.[0] || 'anthropic/claude-3-5-sonnet';

    const agentTemplates: Record<string, Partial<SwarmAgent>[]> = {
      coding: [
        { name: 'Architect', role: 'Design system architecture and APIs', temperature: 0.2 },
        { name: 'Implementer', role: 'Write clean, efficient code', temperature: 0.3 },
        { name: 'Reviewer', role: 'Review code for bugs and improvements', temperature: 0.2 },
        { name: 'Tester', role: 'Create comprehensive tests', temperature: 0.3 },
        { name: 'Documenter', role: 'Write documentation and examples', temperature: 0.4 },
      ],
      writing: [
        { name: 'Researcher', role: 'Gather facts and sources', temperature: 0.3 },
        { name: 'Writer', role: 'Create engaging content', temperature: 0.6 },
        { name: 'Editor', role: 'Polish and improve clarity', temperature: 0.3 },
        { name: 'FactChecker', role: 'Verify accuracy of claims', temperature: 0.2 },
      ],
      research: [
        { name: 'Analyst', role: 'Analyze data and patterns', temperature: 0.3 },
        { name: 'Synthesizer', role: 'Synthesize findings', temperature: 0.4 },
        { name: 'Critic', role: 'Challenge assumptions', temperature: 0.3 },
        { name: 'Summarizer', role: 'Create concise summary', temperature: 0.3 },
      ],
      design: [
        { name: 'Strategist', role: 'Define user needs and goals', temperature: 0.4 },
        { name: 'Designer', role: 'Create visual designs', temperature: 0.6 },
        { name: 'UXReviewer', role: 'Evaluate usability', temperature: 0.3 },
        { name: 'Implementer', role: 'Generate implementation code', temperature: 0.3 },
      ],
      general: [
        { name: 'Planner', role: 'Break down task into steps', temperature: 0.3 },
        { name: 'Executor', role: 'Execute each step', temperature: 0.4 },
        { name: 'Reviewer', role: 'Review and improve output', temperature: 0.3 },
      ],
    };

    const templates = agentTemplates[swarmType] || agentTemplates.general;
    const maxAgents = this.config.maxAgents || 5;

    return templates.slice(0, maxAgents).map((template, index) => ({
      id: `agent-${index + 1}`,
      name: template.name || `Agent ${index + 1}`,
      role: template.role || 'Assistant',
      systemPrompt: `You are ${template.name}, ${template.role}.

Task: ${task}

Provide your expert contribution. Be specific and actionable. If you identify issues or improvements, clearly state them.`,
      model: baseModel,
      temperature: template.temperature ?? 0.3,
    }));
  }

  private async executeSwarm(
    agents: SwarmAgent[], 
    task: string, 
    context?: PluginInput['context']
  ): Promise<SwarmResult> {
    const rounds: SwarmResult['rounds'] = [];
    const maxRounds = this.config.maxRounds || 3;
    let totalTokens = 0;

    // Initial prompt
    let currentPrompt = task;
    if (context) {
      currentPrompt += `\n\nContext:\n${JSON.stringify(context, null, 2)}`;
    }

    for (let round = 1; round <= maxRounds; round++) {
      this.emit({ 
        type: 'progress', 
        payload: { step: 'round', message: `Round ${round}/${maxRounds}: ${agents.length} agents working...` },
        timestamp: Date.now() 
      });

      // Execute all agents in parallel for this round
      const agentResponses = await Promise.all(
        agents.map(async (agent) => {
          try {
            const model = await getLanguageModel(agent.model);
            
            const { text } = await generateText({
              model,
              system: agent.systemPrompt,
              prompt: `Round ${round}/${maxRounds}\n\nCurrent Task:\n${currentPrompt}`,
              temperature: agent.temperature,
            });

            // Rough token estimation
            totalTokens += text.length / 4;

            return {
              agentId: agent.id,
              response: text,
              timestamp: Date.now(),
            };
          } catch (err) {
            return {
              agentId: agent.id,
              response: `Error: ${err instanceof Error ? err.message : String(err)}`,
              timestamp: Date.now(),
            };
          }
        })
      );

      rounds.push({
        round,
        agentResponses,
      });

      // Check if we should continue to next round
      if (round < maxRounds && this.config.enableCoordination) {
        const consensus = await this.buildConsensus(agentResponses, task);
        if (consensus.isComplete) {
          rounds[rounds.length - 1].consensus = consensus.summary;
          break;
        }
        currentPrompt = `Previous Round Feedback:\n${agentResponses.map(ar => `${ar.agentId}: ${ar.response.substring(0, 500)}...`).join('\n\n')}\n\nRefined Task:\n${consensus.summary}`;
      }
    }

    // Generate final output
    const finalOutput = await this.synthesizeFinalOutput(agents, rounds, task);

    return {
      agents,
      rounds,
      finalOutput,
      metadata: {
        totalTokens: Math.round(totalTokens),
        duration: Date.now() - (rounds[0]?.agentResponses[0]?.timestamp || Date.now()),
        iterations: rounds.length,
      },
    };
  }

  private async buildConsensus(
    responses: Array<{ agentId: string; response: string }>, 
    task: string
  ): Promise<{ isComplete: boolean; summary: string }> {
    const model = await getLanguageModel('anthropic/claude-3-5-sonnet');
    
    const { text } = await generateText({
      model,
      prompt: `Task: ${task}

Agent Responses:
${responses.map(r => `\n${r.agentId}:\n${r.response.substring(0, 800)}...`).join('\n---\n')}

Analyze if the task is complete. If complete, provide a summary. If not, provide guidance for the next round.

Respond in JSON:
{
  "isComplete": boolean,
  "summary": "string - final answer if complete, or guidance for next round",
  "reasoning": "brief explanation"
}`,
      temperature: 0.3,
    });

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return {
          isComplete: data.isComplete,
          summary: data.summary,
        };
      }
    } catch {
      // Fall through to default
    }

    return {
      isComplete: false,
      summary: responses.map(r => r.response).join('\n\n'),
    };
  }

  private async synthesizeFinalOutput(
    agents: SwarmAgent[],
    rounds: SwarmResult['rounds'],
    task: string
  ): Promise<string> {
    const model = await getLanguageModel('anthropic/claude-3-5-sonnet');
    
    const allResponses = rounds.flatMap(r => 
      r.agentResponses.map(ar => `${agents.find(a => a.id === ar.agentId)?.name || ar.agentId}:\n${ar.response.substring(0, 600)}...`)
    ).join('\n\n---\n\n');

    const { text } = await generateText({
      model,
      prompt: `Synthesize a final, comprehensive answer to the task.

Task: ${task}

All Agent Contributions:
${allResponses}

Provide a polished, well-structured final answer that incorporates the best insights from all agents.`,
      temperature: 0.4,
    });

    return text;
  }

  private formatSwarmOutput(result: SwarmResult): string {
    const lines = [
      '# Multi-Agent Swarm Result',
      '',
      `**Agents:** ${result.agents.length} | **Rounds:** ${result.rounds.length} | **Tokens:** ${result.metadata.totalTokens.toLocaleString()}`,
      '',
      '## Agent Team',
      ...result.agents.map(a => `- **${a.name}**: ${a.role}`),
      '',
      '## Execution Rounds',
    ];

    for (const round of result.rounds) {
      lines.push(
        `\n### Round ${round.round}`,
        ...round.agentResponses.map(ar => {
          const agent = result.agents.find(a => a.id === ar.agentId);
          return `\n**${agent?.name || ar.agentId}**\n${ar.response.substring(0, 400)}${ar.response.length > 400 ? '...' : ''}`;
        })
      );
      
      if (round.consensus) {
        lines.push(`\n**Consensus:** ${round.consensus}`);
      }
    }

    lines.push(
      '',
      '---',
      '',
      '## Final Output',
      '',
      result.finalOutput
    );

    return lines.join('\n');
  }
}

export function createSwarmsPlugin(): ModePlugin {
  return new SwarmsPlugin();
}

export default createSwarmsPlugin();
