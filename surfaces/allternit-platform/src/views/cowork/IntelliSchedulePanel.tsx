import React from 'react';
import { Lightning, Clock, Warning, CheckCircle, XCircle } from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';
import { useCoworkStore } from './CoworkStore';

const riskIcon = (risk: 'low' | 'medium' | 'high') => {
  switch (risk) {
    case 'high': return <Warning size={14} color="#ef4444" weight="fill" />;
    case 'medium': return <Warning size={14} color="#f59e0b" weight="fill" />;
    default: return <CheckCircle size={14} color="#22c55e" weight="fill" />;
  }
};

const riskLabel = (risk: 'low' | 'medium' | 'high') => {
  switch (risk) {
    case 'high': return 'At Risk';
    case 'medium': return 'Watch';
    default: return 'Safe';
  }
};

export const IntelliSchedulePanel: React.FC = () => {
  const tasks = useCoworkStore((s) => s.tasks);
  const optimizeSchedule = useCoworkStore((s) => s.optimizeSchedule);

  const scheduled = tasks
    .filter((t) => typeof t.optimizeRank === 'number')
    .sort((a, b) => (a.optimizeRank ?? 999) - (b.optimizeRank ?? 999));

  const unranked = tasks.filter((t) => typeof t.optimizeRank !== 'number' && t.status !== 'completed' && t.status !== 'archived');

  if (scheduled.length === 0 && unranked.length === 0) {
    return null;
  }

  return (
    <GlassSurface style={{ padding: '20px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Lightning size={18} color="#06b6d4" weight="fill" />
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Optimized Schedule
          </span>
          {scheduled.length > 0 && (
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '20px',
              backgroundColor: '#06b6d420',
              color: '#06b6d4',
              fontWeight: 600,
            }}>
              {scheduled.length} task{scheduled.length !== 1 ? 's' : ''} ordered
            </span>
          )}
        </div>
        <button
          onClick={optimizeSchedule}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #06b6d440',
            backgroundColor: 'transparent',
            color: '#06b6d4',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Re-optimize
        </button>
      </div>

      {scheduled.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {scheduled.map((task) => (
            <div
              key={task.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#06b6d4',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {task.optimizeRank}
              </span>

              <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                {task.title}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {task.estimatedMinutes && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <Clock size={12} />
                    {task.estimatedMinutes < 60
                      ? `${task.estimatedMinutes}m`
                      : `${Math.floor(task.estimatedMinutes / 60)}h${task.estimatedMinutes % 60 > 0 ? ` ${task.estimatedMinutes % 60}m` : ''}`}
                  </span>
                )}
                {task.risk && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {riskIcon(task.risk)}
                    {riskLabel(task.risk)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--text-secondary)',
          fontSize: '13px',
        }}>
          <XCircle size={16} />
          Run optimization to rank tasks by priority, deadline, and dependencies.
        </div>
      )}

      {unranked.length > 0 && scheduled.length > 0 && (
        <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {unranked.length} task{unranked.length !== 1 ? 's' : ''} without estimates — add time estimates to include in optimization.
        </div>
      )}
    </GlassSurface>
  );
};

export default IntelliSchedulePanel;
