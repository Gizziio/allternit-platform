/**
 * Automation Types - Goals, Routines, and Loops
 *
 * Mirrors the backend domain types exposed by /api/v1/automation/*.
 */

export type GoalStatus = 'active' | 'completed' | 'paused' | 'archived';
export type GoalPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Goal {
  id: string;
  user_id: string;
  workspace_id?: string;
  agent_id?: string;
  title: string;
  description?: string;
  status: GoalStatus;
  priority: GoalPriority;
  target_date?: string;
  progress: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type RoutineStatus = 'active' | 'paused' | 'disabled' | 'error';
export type LoopStatus = RoutineStatus;

export type ScheduleType = 'cron' | 'interval' | 'once' | 'manual';

export interface Routine {
  id: string;
  user_id: string;
  workspace_id?: string;
  agent_id?: string;
  goal_id?: string;
  gizzi_job_id?: string;
  name: string;
  description?: string;
  status: RoutineStatus;
  schedule_type: ScheduleType;
  schedule_expression: string;
  timezone?: string;
  config: Record<string, unknown>;
  tags?: string[];
  metadata?: Record<string, unknown>;
  max_runs?: number;
  timeout_seconds?: number;
  max_retries?: number;
  created_at: string;
  updated_at: string;
}

export interface Loop {
  id: string;
  user_id: string;
  workspace_id?: string;
  agent_id?: string;
  goal_id?: string;
  gizzi_job_id?: string;
  session_id?: string;
  name: string;
  description?: string;
  status: LoopStatus;
  schedule_type: ScheduleType;
  schedule_expression: string;
  config: Record<string, unknown>;
  tags?: string[];
  metadata?: Record<string, unknown>;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export type RoutineRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TriggeredBy = 'schedule' | 'manual' | 'api' | 'retry';

export interface RoutineRun {
  id: string;
  routine_id: string;
  gizzi_run_id?: string;
  status: RoutineRunStatus;
  scheduled_at: string;
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
  output?: string;
  error?: string;
  attempt: number;
  triggered_by: TriggeredBy;
  metadata?: Record<string, unknown>;
}

export interface GoalChildren {
  routines: Routine[];
  loops: Loop[];
}

export interface CreateGoalInput {
  title: string;
  workspace_id?: string;
  agent_id?: string;
  description?: string;
  priority?: GoalPriority;
  target_date?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateGoalInput {
  title?: string;
  description?: string;
  status?: GoalStatus;
  priority?: GoalPriority;
  target_date?: string;
  progress?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateRoutineInput {
  name: string;
  schedule_type: ScheduleType;
  schedule_expression: string;
  workspace_id?: string;
  agent_id?: string;
  goal_id?: string;
  description?: string;
  timezone?: string;
  config?: Record<string, unknown>;
  tags?: string[];
  metadata?: Record<string, unknown>;
  max_runs?: number;
  timeout_seconds?: number;
  max_retries?: number;
}

export interface UpdateRoutineInput {
  name?: string;
  description?: string;
  status?: RoutineStatus;
  schedule_type?: ScheduleType;
  schedule_expression?: string;
  timezone?: string;
  config?: Record<string, unknown>;
  tags?: string[];
  metadata?: Record<string, unknown>;
  max_runs?: number;
  timeout_seconds?: number;
  max_retries?: number;
}

export interface CreateLoopInput {
  name: string;
  schedule_type: ScheduleType;
  schedule_expression: string;
  workspace_id?: string;
  agent_id?: string;
  goal_id?: string;
  session_id?: string;
  description?: string;
  config?: Record<string, unknown>;
  tags?: string[];
  metadata?: Record<string, unknown>;
  expires_at?: string;
}

export interface UpdateLoopInput {
  name?: string;
  description?: string;
  status?: LoopStatus;
  schedule_type?: ScheduleType;
  schedule_expression?: string;
  config?: Record<string, unknown>;
  tags?: string[];
  metadata?: Record<string, unknown>;
  expires_at?: string;
}
