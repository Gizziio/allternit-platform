import React, { useState, useEffect } from 'react';
import { ArrowsClockwise, Play, Plus, Trash } from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';
import {
  listRoutines,
  createRoutine,
  deleteRoutine,
  runRoutine,
} from '@/lib/automation-api';
import type { Routine, RoutineStatus } from '@/lib/agents/automation.types';

const RoutinesPanel: React.FC = () => {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [newRoutineDescription, setNewRoutineDescription] = useState('');
  const [newScheduleType, setNewScheduleType] = useState<'cron' | 'interval' | 'once' | 'manual'>('cron');
  const [newScheduleExpression, setNewScheduleExpression] = useState('0 9 * * *');
  const [newExecutionDomain, setNewExecutionDomain] = useState<'local' | 'cloud'>('local');
  const [newConfigJson, setNewConfigJson] = useState('{}');

  const fetchRoutines = async () => {
    try {
      const data = await listRoutines();
      setRoutines(data);
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
      await runRoutine(id);
      fetchRoutines();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRoutine(id);
      fetchRoutines();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoutineName.trim()) return;

    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(newConfigJson || '{}');
    } catch {
      alert('Config must be valid JSON');
      return;
    }

    try {
      await createRoutine({
        name: newRoutineName,
        description: newRoutineDescription || undefined,
        schedule_type: newScheduleType,
        schedule_expression: newScheduleExpression,
        execution_domain: newExecutionDomain,
        config,
      });
      setNewRoutineName('');
      setNewRoutineDescription('');
      setNewScheduleType('cron');
      setNewScheduleExpression('0 9 * * *');
      setNewExecutionDomain('local');
      setNewConfigJson('{}');
      setShowCreateForm(false);
      fetchRoutines();
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusColor = (status: RoutineStatus) => {
    switch (status) {
      case 'active': return 'var(--status-success)';
      case 'paused': return 'var(--status-warning)';
      case 'error': return 'var(--status-error, var(--status-warning))';
      case 'disabled': return 'var(--text-tertiary)';
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
            <p style={{ color: 'var(--text-secondary)' }} className="text-sm">Manage and execute scheduled multi-step workflows</p>
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
              <label style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold block mb-1">Description</label>
              <input
                type="text"
                value={newRoutineDescription}
                onChange={e => setNewRoutineDescription(e.target.value)}
                placeholder="What this routine does"
                className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold block mb-1">Schedule Type</label>
                <select
                  value={newScheduleType}
                  onChange={e => setNewScheduleType(e.target.value as typeof newScheduleType)}
                  className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
                >
                  <option value="cron">cron</option>
                  <option value="interval">interval</option>
                  <option value="once">once</option>
                  <option value="manual">manual</option>
                </select>
              </div>
              <div>
                <label style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold block mb-1">Expression</label>
                <input
                  type="text"
                  value={newScheduleExpression}
                  onChange={e => setNewScheduleExpression(e.target.value)}
                  placeholder={newScheduleType === 'cron' ? '0 9 * * *' : '10m'}
                  className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold block mb-1">Execution Domain</label>
                <select
                  value={newExecutionDomain}
                  onChange={e => setNewExecutionDomain(e.target.value as typeof newExecutionDomain)}
                  className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
                >
                  <option value="local">local</option>
                  <option value="cloud">cloud</option>
                </select>
              </div>
              <div>
                <label style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold block mb-1">Config (JSON)</label>
                <input
                  type="text"
                  value={newConfigJson}
                  onChange={e => setNewConfigJson(e.target.value)}
                  placeholder='{"steps":["bun run build"]}'
                  className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
                />
              </div>
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
                  {routine.description && (
                    <p style={{ color: 'var(--text-secondary)' }} className="text-sm mt-1">{routine.description}</p>
                  )}
                  <p style={{ color: 'var(--text-tertiary)' }} className="text-xs mt-1">
                    {routine.schedule_type} · {routine.schedule_expression} · {routine.execution_domain}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-1 text-xs font-semibold rounded-full"
                    style={{ backgroundColor: getStatusColor(routine.status), color: '#ffffff' }}
                  >
                    {routine.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRun(routine.id)}
                    disabled={routine.status === 'disabled'}
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

              {routine.config && Object.keys(routine.config).length > 0 && (
                <pre
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
                  className="text-xs p-3 rounded-lg overflow-x-auto border font-mono"
                >
                  {JSON.stringify(routine.config, null, 2)}
                </pre>
              )}
            </GlassSurface>
          ))
        )}
      </div>
    </div>
  );
};

export { RoutinesPanel };
export default RoutinesPanel;
