/**
 * A2rchitect Super-Agent OS - Orchestrator Engine (MoA)
 * 
 * Mixture-of-Agents orchestration for parallel execution.
 * Implements task decomposition, parallel agent spawning, and result synthesis.
 */

import { useSidecarStore } from '../stores/useSidecarStore';
import type {
  OrchestratorState,
  OrchestratorAgent,
  OrchestratorTaskGraph,
  ResearchDocState,
} from '../types/programs';

// ============================================================================
// Types
// ============================================================================

export interface TaskNode {
  id: string;
  name: string;
  description: string;
  dependencies: string[];
  assignedAgent?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  output?: unknown;
  startTime?: number;
  endTime?: number;
}

export interface AgentConfig {
  id: string;
  name: string;
  role: OrchestratorAgent['role'];
  model: string;
  systemPrompt: string;
  temperature?: number;
}

export interface ExecutionPlan {
  taskGraph: TaskNode[];
  agents: AgentConfig[];
  executionMode: 'sequential' | 'parallel' | 'dag';
}

// ============================================================================
// Task Decomposition
// ============================================================================

export function decomposeTask(prompt: string): ExecutionPlan {
  // This would typically call an LLM to decompose the task
  // For now, we use a rule-based approach based on prompt keywords
  
  const lowerPrompt = prompt.toLowerCase();
  
  // Research tasks
  if (lowerPrompt.includes('research') || lowerPrompt.includes('analyze')) {
    return createResearchPlan(prompt);
  }
  
  // Code tasks
  if (lowerPrompt.includes('code') || lowerPrompt.includes('build') || lowerPrompt.includes('create')) {
    return createCodePlan(prompt);
  }
  
  // Design tasks
  if (lowerPrompt.includes('design') || lowerPrompt.includes('ui') || lowerPrompt.includes('ux')) {
    return createDesignPlan(prompt);
  }
  
  // Default plan
  return createDefaultPlan(prompt);
}

function createResearchPlan(prompt: string): ExecutionPlan {
  return {
    taskGraph: [
      {
        id: 'plan',
        name: 'Plan Research',
        description: 'Create research strategy and identify key sources',
        dependencies: [],
        status: 'pending',
      },
      {
        id: 'search',
        name: 'Web Search',
        description: 'Gather information from web sources',
        dependencies: ['plan'],
        status: 'pending',
      },
      {
        id: 'analyze',
        name: 'Analyze Data',
        description: 'Analyze gathered information for insights',
        dependencies: ['search'],
        status: 'pending',
      },
      {
        id: 'fact-check',
        name: 'Fact Check',
        description: 'Verify key claims and statistics',
        dependencies: ['analyze'],
        status: 'pending',
      },
      {
        id: 'synthesize',
        name: 'Synthesize Report',
        description: 'Compile findings into final report',
        dependencies: ['analyze', 'fact-check'],
        status: 'pending',
      },
    ],
    agents: [
      {
        id: 'planner',
        name: 'Planner',
        role: 'planner',
        model: 'claude-3-opus',
        systemPrompt: 'You are a research planner. Break down complex topics into searchable queries.',
      },
      {
        id: 'researcher',
        name: 'Researcher',
        role: 'researcher',
        model: 'gpt-4',
        systemPrompt: 'You are a web researcher. Gather comprehensive information on topics.',
      },
      {
        id: 'analyst',
        name: 'Analyst',
        role: 'writer',
        model: 'claude-3-sonnet',
        systemPrompt: 'You analyze information and extract key insights.',
      },
      {
        id: 'fact-checker',
        name: 'Fact Checker',
        role: 'fact-checker',
        model: 'claude-3-haiku',
        systemPrompt: 'You verify facts and identify potential inaccuracies.',
      },
      {
        id: 'synthesizer',
        name: 'Synthesizer',
        role: 'synthesizer',
        model: 'claude-3-opus',
        systemPrompt: 'You synthesize multiple sources into coherent reports.',
      },
    ],
    executionMode: 'dag',
  };
}

function createCodePlan(prompt: string): ExecutionPlan {
  return {
    taskGraph: [
      {
        id: 'design',
        name: 'Design Architecture',
        description: 'Design code structure and components',
        dependencies: [],
        status: 'pending',
      },
      {
        id: 'implement',
        name: 'Implement',
        description: 'Write the main code',
        dependencies: ['design'],
        status: 'pending',
      },
      {
        id: 'test',
        name: 'Test',
        description: 'Write and run tests',
        dependencies: ['implement'],
        status: 'pending',
      },
      {
        id: 'review',
        name: 'Review',
        description: 'Code review and optimization',
        dependencies: ['implement'],
        status: 'pending',
      },
    ],
    agents: [
      {
        id: 'architect',
        name: 'Architect',
        role: 'planner',
        model: 'claude-3-opus',
        systemPrompt: 'You design software architecture and plan implementations.',
      },
      {
        id: 'developer',
        name: 'Developer',
        role: 'writer',
        model: 'gpt-4',
        systemPrompt: 'You write clean, efficient code.',
      },
      {
        id: 'tester',
        name: 'Tester',
        role: 'fact-checker',
        model: 'claude-3-sonnet',
        systemPrompt: 'You write comprehensive tests.',
      },
      {
        id: 'reviewer',
        name: 'Reviewer',
        role: 'synthesizer',
        model: 'claude-3-opus',
        systemPrompt: 'You review code for quality and best practices.',
      },
    ],
    executionMode: 'dag',
  };
}

