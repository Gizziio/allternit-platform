import React, { useState, useEffect } from 'react';
import {
  Play,
  CaretDown,
  Robot,
  User,
} from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';

interface Run {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed' | 'queued';
  startTime: string;
  duration: string;
  triggerType: 'Manual' | 'Scheduled' | 'Webhook';
  logExcerpt: string[];
  workspaceId?: string;
  assignedTo?: {
    type: 'human' | 'agent';
    name: string;
    avatar?: string;
  };
  runtime?: 'Local' | 'Cloud';
}

type FilterType = 'All' | 'Running' | 'Completed' | 'Failed';

export const RunsView: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('all');

  useEffect(() => {
    fetch('/api/v1/workspace/runs').then(r => r.json()).then(setRuns).catch(() => {});
  }, []);

  const getStatusColor = (status: Run['status']) => {
    switch (status) {
      case 'running':
        return 'var(--text-primary)';
      case 'completed':
        return '#22c55e';
      case 'failed':
        return '#ef4444';
      case 'queued':
        return '#9ca3af';
      default:
        return 'var(--text-secondary)';
    }
  };

  const getStatusLabel = (status: Run['status']) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const filteredRuns = runs.filter((run) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Running') return run.status === 'running';
    if (activeFilter === 'Completed') return run.status === 'completed';
    if (activeFilter === 'Failed') return run.status === 'failed';
    return true;
  }).filter((run) => {
    if (selectedWorkspace === 'all') return true;
    return run.workspaceId === selectedWorkspace;
  });

  const counts = {
    All: runs.length,
    Running: runs.filter((r) => r.status === 'running').length,
    Completed: runs.filter((r) => r.status === 'completed').length,
    Failed: runs.filter((r) => r.status === 'failed').length,
  };

  const workspaces = Array.from(new Set(runs.map((r) => r.workspaceId).filter(Boolean)));

  return (
    <div style={{ padding: 'var(--spacing-lg)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
          <Play size={24} color="#af52de" fill="#af52de" />
          <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '24px', fontWeight: 600 }}>Pipeline Runs</h1>
        </div>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>Execution history and status</p>
      </div>

      {/* Controls Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-lg)', flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
        {/* Filter Bar */}
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
          {(['All', 'Running', 'Completed', 'Failed'] as FilterType[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              style={{
                padding: 'var(--spacing-xs) var(--spacing-md)',
                borderRadius: '9999px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                backgroundColor:
                  activeFilter === filter ? '#af52de' : 'var(--bg-secondary)',
                color: activeFilter === filter ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.2s ease',
              }}
            >
              {filter} ({counts[filter]})
            </button>
          ))}
        </div>

        {/* Workspace Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Workspace:</label>
          <select
            value={selectedWorkspace}
            onChange={(e) => setSelectedWorkspace(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="all">All workspaces</option>
            {workspaces.map((ws) => (
              <option key={ws} value={ws}>{ws}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Runs List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {filteredRuns.map((run) => (
          <GlassSurface key={run.id} style={{ padding: 'var(--spacing-md)', cursor: 'pointer' }}>
            <div onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}>
              {/* Run Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: expandedRunId === run.id ? 'var(--spacing-md)' : 0 }}>
                {/* Status Indicator */}
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: getStatusColor(run.status),
                    ...(run.status === 'running' && {
                      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                      opacity: 1,
                    }),
                  }}
                />

                {/* Run Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xs)' }}>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>
                      {run.name}
                    </h3>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      {run.triggerType}
                    </span>
                    {run.runtime && (
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: run.runtime === 'Cloud' ? '#dbeafe' : '#fce7f3',
                          color: run.runtime === 'Cloud' ? '#0369a1' : '#be185d',
                          fontWeight: 500,
                        }}
                      >
                        {run.runtime}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--spacing-lg)', fontSize: '13px', color: 'var(--text-secondary)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: getStatusColor(run.status), fontWeight: 500 }}>
                      {getStatusLabel(run.status)}
                    </span>
                    {run.assignedTo && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            backgroundColor: run.assignedTo.type === 'agent' ? '#3b82f6' : '#af52de',
                            color: '#fff',
                            fontSize: '10px',
                          }}
                        >
                          {run.assignedTo.avatar ? (
                            <img src={run.assignedTo.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                          ) : run.assignedTo.type === 'agent' ? (
                            <Robot size={10} weight="fill" />
                          ) : (
                            <User size={10} weight="fill" />
                          )}
                        </span>
                        {run.assignedTo.name}
                      </span>
                    )}
                    <span>Started: {run.startTime}</span>
                    <span>Duration: {run.duration}</span>
                  </div>
                </div>

                {/* Expand Icon */}
                <CaretDown
                  size={18}
                  color="var(--text-tertiary)"
                  style={{
                    transform: expandedRunId === run.id ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                />
              </div>

              {/* Expanded Log View */}
              {expandedRunId === run.id && (
                <div
                  style={{
                    marginTop: 'var(--spacing-md)',
                    paddingTop: 'var(--spacing-md)',
                    borderTop: '1px solid var(--border-subtle)',
                  }}
                >
                  <p style={{ margin: '0 0 var(--spacing-sm) 0', fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500, textTransform: 'uppercase' }}>
                    Log Excerpt:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {run.logExcerpt.map((line, idx) => (
                      <code
                        key={`${run.id}-log-${idx}`}
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          fontFamily: 'Monaco, monospace',
                          backgroundColor: 'var(--bg-secondary)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        {line}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </GlassSurface>
        ))}
      </div>

      {/* Animation Styles */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default RunsView;
