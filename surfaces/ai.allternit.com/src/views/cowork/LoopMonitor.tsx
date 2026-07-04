import React, { useState, useEffect } from 'react';
import { ArrowCounterClockwise, Stop, Play, Trash, Plus } from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';
import {
  listLoops,
  createLoop,
  updateLoop,
  deleteLoop,
  runLoop,
} from '@/lib/automation-api';
import type { Loop, LoopStatus } from '@/lib/agents/automation.types';

const LoopMonitor: React.FC = () => {
  const [loops, setLoops] = useState<Loop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const [newExitCondition, setNewExitCondition] = useState('');
  const [newMaxIterations, setNewMaxIterations] = useState(10);
  const [newScheduleExpression, setNewScheduleExpression] = useState('1m');
  const [newExecutionDomain, setNewExecutionDomain] = useState<'local' | 'cloud'>('local');

  const fetchLoops = async () => {
    try {
      const data = await listLoops();
      setLoops(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoops();
    const interval = setInterval(fetchLoops, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleStop = async (id: string) => {
    try {
      await updateLoop(id, { status: 'paused' });
      fetchLoops();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResume = async (id: string) => {
    try {
      await updateLoop(id, { status: 'active' });
      fetchLoops();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLoop(id);
      fetchLoops();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newCommand.trim()) return;

    try {
      await createLoop({
        name: newName,
        description: newDescription || undefined,
        schedule_type: 'interval',
        schedule_expression: newScheduleExpression,
        execution_domain: newExecutionDomain,
        config: {
          command: newCommand,
          exit_condition: newExitCondition || undefined,
          max_iterations: newMaxIterations,
        },
      });
      setNewName('');
      setNewDescription('');
      setNewCommand('');
      setNewExitCondition('');
      setNewMaxIterations(10);
      setNewScheduleExpression('1m');
      setNewExecutionDomain('local');
      setShowCreateForm(false);
      fetchLoops();
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusColor = (status: LoopStatus) => {
    switch (status) {
      case 'active': return 'var(--accent-primary)';
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
            <ArrowCounterClockwise size={24} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div>
            <h1 style={{ color: 'var(--text-primary)' }} className="text-2xl font-semibold">Loops</h1>
            <p style={{ color: 'var(--text-secondary)' }} className="text-sm">Monitor recurring command-line execution loops</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors"
          style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--ui-text-inverse)' }}
        >
          <Plus size={18} />
          New Loop
        </button>
      </div>

      {showCreateForm && (
        <GlassSurface className="p-6 rounded-lg">
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div>
              <label style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold block mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Flaky Test Retry"
                className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
                required
              />
            </div>
            <div>
              <label style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold block mb-1">Description</label>
              <input
                type="text"
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                placeholder="What this loop does"
                className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
              />
            </div>
            <div>
              <label style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold block mb-1">Command to Execute</label>
              <input
                type="text"
                value={newCommand}
                onChange={e => setNewCommand(e.target.value)}
                placeholder="e.g. bun test"
                className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
                required
              />
            </div>
            <div>
              <label style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold block mb-1">Exit Condition (text match or exit_code_zero)</label>
              <input
                type="text"
                value={newExitCondition}
                onChange={e => setNewExitCondition(e.target.value)}
                placeholder="e.g. exit_code_zero"
                className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold block mb-1">Max Iterations</label>
                <input
                  type="number"
                  value={newMaxIterations}
                  onChange={e => setNewMaxIterations(Number(e.target.value))}
                  min={1}
                  max={1000}
                  className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
                  required
                />
              </div>
              <div>
                <label style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold block mb-1">Interval</label>
                <input
                  type="text"
                  value={newScheduleExpression}
                  onChange={e => setNewScheduleExpression(e.target.value)}
                  placeholder="1m"
                  className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
                  required
                />
              </div>
              <div>
                <label style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold block mb-1">Domain</label>
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
                Start Loop
              </button>
            </div>
          </form>
        </GlassSurface>
      )}

      {/* Loop list */}
      <div className="flex flex-col gap-4">
        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        ) : loops.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No loops configured.</p>
        ) : (
          loops.map(loop => {
            const config = (loop.config || {}) as Record<string, unknown>;
            const command = typeof config.command === 'string' ? config.command : '';
            const exitCondition = typeof config.exit_condition === 'string' ? config.exit_condition : undefined;
            const maxIterations = typeof config.max_iterations === 'number' ? config.max_iterations : 0;

            return (
              <GlassSurface key={loop.id} className="p-6 rounded-lg flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 style={{ color: 'var(--text-primary)' }} className="text-lg font-semibold">{loop.name}</h3>
                    {loop.description && (
                      <p style={{ color: 'var(--text-secondary)' }} className="text-sm mt-1">{loop.description}</p>
                    )}
                    <p style={{ color: 'var(--text-tertiary)' }} className="text-xs mt-1">
                      {loop.schedule_type} · {loop.schedule_expression} · {loop.execution_domain}
                    </p>
                    {command && (
                      <code style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold bg-[var(--bg-secondary)] px-2 py-1 rounded mt-2 inline-block">
                        {command}
                      </code>
                    )}
                    {exitCondition && (
                      <p style={{ color: 'var(--text-secondary)' }} className="text-xs mt-2">Exit Condition: {exitCondition}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {loop.status === 'active' ? (
                      <button
                        type="button"
                        onClick={() => handleStop(loop.id)}
                        className="p-2 rounded-lg hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: 'var(--status-warning)', color: '#ffffff' }}
                      >
                        <Stop size={16} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleResume(loop.id)}
                        className="p-2 rounded-lg hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--ui-text-inverse)' }}
                      >
                        <Play size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(loop.id)}
                      className="p-2 rounded-lg hover:opacity-90 transition-opacity border"
                      style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-1 text-xs font-semibold rounded-full"
                    style={{ backgroundColor: getStatusColor(loop.status), color: '#ffffff' }}
                  >
                    {loop.status}
                  </span>
                  {maxIterations > 0 && (
                    <span style={{ color: 'var(--text-tertiary)' }} className="text-xs">
                      max iterations: {maxIterations}
                    </span>
                  )}
                </div>
              </GlassSurface>
            );
          })
        )}
      </div>
    </div>
  );
};

export { LoopMonitor };
export default LoopMonitor;
