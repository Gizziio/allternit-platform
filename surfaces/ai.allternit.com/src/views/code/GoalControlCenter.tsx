import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowClockwise,
  CheckCircle,
  CircleNotch,
  Pause,
  Play,
  Plus,
  Stop,
  Target,
  WarningCircle,
} from '@phosphor-icons/react';
import type { Goal, GoalStatus } from '@/lib/agents/automation.types';
import { createCodeGoal, listCodeGoals, transitionCodeGoal } from './code-goals.service';

type GoalRunState = GoalStatus | 'planning' | 'running' | 'validating' | 'blocked' | 'failed';

interface GoalRunMetadata {
  token_budget?: number;
  tokens_used?: number;
  current_milestone?: string;
  milestones?: Array<{ name: string; status: string }>;
  validations?: Array<{ name: string; status: string }>;
  continuation_count?: number;
  blocked_reason?: string;
}

function runMetadata(goal: Goal): GoalRunMetadata {
  const value = goal.metadata?.goal_run;
  return value && typeof value === 'object' ? value as GoalRunMetadata : {};
}

function runState(goal: Goal): GoalRunState {
  const value = goal.metadata?.run_state;
  return typeof value === 'string' ? value as GoalRunState : goal.status;
}

function stateColor(state: GoalRunState): string {
  if (state === 'completed') return 'var(--status-success)';
  if (state === 'blocked' || state === 'failed') return 'var(--status-error)';
  if (state === 'paused') return 'var(--status-warning)';
  if (state === 'running' || state === 'validating' || state === 'active') return 'var(--accent-primary)';
  return 'var(--text-tertiary)';
}

