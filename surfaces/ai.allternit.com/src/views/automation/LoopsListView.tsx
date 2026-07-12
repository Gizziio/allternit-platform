"use client";

import React, { useEffect, useState } from 'react';
import { ArrowsClockwise, Plus, Play, Trash, Pencil } from '@phosphor-icons/react';
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
import type { Loop, ScheduleType, ExecutionDomain, Goal } from '@/lib/agents/automation.types';
import {
  listLoops,
  createLoop,
  updateLoop,
  deleteLoop,
  runLoop,
  listGoals,
} from '@/lib/automation-api';
import { useAgentStore } from '@/lib/agents';
import { formatRelativeTime } from '@/lib/time';

const statusColor: Record<string, string> = {
  active: 'var(--status-success)',
  paused: 'var(--status-warning)',
  disabled: 'var(--ui-text-muted)',
  error: 'var(--status-error)',
};

export function LoopsListView() {
  const [loops, setLoops] = useState<Loop[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingLoop, setEditingLoop] = useState<Loop | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const { agents } = useAgentStore();

  const [form, setForm] = useState<{
    name: string;
    description: string;
    schedule_type: ScheduleType;
    schedule_expression: string;
    session_id: string;
    expires_at: string;
    execution_domain: ExecutionDomain;
    agent_id: string;
    goal_id: string;
  }>({
    name: '',
    description: '',
    schedule_type: 'interval',
    schedule_expression: '5m',
    session_id: '',
    expires_at: '',
    execution_domain: 'local',
    agent_id: '',
    goal_id: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [loopsData, goalsData] = await Promise.all([listLoops(), listGoals()]);
      setLoops(loopsData);
      setGoals(goalsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load loops');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      schedule_type: 'interval',
      schedule_expression: '5m',
      session_id: '',
      expires_at: '',
      execution_domain: 'local',
      agent_id: '',
      goal_id: '',
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      await createLoop({
        name: form.name,
        description: form.description || undefined,
        schedule_type: form.schedule_type,
        schedule_expression: form.schedule_expression,
        session_id: form.session_id || undefined,
        expires_at: form.expires_at || undefined,
        execution_domain: form.execution_domain,
        agent_id: form.agent_id || undefined,
        goal_id: form.goal_id || undefined,
      });
      resetForm();
      setIsCreating(false);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create loop');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLoop) return;
    try {
      await updateLoop(editingLoop.id, {
        name: form.name,
        description: form.description || undefined,
        schedule_type: form.schedule_type,
        schedule_expression: form.schedule_expression,
        expires_at: form.expires_at || undefined,
        execution_domain: form.execution_domain,
        agent_id: form.agent_id || undefined,
        goal_id: form.goal_id || undefined,
      });
      setEditingLoop(null);
      resetForm();
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update loop');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLoop(id);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete loop');
    }
  };

  const handleRun = async (id: string) => {
    try {
      setRunningId(id);
      await runLoop(id);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run loop');
    } finally {
      setRunningId(null);
    }
  };

  const startEdit = (loop: Loop) => {
    setEditingLoop(loop);
    setForm({
      name: loop.name,
      description: loop.description || '',
      schedule_type: loop.schedule_type,
      schedule_expression: loop.schedule_expression,
      session_id: loop.session_id || '',
      expires_at: loop.expires_at ? loop.expires_at.slice(0, 10) : '',
      execution_domain: loop.execution_domain || 'local',
      agent_id: loop.agent_id || '',
      goal_id: loop.goal_id || '',
    });
    setIsCreating(false);
  };

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <ArrowsClockwise size={24} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Loops
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Session-scoped recurring jobs
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setIsCreating(true);
            setEditingLoop(null);
            resetForm();
          }}
          className="flex items-center gap-2"
          style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--ui-text-inverse)' }}
        >
          <Plus size={18} />
          New Loop
        </Button>
      </div>

      {error && (
        <GlassSurface className="p-4 rounded-lg border-l-4" style={{ borderLeftColor: 'var(--status-error)' }}>
          <p className="text-sm" style={{ color: 'var(--status-error)' }}>
            {error}
          </p>
        </GlassSurface>
      )}

      {(isCreating || editingLoop) && (
        <GlassSurface className="p-6 rounded-lg">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            {editingLoop ? 'Edit Loop' : 'Create Loop'}
          </h2>
          <form onSubmit={editingLoop ? handleUpdate : handleCreate} className="flex flex-col gap-4">
            <div>
              <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Loop name"
                className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
              />
            </div>
            <div>
              <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What does this loop do?"
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
                  placeholder="5m"
                  className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
              <div>
                <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Session ID</Label>
                <Input
                  value={form.session_id}
                  onChange={(e) => setForm((f) => ({ ...f, session_id: e.target.value }))}
                  placeholder="Optional"
                  className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
              <div>
                <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Expires At</Label>
                <Input
                  type="date"
                  value={form.expires_at}
                  onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                  className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
              <div>
                <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Execution Domain</Label>
                <Select
                  value={form.execution_domain}
                  onValueChange={(value) => setForm((f) => ({ ...f, execution_domain: value as ExecutionDomain }))}
                >
                  <SelectTrigger className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--bg-card)] border-[var(--border-subtle)]">
                    <SelectItem value="local">Local (this device)</SelectItem>
                    <SelectItem value="cloud">Cloud (always-on)</SelectItem>
                  </SelectContent>
                </Select>
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
              <div>
                <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Goal</Label>
                <Select
                  value={form.goal_id || 'none'}
                  onValueChange={(value) => setForm((f) => ({ ...f, goal_id: value === 'none' ? '' : value }))}
                >
                  <SelectTrigger className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--bg-card)] border-[var(--border-subtle)]">
                    <SelectItem value="none">No goal selected</SelectItem>
                    {goals.map((goal) => (
                      <SelectItem key={goal.id} value={goal.id}>
                        {goal.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsCreating(false);
                  setEditingLoop(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--ui-text-inverse)' }}
              >
                {editingLoop ? 'Save Changes' : 'Create Loop'}
              </Button>
            </div>
          </form>
        </GlassSurface>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="size-8 border-2 border-solid border-[rgba(212,176,140,0.2)] border-t-[var(--accent-primary)] rounded-full animate-spin" />
        </div>
      ) : loops.length === 0 ? (
        <GlassSurface className="p-8 rounded-lg text-center">
          <ArrowsClockwise size={40} className="mx-auto mb-4" style={{ color: 'var(--accent-primary)' }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            No loops yet
          </h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Create a loop to run a recurring job within a session.
          </p>
          <Button
            onClick={() => {
              setIsCreating(true);
              setEditingLoop(null);
              resetForm();
            }}
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--ui-text-inverse)' }}
          >
            Create Loop
          </Button>
        </GlassSurface>
      ) : (
        <div className="flex flex-col gap-4">
          {loops.map((loop) => (
            <GlassSurface key={loop.id} className="p-5 rounded-lg">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {loop.name}
                  </h3>
                  {loop.description && (
                    <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                      {loop.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="px-2.5 py-1 text-xs font-semibold rounded-full whitespace-nowrap"
                    style={{
                      backgroundColor: statusColor[loop.status] || 'var(--ui-text-muted)',
                      color: '#ffffff',
                    }}
                  >
                    {loop.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRun(loop.id)}
                    disabled={runningId === loop.id}
                    className="p-1.5 rounded-md hover:bg-white/5 transition-colors disabled:opacity-50"
                    style={{ color: 'var(--status-success)' }}
                    aria-label="Run loop"
                  >
                    <Play size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(loop)}
                    className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    aria-label="Edit loop"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(loop.id)}
                    className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                    style={{ color: 'var(--status-error)' }}
                    aria-label="Delete loop"
                  >
                    <Trash size={16} />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                <span className="px-2 py-1 rounded border border-[var(--border-subtle)]">
                  {loop.schedule_type}
                </span>
                <span>{loop.schedule_expression}</span>
                {loop.session_id && <span>Session: {loop.session_id}</span>}
                {loop.expires_at && <span>Expires: {new Date(loop.expires_at).toLocaleDateString()}</span>}
                <span
                  className="px-2 py-1 rounded border border-[var(--border-subtle)]"
                  style={{ color: loop.execution_domain === 'cloud' ? 'var(--accent-primary)' : 'inherit' }}
                >
                  {loop.execution_domain}
                </span>
                {loop.goal_id && (
                  <span className="px-2 py-1 rounded border border-[var(--border-subtle)]">
                    Goal: {goals.find((g) => g.id === loop.goal_id)?.title || loop.goal_id}
                  </span>
                )}
                {loop.agent_id && (
                  <span className="px-2 py-1 rounded border border-[var(--border-subtle)]">
                    Agent: {agents.find((a) => a.id === loop.agent_id)?.name || loop.agent_id}
                    {' · '}
                    {agents.find((a) => a.id === loop.agent_id)?.harness?.mode || 'cloud'}
                  </span>
                )}
                <span>Updated {formatRelativeTime(loop.updated_at)}</span>
              </div>
            </GlassSurface>
          ))}
        </div>
      )}
    </div>
  );
}

export default LoopsListView;
