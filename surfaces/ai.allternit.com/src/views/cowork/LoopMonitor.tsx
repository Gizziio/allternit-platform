import React, { useState, useEffect } from 'react';
import { ArrowCounterClockwise, Stop, Play, Trash, Plus } from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';

interface LoopLogEntry {
  iteration: number;
  output: string;
  exitCode: number;
  timestamp: string;
}

interface LoopExecution {
  id: string;
  command: string;
  exit_condition?: string;
  max_iterations: number;
  iteration_log: LoopLogEntry[];
  state: 'running' | 'succeeded' | 'failed' | 'max_iterations';
}

const LoopMonitor: React.FC = () => {
  const [loops, setLoops] = useState<LoopExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCommand, setNewCommand] = useState('');
  const [newExitCondition, setNewExitCondition] = useState('');
  const [newMaxIterations, setNewMaxIterations] = useState(10);

  const fetchLoops = async () => {
    try {
      const res = await fetch('/api/v1/automations/loops');
      if (res.ok) {
        const data = await res.json();
        setLoops(data);
      }
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
      await fetch(`/api/v1/automations/loops/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'failed' }),
      });
      fetchLoops();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/v1/automations/loops/${id}`, { method: 'DELETE' });
      fetchLoops();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommand.trim()) return;

    try {
      await fetch('/api/v1/automations/loops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: newCommand,
          exit_condition: newExitCondition || null,
          max_iterations: newMaxIterations,
        }),
      });
      setNewCommand('');
      setNewExitCondition('');
      setNewMaxIterations(10);
      setShowCreateForm(false);
      fetchLoops();
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusColor = (state: LoopExecution['state']) => {
    switch (state) {
      case 'running': return 'var(--accent-primary)';
      case 'succeeded': return 'var(--status-success)';
      case 'max_iterations': return 'var(--status-warning)';
      default: return 'var(--status-warning)';
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
            <p style={{ color: 'var(--text-secondary)' }} className="text-sm">Monitor command-line execution loops</p>
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
              <label style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold block mb-1">Exit Condition (Text match or exit code zero)</label>
              <input
                type="text"
                value={newExitCondition}
                onChange={e => setNewExitCondition(e.target.value)}
                placeholder="e.g. exit_code_zero, or a specific string pattern"
                className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
              />
            </div>
            <div>
              <label style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold block mb-1">Max Iterations</label>
              <input
                type="number"
                value={newMaxIterations}
                onChange={e => setNewMaxIterations(Number(e.target.value))}
                min={1}
                max={100}
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
            const currentIteration = loop.iteration_log.length;
            const progressPercent = Math.min(100, (currentIteration / loop.max_iterations) * 100);

            return (
              <GlassSurface key={loop.id} className="p-6 rounded-lg flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <code style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold bg-[var(--bg-secondary)] px-2 py-1 rounded">
                      {loop.command}
                    </code>
                    {loop.exit_condition && (
                      <p style={{ color: 'var(--text-secondary)' }} className="text-xs mt-2">Exit Condition: {loop.exit_condition}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {loop.state === 'running' && (
                      <button
                        type="button"
                        onClick={() => handleStop(loop.id)}
                        className="p-2 rounded-lg hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: 'var(--status-warning)', color: '#ffffff' }}
                      >
                        <Stop size={16} />
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

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Iteration {currentIteration} / {loop.max_iterations}
                    </span>
                    <span className="font-semibold" style={{ color: getStatusColor(loop.state) }}>
                      {loop.state.toUpperCase()}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${progressPercent}%`,
                        backgroundColor: getStatusColor(loop.state),
                      }}
                    />
                  </div>
                </div>

                {/* Latest Output */}
                {loop.iteration_log.length > 0 && (
                  <div className="flex flex-col gap-1 mt-2">
                    <p style={{ color: 'var(--text-secondary)' }} className="text-xs font-semibold">Latest Output (Iteration {currentIteration}):</p>
                    <pre
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
                      className="text-xs p-3 rounded-lg overflow-x-auto max-h-40 border font-mono"
                    >
                      {loop.iteration_log[loop.iteration_log.length - 1].output}
                    </pre>
                  </div>
                )}
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