function createDesignPlan(prompt: string): ExecutionPlan {
  return {
    taskGraph: [
      {
        id: 'research',
        name: 'Research',
        description: 'Research design trends and requirements',
        dependencies: [],
        status: 'pending',
      },
      {
        id: 'wireframe',
        name: 'Wireframe',
        description: 'Create wireframes',
        dependencies: ['research'],
        status: 'pending',
      },
      {
        id: 'visual',
        name: 'Visual Design',
        description: 'Create visual design',
        dependencies: ['wireframe'],
        status: 'pending',
      },
    ],
    agents: [
      {
        id: 'researcher',
        name: 'Researcher',
        role: 'researcher',
        model: 'gpt-4',
        systemPrompt: 'You research design trends and user needs.',
      },
      {
        id: 'designer',
        name: 'Designer',
        role: 'designer',
        model: 'claude-3-opus',
        systemPrompt: 'You create beautiful, functional designs.',
      },
    ],
    executionMode: 'sequential',
  };
}

function createDefaultPlan(prompt: string): ExecutionPlan {
  return {
    taskGraph: [
      {
        id: 'task',
        name: 'Execute Task',
        description: prompt,
        dependencies: [],
        status: 'pending',
      },
    ],
    agents: [
      {
        id: 'agent',
        name: 'Agent',
        role: 'writer',
        model: 'claude-3-opus',
        systemPrompt: 'You are a helpful assistant.',
      },
    ],
    executionMode: 'sequential',
  };
}

// ============================================================================
// Orchestrator Execution
// ============================================================================

export class OrchestratorEngine {
  private programId: string;
  private plan: ExecutionPlan;
  private abortController: AbortController;
  private onUpdate: () => void;

  constructor(programId: string, plan: ExecutionPlan, onUpdate: () => void) {
    this.programId = programId;
    this.plan = plan;
    this.abortController = new AbortController();
    this.onUpdate = onUpdate;
  }

  async execute(): Promise<void> {
    const store = useSidecarStore.getState();
    
    // Initialize orchestrator state
    store.setProgramState<OrchestratorState>(this.programId, {
      agents: this.plan.agents.map(a => ({
        id: a.id,
        name: a.name,
        role: a.role,
        status: 'idle',
        model: a.model,
        progress: 0,
        logs: [],
      })),
      taskGraph: {
        nodes: this.plan.taskGraph.map(t => ({
          id: t.id,
          name: t.name,
          dependencies: t.dependencies,
          status: t.status,
        })),
        edges: this.buildEdges(this.plan.taskGraph),
      },
      overallProgress: 0,
      isRunning: true,
      originalPrompt: '',
      executionMode: this.plan.executionMode,
    });

    try {
      if (this.plan.executionMode === 'sequential') {
        await this.executeSequential();
      } else if (this.plan.executionMode === 'parallel') {
        await this.executeParallel();
      } else {
        await this.executeDAG();
      }
    } catch (error) {
      console.error('[Orchestrator] Execution failed:', error);
      throw error;
    }
  }

  abort(): void {
    this.abortController.abort();
  }

  private async executeSequential(): Promise<void> {
    for (const task of this.plan.taskGraph) {
      if (this.abortController.signal.aborted) break;
      await this.executeTask(task);
    }
  }

  private async executeParallel(): Promise<void> {
    const promises = this.plan.taskGraph.map(task => this.executeTask(task));
    await Promise.all(promises);
  }

  private async executeDAG(): Promise<void> {
    const completed = new Set<string>();
    const inProgress = new Set<string>();
    
    const canExecute = (task: TaskNode): boolean => {
      return task.dependencies.every(dep => completed.has(dep));
    };

    const executeReady = async (): Promise<void> => {
      const ready = this.plan.taskGraph.filter(
        t => !completed.has(t.id) && !inProgress.has(t.id) && canExecute(t)
      );

      if (ready.length === 0) {
        if (completed.size === this.plan.taskGraph.length) return;
        // Wait for in-progress tasks
        await new Promise(resolve => setTimeout(resolve, 100));
        return executeReady();
      }

      const executing = ready.map(async task => {
        inProgress.add(task.id);
        await this.executeTask(task);
        completed.add(task.id);
        inProgress.delete(task.id);
      });

      await Promise.all(executing);
      return executeReady();
    };

    await executeReady();
  }

