import React, { useState, useEffect } from 'react';
import { Target, Plus, Trash } from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';
import {
  listGoals,
  createGoal,
  deleteGoal,
  updateGoal,
} from '@/lib/automation-api';
import type { Goal, GoalStatus, GoalPriority } from '@/lib/agents/automation.types';

const GoalsView: React.FC = () => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<GoalPriority>('medium');
  const [newTargetDate, setNewTargetDate] = useState('');

  const fetchGoals = async () => {
    try {
      const data = await listGoals();
      setGoals(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const getStatusColor = (status: GoalStatus): string => {
    switch (status) {
      case 'active':
        return 'var(--status-success)';
      case 'completed':
        return 'var(--status-info)';
      case 'paused':
        return 'var(--status-warning)';
      case 'archived':
        return 'var(--text-tertiary)';
      default:
        return 'var(--text-tertiary)';
    }
  };

  const getStatusLabel = (status: GoalStatus): string => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const totalGoals = goals.length;
  const activeGoals = goals.filter((g) => g.status === 'active').length;
  const completedGoals = goals.filter((g) => g.status === 'completed').length;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      await createGoal({
        title: newTitle,
        description: newDescription || undefined,
        priority: newPriority,
        target_date: newTargetDate || undefined,
      });
      setNewTitle('');
      setNewDescription('');
      setNewPriority('medium');
      setNewTargetDate('');
      setShowForm(false);
      fetchGoals();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteGoal(id);
      fetchGoals();
    } catch (e) {
      console.error(e);
    }
  };

  const handleStatusToggle = async (goal: Goal) => {
    const next: GoalStatus = goal.status === 'active' ? 'completed' : 'active';
    try {
      await updateGoal(goal.id, {
        status: next,
        progress: next === 'completed' ? 100 : goal.progress,
      });
      fetchGoals();
    } catch (e) {
      console.error(e);
    }
  };

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
            onSubmit={handleCreate}
            className="flex flex-col gap-3"
          >
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Goal title..."
              className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-primary)',
              }}
              required
            />
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-primary)',
              }}
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as GoalPriority)}
                className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  borderColor: 'var(--border-primary)',
                }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <input
                type="date"
                value={newTargetDate}
                onChange={(e) => setNewTargetDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  borderColor: 'var(--border-primary)',
                }}
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors self-start"
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
        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        ) : goals.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No goals configured.</p>
        ) : (
          goals.map((goal) => (
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
                    {goal.description || 'No description'}
                  </p>
                  <p style={{ color: 'var(--text-tertiary)' }} className="text-xs mt-1">
                    Priority: {goal.priority}
                    {goal.target_date ? ` · Due: ${goal.target_date}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="px-2.5 py-1 text-xs font-semibold rounded-full whitespace-nowrap cursor-pointer"
                    style={{
                      backgroundColor: getStatusColor(goal.status),
                      color: '#ffffff',
                    }}
                    onClick={() => handleStatusToggle(goal)}
                    title="Click to toggle active/completed"
                  >
                    {getStatusLabel(goal.status)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(goal.id)}
                    className="p-2 rounded-lg hover:opacity-90 transition-opacity border"
                    style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                  >
                    <Trash size={16} />
                  </button>
                </div>
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
                    {goal.status}
                  </span>
                  <span
                    style={{ color: 'var(--text-primary)' }}
                    className="text-xs font-semibold"
                  >
                    {goal.progress}%
                  </span>
                </div>
              </div>
            </GlassSurface>
          ))
        )}
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
                Completed
              </p>
              <p style={{ color: 'var(--text-primary)' }} className="text-xl font-bold mt-1">
                {completedGoals}
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
