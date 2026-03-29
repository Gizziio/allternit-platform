import React from 'react';
import {
  Target,
  Plus,
} from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';

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
  // Mock goals data
  const goals: Goal[] = [
    {
      id: '1',
      title: 'Q1 Product Launch',
      description: 'Complete development and launch of new product features',
      progress: 85,
      tasksCompleted: 17,
      tasksTotal: 20,
      status: 'active',
      dueDate: 'Mar 31, 2026',
    },
    {
      id: '2',
      title: 'Market Research Initiative',
      description: 'Conduct comprehensive market analysis and competitor review',
      progress: 45,
      tasksCompleted: 9,
      tasksTotal: 20,
      status: 'active',
      dueDate: 'Apr 15, 2026',
    },
    {
      id: '3',
      title: 'Q4 Performance Review',
      description: 'Complete all performance evaluations and feedback sessions',
      progress: 100,
      tasksCompleted: 15,
      tasksTotal: 15,
      status: 'completed',
      dueDate: 'Jan 31, 2026',
    },
    {
      id: '4',
      title: 'Infrastructure Optimization',
      description: 'Reduce system latency and improve resource utilization',
      progress: 30,
      tasksCompleted: 3,
      tasksTotal: 10,
      status: 'paused',
      dueDate: 'May 30, 2026',
    },
  ];

  const getStatusColor = (status: Goal['status']): string => {
    switch (status) {
      case 'active':
        return '#34c759';
      case 'completed':
        return '#007aff';
      case 'paused':
        return '#ff9500';
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
        <button
          className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors"
          style={{
            backgroundColor: '#D4B08C',
            color: '#1A1612',
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
