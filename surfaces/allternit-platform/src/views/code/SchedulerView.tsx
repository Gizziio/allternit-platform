import React, { useState, useEffect } from 'react';
import { GlassCard } from '../../design/GlassCard';
import {
  Clock,
  Play,
  Pause,
  CheckCircle,
  Calendar,
  ArrowsClockwise,
  Plus,
} from '@phosphor-icons/react';
import { useUnifiedStore } from '@/lib/agents/unified.store';

export function SchedulerView() {
  const { 
    dags,
    executions,
    fetchDags,
    executeDag,
    isLoading 
  } = useUnifiedStore();

  const [jobs, setJobs] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newJobDagId, setNewJobDagId] = useState('');
  const [newJobSchedule, setNewJobSchedule] = useState('0 * * * *');

  // Fetch DAGs on mount
  useEffect(() => {
    fetchDags();
  }, [fetchDags]);

  // Derive scheduled jobs from DAGs with schedule metadata
  useEffect(() => {
    const scheduledJobs = dags
      .filter(dag => (dag.metadata as any)?.schedule) // Only DAGs with schedule metadata
      .map((dag, index) => ({
        id: `job-${dag.dagId}`,
        title: dag.metadata?.title || dag.dagId,
        dagId: dag.dagId,
        schedule: (dag.metadata as any)?.schedule || '0 * * * *',
        status: (dag.metadata as any)?.scheduleStatus || (index === 2 ? 'paused' : 'active'),
        lastRun: executions
          .filter(e => e.dagId === dag.dagId && e.status === 'completed')
          .sort((a, b) => b.startedAt - a.startedAt)[0]?.startedAt,
        nextRun: calculateNextRun((dag.metadata as any)?.schedule || '0 * * * *'),
      }));
    
    // Also add some jobs from DAGs without schedules for demo
    const demoJobs = dags
      .slice(0, 3)
      .filter(dag => !(dag.metadata as any)?.schedule)
      .map((dag, index) => ({
        id: `job-demo-${dag.dagId}`,
        title: `${dag.metadata?.title || dag.dagId} (Auto)`,
        dagId: dag.dagId,
        schedule: index === 0 ? '0 * * * *' : index === 1 ? '0 0 * * *' : '0 12 * * 0',
        status: index === 2 ? 'paused' : 'active',
        lastRun: executions
          .filter(e => e.dagId === dag.dagId && e.status === 'completed')
          .sort((a, b) => b.startedAt - a.startedAt)[0]?.startedAt,
        nextRun: calculateNextRun(index === 0 ? '0 * * * *' : index === 1 ? '0 0 * * *' : '0 12 * * 0'),
        isDemo: true
      }));
    
    setJobs([...scheduledJobs, ...demoJobs]);
  }, [dags, executions]);

  const calculateNextRun = (cronExpr: string): number => {
    // Simple calculation - in production would use a cron parser
    const now = Date.now();
    if (cronExpr === '0 * * * *') {
      // Every hour
      const nextHour = new Date();
      nextHour.setHours(nextHour.getHours() + 1);
      nextHour.setMinutes(0);
      return nextHour.getTime();
    } else if (cronExpr === '0 0 * * *') {
      // Daily at midnight
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow.getTime();
    } else if (cronExpr === '0 12 * * 0') {
      // Weekly on Sunday at noon
      const nextSunday = new Date();
      nextSunday.setDate(nextSunday.getDate() + (7 - nextSunday.getDay()));
      nextSunday.setHours(12, 0, 0, 0);
      return nextSunday.getTime();
    }
    return now + 3600000; // Default 1 hour
  };

  const toggleJobStatus = (jobId: string) => {
    setJobs(prev => prev.map(job => 
      job.id === jobId 
        ? { ...job, status: job.status === 'active' ? 'paused' : 'active' }
        : job
    ));
  };

  const runJobNow = async (dagId: string) => {
    try {
      await executeDag(dagId);
    } catch (err) {
      console.error('Failed to run job:', err);
    }
  };

  const handleCreateJob = () => {
    if (!newJobDagId) return;
    
    const newJob = {
      id: `job-${Date.now()}`,
      title: `${dags.find(d => d.dagId === newJobDagId)?.metadata?.title || newJobDagId} (Custom)`,
      dagId: newJobDagId,
      schedule: newJobSchedule,
      status: 'active',
      lastRun: null,
      nextRun: calculateNextRun(newJobSchedule),
    };
    
    setJobs(prev => [...prev, newJob]);
    setIsCreating(false);
    setNewJobDagId('');
    setNewJobSchedule('0 * * * *');
  };

  return (
    <div style={{ 
      padding: 24, 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 16, 
      height: '100%', 
      overflow: 'auto' 
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 8 
      }}>
        <h2 style={{ 
          fontSize: 18, 
          fontWeight: 800, 
          margin: 0, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 10 
        }}>
          <Clock size={20} color="#0a84ff" />
          Scheduled Jobs
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => fetchDags()}
            disabled={isLoading}
            style={{
              padding: '8px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ArrowsClockwise size={16} color="#888" className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setIsCreating(true)}
            style={{
              padding: '8px 16px',
              background: '#0a84ff',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Plus size={14} />
            New Job
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
        <StatBox 
          label="Active" 
          value={jobs.filter(j => j.status === 'active').length}
          color="#34c759"
        />
        <StatBox 
          label="Paused" 
          value={jobs.filter(j => j.status === 'paused').length}
          color="#8e8e93"
        />
        <StatBox 
          label="Total" 
          value={jobs.length}
          color="#0a84ff"
        />
      </div>

      {/* Create Job Form */}
      {isCreating && (
        <GlassCard style={{ padding: 16, marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: 14 }}>Create New Scheduled Job</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>
                Select DAG
              </label>
              <select
                value={newJobDagId}
                onChange={(e) => setNewJobDagId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  fontSize: 13
                }}
              >
                <option value="">Select a DAG...</option>
                {dags.map(dag => (
                  <option key={dag.dagId} value={dag.dagId}>
                    {dag.metadata?.title || dag.dagId}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>
                Schedule (Cron Expression)
              </label>
              <input
                type="text"
                value={newJobSchedule}
                onChange={(e) => setNewJobSchedule(e.target.value)}
                placeholder="0 * * * *"
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontFamily: 'monospace'
                }}
              />
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                Examples: 0 * * * * (hourly), 0 0 * * * (daily), 0 12 * * 0 (weekly)
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                onClick={() => setIsCreating(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  color: '#888',
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateJob}
                disabled={!newJobDagId}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#0a84ff',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: !newJobDagId ? 'not-allowed' : 'pointer',
                  opacity: !newJobDagId ? 0.5 : 1
                }}
              >
                Create Job
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      {jobs.length === 0 ? (
        <div style={{ 
          flex: 1,
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#666'
        }}>
          <Calendar size={64} style={{ marginBottom: 16, opacity: 0.3 }} />
          <p>No scheduled jobs</p>
          <button
            onClick={() => setIsCreating(true)}
            style={{
              marginTop: 12,
              padding: '10px 20px',
              background: '#0a84ff',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            Create Your First Job
          </button>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
          gap: 16 
        }}>
          {jobs.map(job => (
            <GlassCard 
              key={job.id} 
              style={{ 
                padding: 16, 
                borderLeft: `4px solid ${job.status === 'active' ? '#34c759' : '#8e8e93'}`,
                opacity: job.isDemo ? 0.8 : 1
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start', 
                marginBottom: 12 
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{job.title}</div>
                  <div style={{ 
                    fontSize: 11, 
                    opacity: 0.6, 
                    fontFamily: 'monospace',
                    marginTop: 4
                  }}>
                    {job.schedule}
                  </div>
                  {job.isDemo && (
                    <div style={{
                      fontSize: 10,
                      color: '#f59e0b',
                      marginTop: 4
                    }}>
                      Auto-generated schedule
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => toggleJobStatus(job.id)}
                  style={{ 
                    background: 'transparent', 
                    border: '1px solid var(--border-subtle)', 
                    borderRadius: 6, 
                    padding: '4px 8px', 
                    cursor: 'pointer',
                    color: job.status === 'active' ? '#ff3b30' : '#34c759',
                    fontSize: 10, 
                    fontWeight: 800
                  }}
                >
                  {job.status === 'active' ? 'PAUSE' : 'RESUME'}
                </button>
              </div>
              
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 12, 
                marginTop: 'auto',
                fontSize: 11
              }}>
                {job.lastRun && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 4,
                    color: '#888'
                  }}>
                    <CheckCircle size={14} color="#34c759" />
                    <span>Last: {formatTimeAgo(job.lastRun)}</span>
                  </div>
                )}
                {job.nextRun && job.status === 'active' && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 4,
                    color: '#0a84ff'
                  }}>
                    <Clock size={14} />
                    <span>Next: {formatTimeAgo(job.nextRun)}</span>
                  </div>
                )}
                <button
                  onClick={() => runJobNow(job.dagId)}
                  style={{
                    marginLeft: 'auto',
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    color: '#0a84ff',
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: 4
                  }}
                >
                  <Play size={14} />
                  Run Now
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      padding: '12px 20px',
      background: 'var(--bg-secondary)',
      borderRadius: 8,
      textAlign: 'center',
      borderLeft: `3px solid ${color}`
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 0) {
    // Future time
    const absSeconds = Math.abs(seconds);
    if (absSeconds < 60) return `in ${absSeconds}s`;
    if (absSeconds < 3600) return `in ${Math.floor(absSeconds / 60)}m`;
    if (absSeconds < 86400) return `in ${Math.floor(absSeconds / 3600)}h`;
    return `in ${Math.floor(absSeconds / 86400)}d`;
  }
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
