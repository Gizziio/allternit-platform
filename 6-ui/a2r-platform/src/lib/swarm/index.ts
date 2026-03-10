/**
 * Meta-Swarm Library Exports
 * 
 * Provides JavaScript/TypeScript integration with the Meta-Swarm system.
 * 
 * Quick Start:
 * ```typescript
 * import { useMetaSwarm, detectSwarmTrigger } from '@a2r/platform/swarm';
 * 
 * // In your component:
 * const { submitTask, isConnected } = useMetaSwarm();
 * 
 * // Submit a task with auto-detected mode:
 * await submitTask('Implement feature X');
 * 
 * // Or use specific mode:
 * await submitTask('Refactor codebase', { mode: 'closed_loop', budget: 10 });
 * ```
 */

// Client and Hook
export {
  MetaSwarmClient,
  useMetaSwarm,
} from './meta-swarm.client';

export type {
  SwarmMode,
  TaskStatus,
  ExecutionPhase,
  TaskConfig,
  TaskHandle,
  AgentStatus,
  ProgressUpdate,
  CostSummary,
  FileConflict,
  KnowledgePattern,
  DashboardState,
  MetaSwarmClientConfig,
  UseMetaSwarmOptions,
} from './meta-swarm.client';

// Swarm Trigger Detection
import {
  detectSwarmTrigger,
  useSwarmTrigger,
  formatSwarmTask,
  extractAgentCount,
  type SwarmTriggerResult,
} from '../../hooks/useSwarmTrigger';

export {
  detectSwarmTrigger,
  useSwarmTrigger,
  formatSwarmTask,
  extractAgentCount,
};

export type { SwarmTriggerResult };

// Natural Language Helpers

/**
 * Check if text contains swarm intent
 */
export function hasSwarmIntent(text: string): boolean {
  const trigger = detectSwarmTrigger(text);
  return trigger.isSwarmTrigger && trigger.confidence >= 0.6;
}

/**
 * Parse natural language command and extract swarm parameters
 */
export function parseSwarmCommand(text: string): {
  task: string;
  mode: string;
  agentCount?: number;
  useSwarm: boolean;
} {
  const trigger = detectSwarmTrigger(text);
  
  if (!trigger.isSwarmTrigger) {
    return { task: text, mode: 'auto', useSwarm: false };
  }

  return {
    task: trigger.task,
    mode: trigger.suggestedMode || 'auto',
    agentCount: extractAgentCount(text),
    useSwarm: true,
  };
}

/**
 * Common swarm command templates
 */
export const SWARM_TEMPLATES = {
  /** Auto-architect optimal agent teams */
  swarmAgentic: (task: string) => `auto-architect: ${task}`,
  
  /** Parallel execution with Claude */
  claudeSwarm: (task: string) => `parallel: ${task}`,
  
  /** Full 5-step production methodology */
  closedLoop: (task: string) => `production: ${task}`,
  
  /** Multi-phase hybrid execution */
  hybrid: (task: string) => `hybrid: ${task}`,
  
  /** Fast execution with N agents */
  withAgents: (task: string, count: number) => `use ${count} agents to ${task}`,
} as const;

/**
 * Mode descriptions for UI display
 */
export const MODE_DESCRIPTIONS: Record<string, { 
  label: string; 
  description: string; 
  icon: string;
  color: string;
}> = {
  swarm_agentic: {
    label: 'Auto-Architect',
    description: 'PSO-evolved optimal agent architectures',
    icon: 'Sparkles',
    color: '#D4956A',
  },
  claude_swarm: {
    label: 'Parallel Swarm',
    description: 'Execute subtasks in parallel waves',
    icon: 'Zap',
    color: '#79C47C',
  },
  closed_loop: {
    label: 'Closed Loop',
    description: '5-step: Brainstorm→Plan→Work→Review→Compound',
    icon: 'RefreshCw',
    color: '#60A5FA',
  },
  hybrid: {
    label: 'Hybrid',
    description: 'Multi-phase mode sequencing',
    icon: 'GitBranch',
    color: '#A78BFA',
  },
  auto: {
    label: 'Auto-Detect',
    description: 'Task-analyzed optimal mode selection',
    icon: 'Bot',
    color: '#9CA3AF',
  },
};

// Re-export from AskUserQuestion for convenience
export {
  SwarmAwareAskUserQuestion,
  SwarmAwareWizard,
  useSwarmAwareQuestion,
} from '../../components/agents/AskUserQuestion.swarm';

export type {
  SwarmAwareQuestionProps,
  SwarmWizardProps,
} from '../../components/agents/AskUserQuestion.swarm';
