import React, { useState, useEffect } from 'react';
import {
  Target,
  Plus,
} from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';
import { useTaskStore } from './useTaskStore';

interface Goal {
  id: string;
  title: string;
  description: string;
  progress: number; // 0-100
  tasksCompleted: number;
  tasksTotal: number;
  status: 'active' | 'completed' | 'paused';
  dueDate: string;
}

const GoalsView: React.FC = () => {
  const { tasks, fetchTasks } = useTaskStore();
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Map real tasks from the database into Goals format
  const goals: Goal[] = tasks.map(task => ({
    id: task.id,
    title: task.title,
    description: task.description || 'Task created via Allternit / Gizzi',
    progress: task.status === 'completed' ? 100 : task.status === 'in_progress' ? 50 : 0,
    tasksCompleted: task.status === 'completed' ? 1 : 0,
    tasksTotal: 1,
    status: task.status === 'completed' ? 'completed' : task.status === 'in_progress' ? 'active' : 'paused',
    dueDate: task.deadline || 'No deadline set',
  }));

  const getStatusColor = (status: Goal['status']): string => {
    switch (status) {
      case 'active':
        return 'var(--status-success)';
      case 'completed':
        return 'var(--status-info)';
      case 'paused':
        return 'var(--status-warning)';
      default:
        return 'var(--text-tertiary)';
    }
  };

  const getStatusLabel = (status: Goal['status']): string => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Calculate stats
  const totalGoals = goals.length;
  const activeGoals = goals.filter((g) => g.status === 'active').length;
  const completedThisMonth = goals.filter(
    (g) => g.status === 'completed'
  ).length;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <Target
              size={24}
              style={{ color: 'var(--accent-primary)' }}
            />
          </div>
          <div>
            <h1 style={{ color: 'var(--text-primary)' }} className="text-2xl font-semibold">
              Goals
            </h1>
            <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
              Track your objectives and progress
            </p>
          </div>
        </div>
        <button type="button"
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--ui-text-inverse)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          <Plus size={18} />
          New Goal
        </button>
      </div>

      {showForm && (
        <GlassSurface className="p-4 rounded-lg flex flex-col gap-3">
          <h3 style={{ color: 'var(--text-primary)' }} className="text-sm font-semibold">Create New Goal</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newTitle.trim()) {
                useTaskStore.getState().createTask(newTitle, 'agent');
                setNewTitle('');
                setShowForm(false);
              }
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Goal title..."
              className="flex-1 px-3 py-2 rounded-lg text-sm border focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-primary)',
              }}
              required
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--ui-text-inverse)',
              }}
            >
              Create
            </button>
          </form>
        </GlassSurface>
      )}

      {/* Goals List */}
      <div className="flex flex-col gap-4">
        {goals.map((goal) => (
          <GlassSurface key={goal.id} className="p-6 rounded-lg">
            {/* Title and Status */}
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h3 style={{ color: 'var(--text-primary)' }} className="text-lg font-semibold">
                  {goal.title}
                </h3>
                <p
                  style={{ color: 'var(--text-secondary)' }}
                  className="text-sm mt-1"
                >
                  {goal.description}
                </p>
              </div>
              <span
                className="px-2.5 py-1 text-xs font-semibold rounded-full whitespace-nowrap"
                style={{
                  backgroundColor: getStatusColor(goal.status),
                  color: '#ffffff',
                }}
              >
                {getStatusLabel(goal.status)}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${goal.progress}%`,
                    backgroundColor: 'var(--accent-primary)',
                  }}
                />
              </div>
              <div className="flex justify-between items-center mt-2">
                <span style={{ color: 'var(--text-tertiary)' }} className="text-xs">
                  {goal.tasksCompleted} / {goal.tasksTotal} tasks
                </span>
                <span
                  style={{ color: 'var(--text-primary)' }}
                  className="text-xs font-semibold"
                >
                  {goal.progress}%
                </span>
              </div>
            </div>

            {/* Due Date */}
            <p
              style={{ color: 'var(--text-tertiary)' }}
              className="text-xs"
            >
              Due: {goal.dueDate}
            </p>
          </GlassSurface>
        ))}
      </div>

      {/* Stats Footer */}
      <GlassSurface className="p-4 rounded-lg mt-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-6 flex-wrap">
            <div>
              <p style={{ color: 'var(--text-tertiary)' }} className="text-xs uppercase tracking-wider font-medium">
                Goals Total
              </p>
              <p style={{ color: 'var(--text-primary)' }} className="text-xl font-bold mt-1">
                {totalGoals}
              </p>
            </div>
            <div>
              <p style={{ color: 'var(--text-tertiary)' }} className="text-xs uppercase tracking-wider font-medium">
                Active
              </p>
              <p style={{ color: 'var(--text-primary)' }} className="text-xl font-bold mt-1">
                {activeGoals}
              </p>
            </div>
            <div>
              <p style={{ color: 'var(--text-tertiary)' }} className="text-xs uppercase tracking-wider font-medium">
                Completed This Month
              </p>
              <p style={{ color: 'var(--text-primary)' }} className="text-xl font-bold mt-1">
                {completedThisMonth}
              </p>
            </div>
          </div>
        </div>
      </GlassSurface>
    </div>
  );
};

export { GoalsView };
export default GoalsView;
