"use client";

/**
 * Automation API Client
 *
 * Typed client for /api/v1/automation/goals, /routines, and /loops.
 * Uses the canonical AllternitApiClient from integration/api-client.
 */

import { api } from '@/integration/api-client';
import type {
  Goal,
  CreateGoalInput,
  UpdateGoalInput,
  GoalChildren,
  Routine,
  CreateRoutineInput,
  UpdateRoutineInput,
  RoutineRun,
  RoutineMetrics,
  LocalSchedules,
  Loop,
  CreateLoopInput,
  UpdateLoopInput,
} from './agents/automation.types';

export async function listGoals(): Promise<Goal[]> {
  return api.get<Goal[]>('/api/v1/automation/goals');
}

export async function createGoal(input: CreateGoalInput): Promise<Goal> {
  return api.post<Goal>('/api/v1/automation/goals', input);
}

export async function updateGoal(id: string, input: UpdateGoalInput): Promise<Goal> {
  return api.put<Goal>(`/api/v1/automation/goals/${id}`, input);
}

export async function deleteGoal(id: string): Promise<void> {
  return api.delete(`/api/v1/automation/goals/${id}`);
}

export async function getGoal(id: string): Promise<Goal> {
  return api.get<Goal>(`/api/v1/automation/goals/${id}`);
}

export async function getGoalChildren(id: string): Promise<GoalChildren> {
  return api.get<GoalChildren>(`/api/v1/automation/goals/${id}/children`);
}

export async function listRoutines(): Promise<Routine[]> {
  return api.get<Routine[]>('/api/v1/automation/routines');
}

export async function createRoutine(input: CreateRoutineInput): Promise<Routine> {
  return api.post<Routine>('/api/v1/automation/routines', input);
}

export async function updateRoutine(id: string, input: UpdateRoutineInput): Promise<Routine> {
  return api.put<Routine>(`/api/v1/automation/routines/${id}`, input);
}

export async function deleteRoutine(id: string): Promise<void> {
  return api.delete(`/api/v1/automation/routines/${id}`);
}

export async function runRoutine(id: string): Promise<Record<string, unknown>> {
  return api.post<Record<string, unknown>>(`/api/v1/automation/routines/${id}/run`);
}

export async function listRoutineRuns(id: string): Promise<RoutineRun[]> {
  return api.get<RoutineRun[]>(`/api/v1/automation/routines/${id}/runs`);
}

export async function getRoutineMetrics(id: string): Promise<RoutineMetrics> {
  return api.get<RoutineMetrics>(`/api/v1/automation/routines/${id}/metrics`);
}

export async function listLoops(): Promise<Loop[]> {
  return api.get<Loop[]>('/api/v1/automation/loops');
}

export async function listLocalSchedules(): Promise<LocalSchedules> {
  return api.get<LocalSchedules>('/api/v1/automation/local-schedules');
}

export async function createLoop(input: CreateLoopInput): Promise<Loop> {
  return api.post<Loop>('/api/v1/automation/loops', input);
}

export async function updateLoop(id: string, input: UpdateLoopInput): Promise<Loop> {
  return api.put<Loop>(`/api/v1/automation/loops/${id}`, input);
}

export async function deleteLoop(id: string): Promise<void> {
  return api.delete(`/api/v1/automation/loops/${id}`);
}

export async function runLoop(id: string): Promise<Record<string, unknown>> {
  return api.post<Record<string, unknown>>(`/api/v1/automation/loops/${id}/run`);
}
