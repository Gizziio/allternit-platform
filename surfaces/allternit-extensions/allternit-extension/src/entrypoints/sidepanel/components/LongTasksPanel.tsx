import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  cancelLongRunningTask,
  createLongRunningTask,
  deleteLongRunningTask,
  listLongRunningTasks,
  type LongRunningTask,
} from '@/lib/long-tasks/api';

interface LongTasksPanelProps {
  onBack: () => void;
}

export function LongTasksPanel({ onBack }: LongTasksPanelProps) {
  const [tasks, setTasks] = useState<LongRunningTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listLongRunningTasks();
      setTasks(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const handleCreate = async () => {
    if (!title.trim() || !goal.trim()) return;
    setError(null);
    try {
      await createLongRunningTask(title.trim(), goal.trim());
      setTitle('');
      setGoal('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCancel = async (id: string) => {
    setError(null);
    try {
      await cancelLongRunningTask(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    setError(null);
    try {
      await deleteLongRunningTask(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const statusColor: Record<LongRunningTask['status'], string> = {
    pending: 'text-yellow-500',
    running: 'text-blue-500',
    paused: 'text-orange-500',
    completed: 'text-green-500',
    failed: 'text-destructive',
    cancelled: 'text-muted-foreground',
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          ←
        </button>
        <span className="text-sm font-medium">Long-running Tasks</span>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs font-medium text-foreground">Autonomous tasks</p>
          <p className="text-[10px] text-muted-foreground">
            Start tasks that persist even when the sidepanel is closed. The background script polls
            for updates every 15 seconds.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium">Start task</p>
          <div>
            <Label className="text-[10px] text-muted-foreground">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Monitor competitor pricing"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Goal</Label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Describe what the agent should do..."
              className="min-h-[60px] w-full rounded-md border bg-background px-2 py-1 text-xs"
            />
          </div>
          <Button
            size="sm"
            disabled={!title.trim() || !goal.trim()}
            onClick={handleCreate}
            className="h-8 w-full text-xs"
          >
            Start task
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium">Tasks</p>
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No long-running tasks yet.</p>
          ) : (
            <div className="space-y-1.5">
              {tasks.map((task) => (
                <div key={task.id} className="rounded-md border bg-muted/20 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium">{task.title}</p>
                    <span className={`text-[10px] font-medium ${statusColor[task.status]}`}>
                      {task.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{task.goal}</p>
                  {task.status === 'running' || task.status === 'pending' ? (
                    <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-primary"
                        style={{ width: `${Math.max(0, Math.min(100, task.progress))}%` }}
                      />
                    </div>
                  ) : null}
                  <div className="mt-1 flex gap-2">
                    {(task.status === 'running' || task.status === 'pending') && (
                      <button
                        type="button"
                        onClick={() => handleCancel(task.id)}
                        className="text-[10px] text-primary hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(task.id)}
                      className="text-[10px] text-destructive hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                  {task.error && (
                    <p className="mt-1 text-[10px] text-destructive">{task.error}</p>
                  )}
                  {task.result && (
                    <p className="mt-1 text-[10px] text-green-600">{task.result}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
