/**
 * SwarmRunner — server-side execution engine for Agent Swarms.
 *
 * Runs the role pipeline (Worker → Reviewer → Tester → ...) in sequence.
 * Each role receives context from all previous steps.
 * Results are stored in-process; clients poll /api/v1/swarm/executions/:id.
 *
 * State is intentionally in-process (not Redis/DB) — swarms are ephemeral
 * session artifacts. If the server restarts, executions are lost.
 */

import { createSwarmAdapter, type SwarmAdapterConfig } from './provider-adapter';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SwarmRoleConfig extends SwarmAdapterConfig {
  roleId: string;
  roleLabel: string;
  roleDescription: string;
}

export interface SwarmConfig {
  id: string;
  name: string;
  goal: string;
  roles: SwarmRoleConfig[];
  maxIterations: number;
  escalateOnFailure: boolean;
  strategy: string;
}

export type ExecutionStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface RoleOutput {
  roleId: string;
  roleLabel: string;
  providerId: string;
  modelId: string;
  output: string;
  startedAt: number;
  completedAt: number;
  error?: string;
}

export interface SwarmExecution {
  id: string;
  swarmId: string;
  status: ExecutionStatus;
  progress: number;
  roleOutputs: RoleOutput[];
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

// ─── In-process state store ───────────────────────────────────────────────────

const swarmStore = new Map<string, SwarmConfig>();
const executionStore = new Map<string, SwarmExecution>();

export function saveSwarm(config: SwarmConfig): void {
  swarmStore.set(config.id, config);
}

export function getSwarm(id: string): SwarmConfig | undefined {
  return swarmStore.get(id);
}

export function saveExecution(execution: SwarmExecution): void {
  executionStore.set(execution.id, execution);
}

export function getExecution(id: string): SwarmExecution | undefined {
  return executionStore.get(id);
}

function updateExecution(id: string, patch: Partial<SwarmExecution>): void {
  const existing = executionStore.get(id);
  if (existing) executionStore.set(id, { ...existing, ...patch });
}

// ─── System prompts per role ──────────────────────────────────────────────────

function buildSystemPrompt(roleId: string, roleLabel: string, roleDescription: string, goal: string): string {
  const rolePrompts: Record<string, string> = {
    worker: `You are a Worker agent in a multi-agent swarm. Your task is to implement the goal described below.
Write clean, well-structured code or content. Be thorough and complete.
Goal: ${goal}`,
    reviewer: `You are a Reviewer agent in a multi-agent swarm. Your task is to critically review the Worker's output.
Identify bugs, quality issues, edge cases, and improvements. Be specific and constructive.
Goal: ${goal}`,
    tester: `You are a Tester agent in a multi-agent swarm. Your task is to write comprehensive tests for the Worker's output.
Cover happy paths, edge cases, and error conditions. Use the appropriate testing framework.
Goal: ${goal}`,
    researcher: `You are a Researcher agent in a multi-agent swarm. Your task is to gather and synthesize information for the goal.
Goal: ${goal}`,
    analyst: `You are an Analyst agent in a multi-agent swarm. Your task is to extract insights from the gathered information.
Goal: ${goal}`,
    writer: `You are a Writer agent in a multi-agent swarm. Your task is to produce the final deliverable.
Goal: ${goal}`,
  };

  return rolePrompts[roleId] ?? `You are a ${roleLabel} agent. ${roleDescription}. Goal: ${goal}`;
}

function buildUserPrompt(
  role: SwarmRoleConfig,
  goal: string,
  previousOutputs: RoleOutput[],
): string {
  if (previousOutputs.length === 0) {
    return `Please complete the following task:\n\n${goal}`;
  }

  const context = previousOutputs
    .map(o => `## ${o.roleLabel} Output\n\n${o.output}`)
    .join('\n\n---\n\n');

  const roleInstructions: Record<string, string> = {
    reviewer: `Review the Worker's output below and provide specific feedback:\n\n${context}`,
    tester: `Based on the implementation and review below, write comprehensive tests:\n\n${context}`,
    analyst: `Analyze the research gathered below and extract key insights:\n\n${context}`,
    writer: `Using all the information gathered below, produce the final deliverable:\n\n${context}`,
  };

  return roleInstructions[role.roleId] ?? `Here is the context from previous agents:\n\n${context}\n\nNow complete your role: ${role.roleDescription}`;
}

// ─── Runner ───────────────────────────────────────────────────────────────────

export async function runSwarm(
  swarmId: string,
  executionId: string,
  signal: AbortSignal,
): Promise<void> {
  const config = getSwarm(swarmId);
  if (!config) {
    updateExecution(executionId, { status: 'failed', error: 'Swarm config not found' });
    return;
  }

  updateExecution(executionId, { status: 'running', startedAt: Date.now() });

  const roleOutputs: RoleOutput[] = [];
  const totalRoles = config.roles.length;

  for (let i = 0; i < totalRoles; i++) {
    if (signal.aborted) {
      updateExecution(executionId, { status: 'cancelled', completedAt: Date.now() });
      return;
    }

    const role = config.roles[i];
    const startedAt = Date.now();

    updateExecution(executionId, {
      progress: Math.round((i / totalRoles) * 100),
    });

    const adapter = createSwarmAdapter({
      providerId: role.providerId,
      modelId: role.modelId,
      execMode: role.execMode,
      accessToken: role.accessToken,
    });

    const systemPrompt = buildSystemPrompt(role.roleId, role.roleLabel, role.roleDescription, config.goal);
    const userPrompt = buildUserPrompt(role, config.goal, roleOutputs);

    let output = '';
    let error: string | undefined;

    try {
      output = await adapter.invoke({ systemPrompt, userPrompt, signal });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);

      if (config.escalateOnFailure && i < totalRoles - 1) {
        // Try escalating to Claude Sonnet as fallback
        try {
          const { createSwarmAdapter: fallback } = await import('./provider-adapter');
          const fallbackAdapter = fallback({ providerId: 'claude', modelId: 'claude-sonnet-4-6', execMode: 'api' });
          output = await fallbackAdapter.invoke({ systemPrompt, userPrompt, signal });
          error = undefined;
        } catch {
          // Escalation also failed — record the original error and continue
        }
      }

      if (error) {
        roleOutputs.push({ roleId: role.roleId, roleLabel: role.roleLabel, providerId: role.providerId, modelId: role.modelId, output: '', startedAt, completedAt: Date.now(), error });
        const exec = getExecution(executionId);
        updateExecution(executionId, { roleOutputs: [...roleOutputs] });
        // Non-fatal: continue with remaining roles
        continue;
      }
    }

    roleOutputs.push({
      roleId: role.roleId,
      roleLabel: role.roleLabel,
      providerId: role.providerId,
      modelId: role.modelId,
      output,
      startedAt,
      completedAt: Date.now(),
    });

    updateExecution(executionId, {
      roleOutputs: [...roleOutputs],
      progress: Math.round(((i + 1) / totalRoles) * 100),
    });
  }

  updateExecution(executionId, {
    status: 'completed',
    progress: 100,
    completedAt: Date.now(),
  });
}
