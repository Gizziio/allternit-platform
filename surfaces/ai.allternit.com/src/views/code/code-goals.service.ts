import { createGoal as createPlatformGoal, listGoals as listPlatformGoals, updateGoal as updatePlatformGoal } from '@/lib/automation-api';
import type { CreateGoalInput, Goal, GoalStatus } from '@/lib/agents/automation.types';

interface GizziGoal {
  id: string;
  agent_id: string | null;
  objective: string;
  milestones: Array<{ name: string; status: string; completedAt?: string }>;
  validations: Array<{ testName: string; status: string; output?: string }>;
  state: string;
  progress: number;
  time_created: number;
  time_updated: number;
}

export type CodeGoalBackend = 'platform' | 'gizzi';
export type CodeGoalAction = 'run' | 'pause' | 'block' | 'complete';

function statusFromGizzi(state: string): GoalStatus {
  if (state === 'completed') return 'completed';
  if (state === 'paused' || state === 'blocked' || state === 'failed') return 'paused';
  return 'active';
}

function mapGizziGoal(goal: GizziGoal): Goal {
  return {
    id: goal.id,
    user_id: 'local',
    agent_id: goal.agent_id ?? undefined,
    title: goal.objective,
    description: 'Gizzi persistent goal',
    status: statusFromGizzi(goal.state),
    priority: 'high',
    progress: goal.progress,
    metadata: {
      backend: 'gizzi',
      run_state: goal.state,
      goal_run: {
        current_milestone: goal.milestones.find((item) => item.status === 'in_progress')?.name,
        milestones: goal.milestones,
        validations: goal.validations.map((item) => ({ name: item.testName, status: item.status })),
      },
    },
    created_at: new Date(goal.time_created).toISOString(),
    updated_at: new Date(goal.time_updated).toISOString(),
  };
}

async function gizziRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `Gizzi goal API ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function listCodeGoals(): Promise<Goal[]> {
  try {
    return (await listPlatformGoals()).map((goal) => ({
      ...goal,
      metadata: { ...goal.metadata, backend: 'platform' satisfies CodeGoalBackend },
    }));
  } catch (platformError) {
    try {
      return (await gizziRequest<GizziGoal[]>('/v1/automations/goals')).map(mapGizziGoal);
    } catch (gizziError) {
      const platformMessage = platformError instanceof Error ? platformError.message : 'platform unavailable';
      const gizziMessage = gizziError instanceof Error ? gizziError.message : 'Gizzi unavailable';
      throw new Error(`Goals unavailable. Platform: ${platformMessage}. Gizzi: ${gizziMessage}`);
    }
  }
}

export async function createCodeGoal(input: CreateGoalInput): Promise<Goal> {
  try {
    return await createPlatformGoal(input);
  } catch {
    const goal = await gizziRequest<GizziGoal>('/v1/automations/goals', {
      method: 'POST',
      body: JSON.stringify({ objective: input.title, agent_id: input.agent_id }),
    });
    return mapGizziGoal(goal);
  }
}

export async function transitionCodeGoal(goal: Goal, action: CodeGoalAction): Promise<void> {
  const backend = goal.metadata?.backend === 'gizzi' ? 'gizzi' : 'platform';
  if (backend === 'gizzi') {
    await gizziRequest(`/v1/automations/goals/${encodeURIComponent(goal.id)}/${action}`, { method: 'POST' });
    return;
  }

  const state = action === 'run' ? 'running' : action === 'complete' ? 'completed' : action;
  const status: GoalStatus = action === 'complete' ? 'completed' : action === 'pause' || action === 'block' ? 'paused' : 'active';
  await updatePlatformGoal(goal.id, {
    status,
    progress: action === 'complete' ? 100 : goal.progress,
    metadata: { ...goal.metadata, run_state: state },
  });
}
