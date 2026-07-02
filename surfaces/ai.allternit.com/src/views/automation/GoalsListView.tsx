"use client";

import React, { useEffect, useState } from 'react';
import { Target, Plus, ArrowRight, Trash, Pencil } from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Goal, GoalPriority, GoalStatus } from '@/lib/agents/automation.types';
import {
  listGoals,
  createGoal,
  updateGoal,
  deleteGoal,
} from '@/lib/automation-api';
import { formatRelativeTime } from '@/lib/time';

interface GoalsListViewProps {
  onSelectGoal?: (goal: Goal) => void;
}

const statusLabel: Record<GoalStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  paused: 'Paused',
  archived: 'Archived',
};

const statusColor: Record<GoalStatus, string> = {
  active: 'var(--status-success)',
  completed: 'var(--status-info)',
  paused: 'var(--status-warning)',
  archived: 'var(--ui-text-muted)',
};

export function GoalsListView({ onSelectGoal }: GoalsListViewProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const [form, setForm] = useState<{
    title: string;
    description: string;
    priority: GoalPriority;
    target_date: string;
  }>({
    title: '',
    description: '',
    priority: 'medium',
    target_date: '',
  });

  const fetchGoals = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listGoals();
      setGoals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load goals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      priority: 'medium',
      target_date: '',
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    try {
      await createGoal({
        title: form.title,
        description: form.description || undefined,
        priority: form.priority,
        target_date: form.target_date || undefined,
      });
      resetForm();
      setIsCreating(false);
      await fetchGoals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create goal');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoal) return;
    try {
      await updateGoal(editingGoal.id, {
        title: form.title,
        description: form.description || undefined,
        priority: form.priority,
        target_date: form.target_date || undefined,
      });
      setEditingGoal(null);
      resetForm();
      await fetchGoals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update goal');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteGoal(id);
      await fetchGoals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete goal');
    }
  };

  const startEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setForm({
      title: goal.title,
      description: goal.description || '',
      priority: goal.priority,
      target_date: goal.target_date || '',
    });
    setIsCreating(false);
  };

  const activeGoals = goals.filter((g) => g.status === 'active').length;
  const completedGoals = goals.filter((g) => g.status === 'completed').length;

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <Target size={24} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Goals
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Objectives that organize routines and loops
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setIsCreating(true);
            setEditingGoal(null);
            resetForm();
          }}
          className="flex items-center gap-2"
          style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--ui-text-inverse)' }}
        >
          <Plus size={18} />
          New Goal
        </Button>
      </div>

      {error && (
        <GlassSurface className="p-4 rounded-lg border-l-4" style={{ borderLeftColor: 'var(--status-error)' }}>
          <p className="text-sm" style={{ color: 'var(--status-error)' }}>
            {error}
          </p>
        </GlassSurface>
      )}

      {(isCreating || editingGoal) && (
        <GlassSurface className="p-6 rounded-lg">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            {editingGoal ? 'Edit Goal' : 'Create Goal'}
          </h2>
          <form onSubmit={editingGoal ? handleUpdate : handleCreate} className="flex flex-col gap-4">
            <div>
              <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Goal title"
                className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
              />
            </div>
            <div>
              <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What does this goal achieve?"
                className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
              />
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
              <div>
                <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(value) => setForm((f) => ({ ...f, priority: value as GoalPriority }))}
                >
                  <SelectTrigger className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--bg-card)] border-[var(--border-subtle)]">
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Target Date</Label>
                <Input
                  type="date"
                  value={form.target_date}
                  onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))}
                  className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsCreating(false);
                  setEditingGoal(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--ui-text-inverse)' }}
              >
                {editingGoal ? 'Save Changes' : 'Create Goal'}
              </Button>
            </div>
          </form>
        </GlassSurface>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="size-8 border-2 border-solid border-[rgba(212,176,140,0.2)] border-t-[var(--accent-primary)] rounded-full animate-spin" />
        </div>
      ) : goals.length === 0 ? (
        <GlassSurface className="p-8 rounded-lg text-center">
          <Target size={40} className="mx-auto mb-4" style={{ color: 'var(--accent-primary)' }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            No goals yet
          </h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Create a goal to group routines and loops around an objective.
          </p>
          <Button
            onClick={() => {
              setIsCreating(true);
              setEditingGoal(null);
              resetForm();
            }}
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--ui-text-inverse)' }}
          >
            Create Goal
          </Button>
        </GlassSurface>
      ) : (
        <div className="flex flex-col gap-4">
          {goals.map((goal) => (
            <GlassSurface key={goal.id} className="p-5 rounded-lg">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {goal.title}
                  </h3>
                  {goal.description && (
                    <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                      {goal.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="px-2.5 py-1 text-xs font-semibold rounded-full whitespace-nowrap"
                    style={{
                      backgroundColor: statusColor[goal.status],
                      color: '#ffffff',
                    }}
                  >
                    {statusLabel[goal.status]}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(goal)}
                    className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    aria-label="Edit goal"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(goal.id)}
                    className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                    style={{ color: 'var(--status-error)' }}
                    aria-label="Delete goal"
                  >
                    <Trash size={16} />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(0, goal.progress))}%`,
                      backgroundColor: 'var(--accent-primary)',
                    }}
                  />
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Priority: {goal.priority}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {goal.progress}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {goal.target_date && <span>Target: {goal.target_date}</span>}
                  <span>Updated {formatRelativeTime(goal.updated_at)}</span>
                </div>
                {onSelectGoal && (
                  <button
                    type="button"
                    onClick={() => onSelectGoal(goal)}
                    className="flex items-center gap-1 text-xs font-medium hover:opacity-80 transition-opacity"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    Details <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </GlassSurface>
          ))}
        </div>
      )}

      <GlassSurface className="p-4 rounded-lg mt-auto">
        <div className="flex gap-6 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text-tertiary)' }}>
              Total
            </p>
            <p className="text-xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
              {goals.length}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text-tertiary)' }}>
              Active
            </p>
            <p className="text-xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
              {activeGoals}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text-tertiary)' }}>
              Completed
            </p>
            <p className="text-xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
              {completedGoals}
            </p>
          </div>
        </div>
      </GlassSurface>
    </div>
  );
}

export default GoalsListView;
