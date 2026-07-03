"use client";

import React, { useEffect, useState } from 'react';
import { Clock, Plus, Play, Trash, Pencil } from '@phosphor-icons/react';
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
import type { Routine, ScheduleType } from '@/lib/agents/automation.types';
import {
  listRoutines,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  runRoutine,
} from '@/lib/automation-api';
import { useAgentStore } from '@/lib/agents';
import { formatRelativeTime } from '@/lib/time';

const statusColor: Record<string, string> = {
  active: 'var(--status-success)',
  paused: 'var(--status-warning)',
  disabled: 'var(--ui-text-muted)',
  error: 'var(--status-error)',
};

export function RoutinesListView() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const { agents } = useAgentStore();

  const [form, setForm] = useState<{
    name: string;
    description: string;
    schedule_type: ScheduleType;
    schedule_expression: string;
    timezone: string;
    agent_id: string;
  }>({
    name: '',
    description: '',
    schedule_type: 'cron',
    schedule_expression: '0 9 * * *',
    timezone: 'UTC',
    agent_id: '',
  });

  const fetchRoutines = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listRoutines();
      setRoutines(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load routines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutines();
  }, []);

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      schedule_type: 'cron',
      schedule_expression: '0 9 * * *',
      timezone: 'UTC',
      agent_id: '',
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      await createRoutine({
        name: form.name,
        description: form.description || undefined,
        schedule_type: form.schedule_type,
        schedule_expression: form.schedule_expression,
        timezone: form.timezone || undefined,
        agent_id: form.agent_id || undefined,
      });
      resetForm();
      setIsCreating(false);
      await fetchRoutines();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create routine');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoutine) return;
    try {
      await updateRoutine(editingRoutine.id, {
        name: form.name,
        description: form.description || undefined,
        schedule_type: form.schedule_type,
        schedule_expression: form.schedule_expression,
        timezone: form.timezone || undefined,
        agent_id: form.agent_id || undefined,
      });
      setEditingRoutine(null);
      resetForm();
      await fetchRoutines();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update routine');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRoutine(id);
      await fetchRoutines();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete routine');
    }
  };

  const handleRun = async (id: string) => {
    try {
      setRunningId(id);
      await runRoutine(id);
      await fetchRoutines();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run routine');
    } finally {
      setRunningId(null);
    }
  };

  const startEdit = (routine: Routine) => {
    setEditingRoutine(routine);
    setForm({
      name: routine.name,
      description: routine.description || '',
      schedule_type: routine.schedule_type,
      schedule_expression: routine.schedule_expression,
      timezone: routine.timezone || 'UTC',
      agent_id: routine.agent_id || '',
    });
    setIsCreating(false);
  };

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <Clock size={24} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Routines
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Persistent scheduled jobs
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setIsCreating(true);
            setEditingRoutine(null);
            resetForm();
          }}
          className="flex items-center gap-2"
          style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--ui-text-inverse)' }}
        >
          <Plus size={18} />
          New Routine
        </Button>
      </div>

      {error && (
        <GlassSurface className="p-4 rounded-lg border-l-4" style={{ borderLeftColor: 'var(--status-error)' }}>
          <p className="text-sm" style={{ color: 'var(--status-error)' }}>
            {error}
          </p>
        </GlassSurface>
      )}

      {(isCreating || editingRoutine) && (
        <GlassSurface className="p-6 rounded-lg">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            {editingRoutine ? 'Edit Routine' : 'Create Routine'}
          </h2>
          <form onSubmit={editingRoutine ? handleUpdate : handleCreate} className="flex flex-col gap-4">
            <div>
              <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Routine name"
                className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
              />
            </div>
            <div>
              <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What does this routine do?"
                className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
              />
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
              <div>
                <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Schedule Type</Label>
                <Select
                  value={form.schedule_type}
                  onValueChange={(value) => setForm((f) => ({ ...f, schedule_type: value as ScheduleType }))}
                >
                  <SelectTrigger className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--bg-card)] border-[var(--border-subtle)]">
                    <SelectItem value="cron">Cron</SelectItem>
                    <SelectItem value="interval">Interval</SelectItem>
                    <SelectItem value="once">Once</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Expression</Label>
                <Input
                  value={form.schedule_expression}
                  onChange={(e) => setForm((f) => ({ ...f, schedule_expression: e.target.value }))}
                  placeholder="0 9 * * *"
                  className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
              <div>
                <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Timezone</Label>
                <Input
                  value={form.timezone}
                  onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                  placeholder="UTC"
                  className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
              <div>
                <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Agent</Label>
                <Select
                  value={form.agent_id || 'none'}
                  onValueChange={(value) => setForm((f) => ({ ...f, agent_id: value === 'none' ? '' : value }))}
                >
                  <SelectTrigger className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--bg-card)] border-[var(--border-subtle)]">
                    <SelectItem value="none">No agent selected</SelectItem>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.agent_id && (
                  <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                    Harness: {agents.find((a) => a.id === form.agent_id)?.harness?.mode || 'cloud'}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsCreating(false);
                  setEditingRoutine(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--ui-text-inverse)' }}
              >
                {editingRoutine ? 'Save Changes' : 'Create Routine'}
              </Button>
            </div>
          </form>
        </GlassSurface>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="size-8 border-2 border-solid border-[rgba(212,176,140,0.2)] border-t-[var(--accent-primary)] rounded-full animate-spin" />
        </div>
      ) : routines.length === 0 ? (
        <GlassSurface className="p-8 rounded-lg text-center">
          <Clock size={40} className="mx-auto mb-4" style={{ color: 'var(--accent-primary)' }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            No routines yet
          </h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Create a routine to run a job on a schedule.
          </p>
          <Button
            onClick={() => {
              setIsCreating(true);
              setEditingRoutine(null);
              resetForm();
            }}
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--ui-text-inverse)' }}
          >
            Create Routine
          </Button>
        </GlassSurface>
      ) : (
        <div className="flex flex-col gap-4">
          {routines.map((routine) => (
            <GlassSurface key={routine.id} className="p-5 rounded-lg">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {routine.name}
                  </h3>
                  {routine.description && (
                    <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                      {routine.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="px-2.5 py-1 text-xs font-semibold rounded-full whitespace-nowrap"
                    style={{
                      backgroundColor: statusColor[routine.status] || 'var(--ui-text-muted)',
                      color: '#ffffff',
                    }}
                  >
                    {routine.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRun(routine.id)}
                    disabled={runningId === routine.id}
                    className="p-1.5 rounded-md hover:bg-white/5 transition-colors disabled:opacity-50"
                    style={{ color: 'var(--status-success)' }}
                    aria-label="Run routine"
                  >
                    <Play size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(routine)}
                    className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    aria-label="Edit routine"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(routine.id)}
                    className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                    style={{ color: 'var(--status-error)' }}
                    aria-label="Delete routine"
                  >
                    <Trash size={16} />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                <span className="px-2 py-1 rounded border border-[var(--border-subtle)]">
                  {routine.schedule_type}
                </span>
                <span>{routine.schedule_expression}</span>
                {routine.timezone && <span>{routine.timezone}</span>}
                <span>Updated {formatRelativeTime(routine.updated_at)}</span>
              </div>
            </GlassSurface>
          ))}
        </div>
      )}
    </div>
  );
}

export default RoutinesListView;