  private async executeTask(task: TaskNode): Promise<void> {
    const store = useSidecarStore.getState();
    
    // Update task status
    this.updateTaskStatus(task.id, 'running');
    
    // Find or assign agent
    const agent = this.plan.agents.find(a => a.role === this.getRoleForTask(task)) || this.plan.agents[0];
    
    // Update agent status
    this.updateAgentStatus(agent.id, 'working', `Executing: ${task.name}`);

    try {
      // Simulate execution (replace with actual kernel call)
      await this.simulateExecution(task, agent);
      
      // Update task as completed
      this.updateTaskStatus(task.id, 'completed');
      this.updateAgentStatus(agent.id, 'completed', `Completed: ${task.name}`);
      
    } catch (error) {
      this.updateTaskStatus(task.id, 'error');
      this.updateAgentStatus(agent.id, 'error', String(error));
      throw error;
    }

    this.updateOverallProgress();
  }

  private async simulateExecution(task: TaskNode, agent: AgentConfig): Promise<void> {
    const steps = 5;
    for (let i = 0; i < steps; i++) {
      if (this.abortController.signal.aborted) {
        throw new Error('Aborted');
      }
      
      this.updateAgentProgress(agent.id, ((i + 1) / steps) * 100);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  private updateTaskStatus(taskId: string, status: TaskNode['status']): void {
    const store = useSidecarStore.getState();
    store.updateProgramState<OrchestratorState>(this.programId, (state) => ({
      ...state,
      taskGraph: {
        ...state.taskGraph,
        nodes: state.taskGraph.nodes.map(n => 
          n.id === taskId ? { ...n, status } : n
        ),
      },
    }));
    this.onUpdate();
  }

  private updateAgentStatus(agentId: string, status: OrchestratorAgent['status'], task?: string): void {
    const store = useSidecarStore.getState();
    store.updateProgramState<OrchestratorState>(this.programId, (state) => ({
      ...state,
      agents: state.agents.map(a => 
        a.id === agentId 
          ? { ...a, status, currentTask: task, logs: task ? [...a.logs, task] : a.logs }
          : a
      ),
    }));
    this.onUpdate();
  }

  private updateAgentProgress(agentId: string, progress: number): void {
    const store = useSidecarStore.getState();
    store.updateProgramState<OrchestratorState>(this.programId, (state) => ({
      ...state,
      agents: state.agents.map(a => 
        a.id === agentId ? { ...a, progress } : a
      ),
    }));
    this.onUpdate();
  }

  private updateOverallProgress(): void {
    const store = useSidecarStore.getState();
    const state = store.getProgramState<OrchestratorState>(this.programId);
    if (!state) return;

    const completed = state.taskGraph.nodes.filter(n => n.status === 'completed').length;
    const total = state.taskGraph.nodes.length;
    const overallProgress = Math.round((completed / total) * 100);

    store.updateProgramState<OrchestratorState>(this.programId, (s) => ({
      ...s,
      overallProgress,
      isRunning: completed < total,
    }));
    this.onUpdate();
  }

  private getRoleForTask(task: TaskNode): OrchestratorAgent['role'] {
    const name = task.name.toLowerCase();
    if (name.includes('plan')) return 'planner';
    if (name.includes('research') || name.includes('search')) return 'researcher';
    if (name.includes('check') || name.includes('verify')) return 'fact-checker';
    if (name.includes('synthesize') || name.includes('compile')) return 'synthesizer';
    if (name.includes('design')) return 'designer';
    return 'writer';
  }

  private buildEdges(tasks: TaskNode[]): { from: string; to: string }[] {
    const edges: { from: string; to: string }[] = [];
    tasks.forEach(task => {
      task.dependencies.forEach(dep => {
        edges.push({ from: dep, to: task.id });
      });
    });
    return edges;
  }
}

// ============================================================================
// React Hook
// ============================================================================

import { useCallback, useRef } from 'react';

export function useOrchestrator() {
  const engineRef = useRef<OrchestratorEngine | null>(null);

  const startOrchestration = useCallback((programId: string, prompt: string) => {
    const plan = decomposeTask(prompt);
    engineRef.current = new OrchestratorEngine(programId, plan, () => {
      // Trigger re-render
    });
    return engineRef.current.execute();
  }, []);

  const abortOrchestration = useCallback(() => {
    engineRef.current?.abort();
  }, []);

  return {
    startOrchestration,
    abortOrchestration,
    decomposeTask,
  };
}
