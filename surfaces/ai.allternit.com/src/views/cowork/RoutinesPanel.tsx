import React, { useState, useEffect } from 'react';
import { ArrowsClockwise, Play, Plus, Trash } from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';

interface RoutineStep {
  command: string;
  status: 'pending' | 'running' | 'done' | 'failed';
}

interface Routine {
  id: string;
  name: string;
  steps: RoutineStep[];
  trigger?: string;
  schedule?: string;
  state: 'defined' | 'running' | 'completed' | 'failed';
}

const RoutinesPanel: React.FC = () => {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [newRoutineSteps, setNewRoutineSteps] = useState('');
  const [newRoutineTrigger, setNewRoutineTrigger] = useState('');

  const fetchRoutines = async () => {
    try {
      const res = await fetch('/api/v1/automations/routines');
      if (res.ok) {
        const data = await res.json();
        setRoutines(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutines();
    const interval = setInterval(fetchRoutines, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleRun = async (id: string) => {
    try {
      await fetch(`/api/v1/automations/routines/${id}/run`, { method: 'POST' });
      fetchRoutines();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/v1/automations/routines/${id}`, { method: 'DELETE' });
      fetchRoutines();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoutineName.trim()) return;

    const stepCommands = newRoutineSteps
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    const steps = stepCommands.map(command => ({
      command,
      status: 'pending' as const,
    }));

    try {
      await fetch('/api/v1/automations/routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoutineName,
          steps,
          trigger: newRoutineTrigger || null,
        }),
      });
      setNewRoutineName('');
      setNewRoutineSteps('');
      setNewRoutineTrigger('');
      setShowCreateForm(false);
      fetchRoutines();
    } catch (e) {
      console.error(e);
    }
  };

  const getStepStatusColor = (status: RoutineStep['status']) => {
    switch (status) {
      case 'done': return 'var(--status-success)';
      case 'running': return 'var(--accent-primary)';
      case 'failed': return 'var(--status-warning)';
      default: return 'var(--text-tertiary)';
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <ArrowsClockwise size={24} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div>
            <h1 style={{ color: 'var(--text-primary)' }} className="text-2xl font-semibold">Routines</h1>
            <p style={{ color: 'var(--text-secondary)' }} className="text-sm">Manage and execute multi-step workflows</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors"
          style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--ui-text-inverse)' }}
        >
          <Plus size={18} />
          New Routine
        </button>
      </div>

      {showCreateForm && (
        <GlassSurface className="p-6 rounded-lg">
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div>
              <label style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold block mb-1">Name</label>
              <input
                type="text"
                value={newRoutineName}
                onChange={e => setNewRoutineName(e.target.value)}
                placeholder="e.g. Build and Test"
                className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
                required
              />
            </div>
            <div>
              <label style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold block mb-1">Trigger Condition (Optional)</label>
              <input
                type="text"
                value={newRoutineTrigger}
                onChange={e => setNewRoutineTrigger(e.target.value)}
                placeholder="e.g. git-push"
                className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
              />
            </div>
            <div>
              <label style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold block mb-1">Steps (One command per line)</label>
              <textarea
                value={newRoutineSteps}
                onChange={e => setNewRoutineSteps(e.target.value)}
                placeholder="bun run build&#10;bun test"
                rows={4}
                className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
                required
              />
            </div>
            <div className="flex gap-3 justify-end mt-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium border"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--ui-text-inverse)' }}
              >
                Create
              </button>
            </div>
          </form>
        </GlassSurface>
      )}

      {/* Routine list */}
      <div className="flex flex-col gap-4">
        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        ) : routines.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No routines configured.</p>
        ) : (
          routines.map(routine => (
            <GlassSurface key={routine.id} className="p-6 rounded-lg flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 style={{ color: 'var(--text-primary)' }} className="text-lg font-semibold">{routine.name}</h3>
                  {routine.trigger && (
                    <p style={{ color: 'var(--text-secondary)' }} className="text-xs mt-1">Trigger: {routine.trigger}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRun(routine.id)}
                    disabled={routine.state === 'running'}
                    className="p-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                    style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--ui-text-inverse)' }}
                  >
                    <Play size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(routine.id)}
                    className="p-2 rounded-lg hover:opacity-90 transition-opacity border"
                    style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                  >
                    <Trash size={16} />
                  </button>
                </div>
              </div>

              {/* Steps */}
              <div className="flex flex-col gap-2 mt-2">
                {routine.steps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getStepStatusColor(step.status) }} />
                    <code style={{ color: 'var(--text-primary)' }} className="px-1.5 py-0.5 rounded text-xs bg-[var(--bg-secondary)]">
                      {step.command}
                    </code>
                  </div>
                ))}
              </div>
            </GlassSurface>
          ))
        )}
      </div>
    </div>
  );
};

export { RoutinesPanel };
export default RoutinesPanel;