export function GoalControlCenter(): React.ReactNode {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [objective, setObjective] = useState('');
  const [tokenBudget, setTokenBudget] = useState('');
  const [busyGoalId, setBusyGoalId] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setGoals(await listCodeGoals());
      setLastUpdatedAt(Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load goals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const interval = window.setInterval(() => { void refresh(); }, 5_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const summary = useMemo(() => ({
    active: goals.filter((goal) => ['active', 'running', 'planning', 'validating'].includes(runState(goal))).length,
    blocked: goals.filter((goal) => runState(goal) === 'blocked').length,
    complete: goals.filter((goal) => runState(goal) === 'completed').length,
  }), [goals]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = objective.trim();
    if (!title) return;
    const parsedBudget = Number.parseInt(tokenBudget, 10);
    setLoading(true);
    try {
      await createCodeGoal({
        title,
        description: 'Persistent Code Mode goal',
        priority: 'high',
        metadata: {
          run_state: 'planning',
          goal_run: {
            token_budget: Number.isFinite(parsedBudget) && parsedBudget > 0 ? parsedBudget : undefined,
            tokens_used: 0,
            milestones: [],
            validations: [],
            continuation_count: 0,
          },
        },
      });
      setObjective('');
      setTokenBudget('');
      setShowCreate(false);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create goal');
      setLoading(false);
    }
  };

  const transition = async (goal: Goal, state: GoalRunState) => {
    setBusyGoalId(goal.id);
    setError(null);
    try {
      await transitionCodeGoal(goal, state === 'running' ? 'run' : state === 'completed' ? 'complete' : state === 'blocked' ? 'block' : 'pause');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update goal');
    } finally {
      setBusyGoalId(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg-primary)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] text-[var(--accent-primary)]">
            <Target size={19} weight="duotone" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Goal control</h2>
            <p className="text-xs text-[var(--text-tertiary)]">Persistent objectives, budgets, milestones, and evidence</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-tertiary)]">{summary.active} active · {summary.blocked} blocked · {summary.complete} complete{lastUpdatedAt ? ` · synced ${new Date(lastUpdatedAt).toLocaleTimeString()}` : ''}</span>
          <button type="button" onClick={() => void refresh()} aria-label="Refresh goals" className="rounded-lg border border-[var(--ui-border-muted)] p-2 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]">
            <ArrowClockwise size={15} />
          </button>
          <button type="button" onClick={() => setShowCreate((value) => !value)} className="flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3 py-2 text-xs font-semibold text-[var(--ui-text-inverse)]">
            <Plus size={14} weight="bold" /> New goal
          </button>
        </div>
      </header>

      {showCreate && (
        <form onSubmit={create} className="grid gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 md:grid-cols-[minmax(0,1fr)_160px_auto]">
          <input value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="What should Code Mode accomplish?" aria-label="Goal objective" className="rounded-lg border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]" />
          <input value={tokenBudget} onChange={(event) => setTokenBudget(event.target.value)} inputMode="numeric" placeholder="Token budget (optional)" aria-label="Goal token budget" className="rounded-lg border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]" />
          <button type="submit" className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-xs font-semibold text-[var(--ui-text-inverse)]">Create and plan</button>
        </form>
      )}

      {error && <div role="alert" className="m-4 flex items-center gap-2 rounded-lg border border-[var(--status-error)]/30 bg-[var(--status-error)]/10 px-3 py-2 text-xs text-[var(--status-error)]"><WarningCircle size={16} />{error}</div>}

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="grid h-full place-items-center text-[var(--text-tertiary)]"><CircleNotch className="animate-spin" size={22} /></div>
        ) : goals.length === 0 ? (
          <div className="grid h-full place-items-center text-center"><div><Target size={38} className="mx-auto mb-3 text-[var(--text-tertiary)]" /><p className="text-sm font-medium text-[var(--text-secondary)]">No persistent goals yet</p><p className="mt-1 text-xs text-[var(--text-tertiary)]">Create one to give Code Mode a durable objective.</p></div></div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {goals.map((goal) => {
              const metadata = runMetadata(goal);
              const state = runState(goal);
              const budgetPercent = metadata.token_budget
                ? Math.min(100, Math.round(((metadata.tokens_used ?? 0) / metadata.token_budget) * 100))
                : null;
              const completeMilestones = metadata.milestones?.filter((item) => item.status === 'completed').length ?? 0;
              return (
                <article key={goal.id} className="rounded-xl border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">{goal.title}</h3><p className="mt-1 text-xs text-[var(--text-tertiary)]">{metadata.current_milestone ?? 'Waiting for the first milestone'}</p></div>
                    <span className="rounded-full border px-2 py-1 text-[11px] font-semibold capitalize" style={{ borderColor: `color-mix(in srgb, ${stateColor(state)} 35%, transparent)`, color: stateColor(state) }}>{state}</span>
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--bg-secondary)]"><div className="h-full rounded-full bg-[var(--accent-primary)] transition-[width]" style={{ width: `${Math.max(0, Math.min(100, goal.progress))}%` }} /></div>
                  <div className="mt-2 flex flex-wrap justify-between gap-2 text-[11px] text-[var(--text-tertiary)]">
                    <span>{goal.progress}% progress</span>
                    <span>{metadata.milestones?.length ? `${completeMilestones}/${metadata.milestones.length} milestones` : 'No milestones reported'}</span>
                    <span>{budgetPercent === null ? 'No token budget' : `${metadata.tokens_used ?? 0}/${metadata.token_budget} tokens (${budgetPercent}%)`}</span>
                  </div>
                  {metadata.blocked_reason && <p className="mt-3 rounded-lg bg-[var(--status-error)]/10 px-3 py-2 text-xs text-[var(--status-error)]">{metadata.blocked_reason}</p>}
                  {expandedGoalId === goal.id && (
                    <div className="mt-4 grid gap-3 border-t border-[var(--border-subtle)] pt-4 lg:grid-cols-2">
                      <GoalEvidenceList
                        title="Milestones"
                        empty="No milestones have been published."
                        items={(metadata.milestones ?? []).map((item) => ({ label: item.name, status: item.status }))}
                      />
                      <GoalEvidenceList
                        title="Validation evidence"
                        empty="No validation evidence has been published."
                        items={(metadata.validations ?? []).map((item) => ({ label: item.name, status: item.status }))}
                      />
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-3">
                    {state === 'paused' || state === 'blocked' || state === 'failed' ? <Action icon={<Play size={13} />} label="Resume" disabled={busyGoalId === goal.id} onClick={() => void transition(goal, 'running')} /> : <Action icon={<Pause size={13} />} label="Pause" disabled={busyGoalId === goal.id} onClick={() => void transition(goal, 'paused')} />}
                    <Action icon={<Stop size={13} />} label="Block" disabled={busyGoalId === goal.id} onClick={() => void transition(goal, 'blocked')} />
                    <Action icon={<CheckCircle size={13} />} label="Complete" disabled={busyGoalId === goal.id || state === 'completed'} onClick={() => void transition(goal, 'completed')} />
                    <Action icon={<Target size={13} />} label={expandedGoalId === goal.id ? 'Hide evidence' : 'Inspect evidence'} onClick={() => setExpandedGoalId((current) => current === goal.id ? null : goal.id)} />
                    {(metadata.validations?.length ?? 0) > 0 && <span className="ml-auto text-[11px] text-[var(--text-tertiary)]">{metadata.validations?.filter((item) => item.status === 'passed').length}/{metadata.validations?.length} checks passed</span>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Action({ icon, label, disabled, onClick }: { icon: React.ReactNode; label: string; disabled?: boolean; onClick: () => void }): React.ReactNode {
  return <button type="button" disabled={disabled} onClick={onClick} className="flex items-center gap-1.5 rounded-md border border-[var(--ui-border-muted)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40">{icon}{label}</button>;
}

function GoalEvidenceList({ title, empty, items }: { title: string; empty: string; items: Array<{ label: string; status: string }> }): React.ReactNode {
  return <section><h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{title}</h4>{items.length === 0 ? <p className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-[11px] text-[var(--text-tertiary)]">{empty}</p> : <div className="space-y-1.5">{items.map((item) => <div key={`${item.label}:${item.status}`} className="flex items-center gap-2 rounded-lg bg-[var(--bg-secondary)] px-3 py-2"><span className="size-1.5 shrink-0 rounded-full" style={{ background: item.status === 'completed' || item.status === 'passed' ? 'var(--status-success)' : item.status === 'failed' ? 'var(--status-error)' : item.status === 'in_progress' ? 'var(--accent-primary)' : 'var(--text-tertiary)' }} /><span className="min-w-0 flex-1 truncate text-[11px] text-[var(--text-secondary)]">{item.label}</span><span className="text-[9px] uppercase text-[var(--text-tertiary)]">{item.status.replaceAll('_', ' ')}</span></div>)}</div>}</section>;
}
