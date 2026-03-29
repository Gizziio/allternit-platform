import React, { useState } from 'react';
import {
  Pulse as Activity,
  FileText,
  Lightning,
  Clock,
  CheckSquare,
} from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';

type FilterType = 'all' | 'documents' | 'runs' | 'sessions';

interface ActivityItem {
  id: string;
  type: 'document' | 'run' | 'session' | 'task';
  action: string;
  timestamp: string;
  icon: React.ReactNode;
  iconBg: string;
}

const ActivityView: React.FC = () => {
  const [filter, setFilter] = useState<FilterType>('all');

  // Mock activity data
  const activityData: ActivityItem[] = [
    {
      id: '1',
      type: 'document',
      action: "Created document 'Q4 Strategy'",
      timestamp: '2 hours ago',
      icon: <FileText size={16} />,
      iconBg: '#007aff',
    },
    {
      id: '2',
      type: 'run',
      action: 'Executed analysis workflow',
      timestamp: '4 hours ago',
      icon: <Lightning size={16} />,
      iconBg: '#34c759',
    },
    {
      id: '3',
      type: 'session',
      action: 'Started workspace session',
      timestamp: '6 hours ago',
      icon: <Clock size={16} />,
      iconBg: '#af52de',
    },
    {
      id: '4',
      type: 'task',
      action: 'Completed task "Review Q3 metrics"',
      timestamp: '8 hours ago',
      icon: <CheckSquare size={16} />,
      iconBg: '#ff9500',
    },
    {
      id: '5',
      type: 'document',
      action: "Updated document 'Budget Planning'",
      timestamp: '10 hours ago',
      icon: <FileText size={16} />,
      iconBg: '#007aff',
    },
    {
      id: '6',
      type: 'run',
      action: 'Generated report for stakeholders',
      timestamp: '1 day ago',
      icon: <Lightning size={16} />,
      iconBg: '#34c759',
    },
    {
      id: '7',
      type: 'session',
      action: 'Ended workspace session',
      timestamp: '1 day ago',
      icon: <Clock size={16} />,
      iconBg: '#af52de',
    },
    {
      id: '8',
      type: 'document',
      action: "Shared document 'Team OKRs'",
      timestamp: '2 days ago',
      icon: <FileText size={16} />,
      iconBg: '#007aff',
    },
    {
      id: '9',
      type: 'task',
      action: 'Created task "Research competitors"',
      timestamp: '2 days ago',
      icon: <CheckSquare size={16} />,
      iconBg: '#ff9500',
    },
    {
      id: '10',
      type: 'run',
      action: 'Scheduled recurring analysis',
      timestamp: '3 days ago',
      icon: <Lightning size={16} />,
      iconBg: '#34c759',
    },
  ];

  // Filter items based on selected filter
  const filteredItems =
    filter === 'all'
      ? activityData
      : activityData.filter((item) => {
          if (filter === 'documents') return item.type === 'document';
          if (filter === 'runs') return item.type === 'run';
          if (filter === 'sessions') return item.type === 'session';
          return true;
        });

  const filterOptions: { label: string; value: FilterType }[] = [
    { label: 'All', value: 'all' },
    { label: 'Documents', value: 'documents' },
    { label: 'Runs', value: 'runs' },
    { label: 'Sessions', value: 'sessions' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <Activity
            size={24}
            style={{ color: 'var(--accent-primary)' }}
          />
        </div>
        <div>
          <h1 style={{ color: 'var(--text-primary)' }} className="text-2xl font-semibold">
            Activity
          </h1>
          <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
            Recent workspace actions
          </p>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 flex-wrap">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
            style={{
              backgroundColor:
                filter === option.value
                  ? 'var(--accent-primary)'
                  : 'var(--bg-secondary)',
              color:
                filter === option.value
                  ? '#ffffff'
                  : 'var(--text-secondary)',
              border: `1px solid ${filter === option.value ? 'transparent' : 'var(--border-subtle)'}`,
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Activity Timeline */}
      <div className="flex flex-col">
        {filteredItems.map((item, idx) => (
          <div key={item.id} className="flex gap-4 pb-4">
            {/* Left: Icon */}
            <div className="flex flex-col items-center">
              <div
                className="p-2 rounded-lg text-white"
                style={{ backgroundColor: item.iconBg }}
              >
                {item.icon}
              </div>
              {idx < filteredItems.length - 1 && (
                <div
                  className="w-0.5 h-12 mt-2"
                  style={{ backgroundColor: 'var(--border-subtle)' }}
                />
              )}
            </div>

            {/* Center: Content */}
            <div className="flex-1 min-w-0 pt-1">
              <GlassSurface className="p-3 rounded-lg">
                <p style={{ color: 'var(--text-primary)' }} className="text-sm font-medium">
                  {item.action}
                </p>
                <p
                  style={{ color: 'var(--text-tertiary)' }}
                  className="text-xs mt-1"
                >
                  {item.timestamp}
                </p>
              </GlassSurface>
            </div>

            {/* Right: Badge */}
            <div className="flex items-start pt-1">
              <span
                className="px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                }}
              >
                {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {filteredItems.length === 0 && (
        <div className="text-center py-8">
          <p style={{ color: 'var(--text-tertiary)' }} className="text-sm">
            No activities found for this filter
          </p>
        </div>
      )}
    </div>
  );
};

export { ActivityView };
export default ActivityView;
