import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar, ArrowsDownUp, Link } from '@phosphor-icons/react';
import { useCoworkStore, type Task } from './CoworkStore';

interface Props {
  task: Task;
  onClose: () => void;
}

export const TaskEstimateModal: React.FC<Props> = ({ task, onClose }) => {
  const setTaskEstimate = useCoworkStore((s) => s.setTaskEstimate);
  const setTaskDeadline = useCoworkStore((s) => s.setTaskDeadline);
  const setTaskDependencies = useCoworkStore((s) => s.setTaskDependencies);
  const setTaskPriority = useCoworkStore((s) => s.setTaskPriority);
  const tasks = useCoworkStore((s) => s.tasks);

  const [hours, setHours] = useState(Math.floor((task.estimatedMinutes ?? 60) / 60));
  const [mins, setMins] = useState((task.estimatedMinutes ?? 60) % 60);
  const [priority, setPriority] = useState(task.priority ?? 50);
  const [deadline, setDeadline] = useState(
    task.deadline ? task.deadline.slice(0, 10) : ''
  );
  const [depInput, setDepInput] = useState('');
  const [selectedDeps, setSelectedDeps] = useState<string[]>(task.dependencies ?? []);

  const otherTasks = tasks.filter((t) => t.id !== task.id && t.status !== 'completed' && t.status !== 'archived');

  const handleSave = () => {
    const totalMinutes = hours * 60 + mins;
    if (totalMinutes > 0) setTaskEstimate(task.id, totalMinutes);
    setTaskPriority(task.id, priority);
    setTaskDeadline(task.id, deadline || null);
    setTaskDependencies(task.id, selectedDeps);
    onClose();
  };

  const toggleDep = (depId: string) => {
    setSelectedDeps((prev) =>
      prev.includes(depId) ? prev.filter((d) => d !== depId) : [...prev, depId]
    );
  };

  const filteredOtherTasks = otherTasks.filter((t) =>
    t.title.toLowerCase().includes(depInput.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '16px',
        padding: '24px',
        width: '480px',
        maxWidth: '95vw',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.3)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Task Estimate
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
          {task.title}
        </p>

        {/* Duration */}
        <div style={{ marginBottom: '20px' }}>
          <div style={labelStyle}><Clock size={12} /> Duration</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <input
                type="number"
                min={0}
                max={999}
                value={hours}
                onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                style={{ ...inputStyle, textAlign: 'center' }}
              />
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '4px' }}>hours</div>
            </div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '18px', marginTop: '-12px' }}>:</span>
            <div style={{ flex: 1 }}>
              <input
                type="number"
                min={0}
                max={59}
                value={mins}
                onChange={(e) => setMins(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                style={{ ...inputStyle, textAlign: 'center' }}
              />
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '4px' }}>minutes</div>
            </div>
          </div>
        </div>

        {/* Priority */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={labelStyle}><ArrowsDownUp size={12} /> Priority</div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: priority >= 70 ? 'var(--status-error)' : priority >= 40 ? 'var(--status-warning)' : 'var(--status-info)' }}>
              {priority >= 70 ? 'High' : priority >= 40 ? 'Medium' : 'Low'} ({priority})
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={100}
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: priority >= 70 ? 'var(--status-error)' : priority >= 40 ? 'var(--status-warning)' : 'var(--status-info)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            <span>Low</span>
            <span>High</span>
          </div>
        </div>

        {/* Deadline */}
        <div style={{ marginBottom: '20px' }}>
          <div style={labelStyle}><Calendar size={12} /> Deadline (optional)</div>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Dependencies */}
        {otherTasks.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={labelStyle}><Link size={12} /> Blocked by (optional)</div>
            <input
              type="text"
              placeholder="Search tasks..."
              value={depInput}
              onChange={(e) => setDepInput(e.target.value)}
              style={{ ...inputStyle, marginBottom: '8px' }}
            />
            <div style={{
              maxHeight: '140px',
              overflowY: 'auto',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-secondary)',
            }}>
              {filteredOtherTasks.slice(0, 20).map((t) => (
                <label
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedDeps.includes(t.id)}
                    onChange={() => toggleDep(t.id)}
                    style={{ accentColor: 'var(--status-info)', flexShrink: 0 }}
                  />
                  {t.title}
                </label>
              ))}
              {filteredOtherTasks.length === 0 && (
                <div style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  No tasks found
                </div>
              )}
            </div>
            {selectedDeps.length > 0 && (
              <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Blocked by {selectedDeps.length} task{selectedDeps.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--status-info)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Save Estimate
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskEstimateModal;
