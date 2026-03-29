import React from 'react';
import {
  ChartBar,
  TrendUp,
  TrendDown,
} from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';

interface StatCard {
  label: string;
  value: string | number;
  trend?: {
    direction: 'up' | 'down';
    percentage: number;
  };
}

interface DocumentBreakdown {
  type: string;
  percentage: number;
  color: string;
}

const InsightsView: React.FC = () => {
  // Mock statistics
  const stats: StatCard[] = [
    {
      label: 'Sessions This Week',
      value: 12,
      trend: { direction: 'up', percentage: 8 },
    },
    {
      label: 'Documents Created',
      value: 8,
      trend: { direction: 'up', percentage: 12 },
    },
    {
      label: 'Tasks Completed',
      value: '23/31',
      trend: { direction: 'down', percentage: 3 },
    },
    {
      label: 'Avg Session',
      value: '47m',
      trend: { direction: 'up', percentage: 5 },
    },
  ];

  // Activity heatmap data: 7 days × 4 weeks
  const heatmapData = Array.from({ length: 28 }, () =>
    Math.random()
  );

  // Document breakdown
  const documentBreakdown: DocumentBreakdown[] = [
    { type: 'Documents', percentage: 45, color: '#007aff' },
    { type: 'Tables', percentage: 30, color: '#af52de' },
    { type: 'Files', percentage: 25, color: '#34c759' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <BarChart2
            size={24}
            style={{ color: 'var(--accent-primary)' }}
          />
        </div>
        <div>
          <h1 style={{ color: 'var(--text-primary)' }} className="text-2xl font-semibold">
            Insights
          </h1>
          <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
            Workspace productivity analytics
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <GlassSurface key={`stat-${stat.label}`} className="p-4 rounded-lg">
            <div className="flex flex-col gap-2">
              <p
                style={{ color: 'var(--text-secondary)' }}
                className="text-xs uppercase tracking-wider font-medium"
              >
                {stat.label}
              </p>
              <div className="flex items-baseline gap-2">
                <span
                  style={{ color: 'var(--text-primary)' }}
                  className="text-3xl font-bold"
                >
                  {stat.value}
                </span>
                {stat.trend && (
                  <div
                    className="flex items-center gap-1 text-xs font-medium"
                    style={{
                      color:
                        stat.trend.direction === 'up'
                          ? '#34c759'
                          : '#ff9500',
                    }}
                  >
                    {stat.trend.direction === 'up' ? (
                      <TrendUp size={14} />
                    ) : (
                      <TrendDown size={14} />
                    )}
                    {stat.trend.percentage}%
                  </div>
                )}
              </div>
            </div>
          </GlassSurface>
        ))}
      </div>

      {/* Activity Heatmap */}
      <GlassSurface className="p-6 rounded-lg">
        <h2
          style={{ color: 'var(--text-primary)' }}
          className="text-lg font-semibold mb-4"
        >
          Activity — Last 28 Days
        </h2>
        <div className="flex flex-wrap gap-1">
          {heatmapData.map((intensity, idx) => (
            <div
              key={`heatmap-${idx}`}
              className="w-4 h-4 rounded-sm"
              style={{
                backgroundColor: '#af52de',
                opacity: Math.max(0.1, intensity),
              }}
              title={`Intensity: ${Math.round(intensity * 100)}%`}
            />
          ))}
        </div>
        <p
          style={{ color: 'var(--text-tertiary)' }}
          className="text-xs mt-3"
        >
          More →
        </p>
      </GlassSurface>

      {/* Document Breakdown */}
      <GlassSurface className="p-6 rounded-lg">
        <h2
          style={{ color: 'var(--text-primary)' }}
          className="text-lg font-semibold mb-4"
        >
          Document Breakdown
        </h2>
        <div className="flex flex-col gap-4">
          {documentBreakdown.map((item) => (
            <div key={`doc-${item.type}`} className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--text-secondary)' }} className="text-sm">
                  {item.type}
                </span>
                <span
                  style={{ color: 'var(--text-primary)' }}
                  className="text-sm font-semibold"
                >
                  {item.percentage}%
                </span>
              </div>
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${item.percentage}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </GlassSurface>
    </div>
  );
};

export { InsightsView };
export default InsightsView;
