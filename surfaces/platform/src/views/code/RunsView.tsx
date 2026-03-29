import React, { useEffect } from 'react';
import { GlassCard } from '../../design/GlassCard';
import {
  ClockCounterClockwise,
  CheckCircle,
  XCircle,
  Play,
  CircleNotch,
} from '@phosphor-icons/react';
import { useUnifiedStore } from '@/lib/agents/unified.store';

export function RunsView() {
  const { 
    executions, 
    dags,
    isLoading, 
    fetchDags,
    executeDag, 
    cancelExecution,
    selectRun,
    setActiveMainTab,
  } = useUnifiedStore();

  // Fetch DAGs on mount to get execution history
  useEffect(() => {
    fetchDags();
  }, [fetchDags]);

  const handleRunClick = (runId: string) => {
    selectRun(runId);
    setActiveMainTab('status');
  };

  const handleExecute = async (dagId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await executeDag(dagId);
    } catch (err) {
      // Error handled by store
    }
  };

  // Combine executions with DAG info for display
  const runs = executions.map(exec => {
    const dag = dags.find(d => d.dagId === exec.dagId);
    return {
      ...exec,
      title: dag?.metadata?.title || exec.dagId,
    };
  });

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' }}>
      {runs.length === 0 ? (
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#666'
        }}>
          <ClockCounterClockwise size={64} style={{ marginBottom: 16, opacity: 0.3 }} />
          <p>No executions yet. Start one from the Plan tab.</p>
        </div>
      ) : (
        runs.map(run => (
          <div 
            key={run.runId}
            onClick={() => handleRunClick(run.runId)}
            style={{ cursor: 'pointer' }}
          >
          <GlassCard style={{ 
            padding: 16, 
            display: 'flex', 
            alignItems: 'center', 
            gap: 16,
          }}>
            <div style={{ 
              padding: 10, 
              borderRadius: '50%', 
              background: run.status === 'completed' ? 'rgba(52,199,89,0.1)' : 
                         run.status === 'failed' ? 'rgba(255,59,48,0.1)' : 
                         run.status === 'cancelled' ? 'rgba(255,59,48,0.1)' :
                         'rgba(10,132,255,0.1)'
            }}>
              {run.status === 'running' ? (
                <CircleNotch size={20} color="#0a84ff" className="animate-spin" />
              ) : run.status === 'completed' ? (
                <CheckCircle size={20} color="#34c759" />
              ) : (
                <XCircle size={20} color="#ff3b30" />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{run.title}</div>
              <div style={{ fontSize: 12, opacity: 0.5 }}>{run.runId}</div>
              {run.status === 'running' && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ 
                    height: 4, 
                    background: 'var(--border-subtle)', 
                    borderRadius: 2,
                    overflow: 'hidden'
                  }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${run.progress}%`, 
                      background: '#0a84ff',
                      borderRadius: 2,
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              )}
            </div>
            <div style={{ fontSize: 12, opacity: 0.5, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ClockCounterClockwise size={14} />
              {formatDuration(Date.now() - run.startedAt)}
            </div>
            {run.status === 'running' ? (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  cancelExecution(run.runId);
                }}
                style={{ 
                  padding: 8, 
                  borderRadius: 6, 
                  border: '1px solid #ff3b30', 
                  background: 'transparent', 
                  cursor: 'pointer',
                  color: '#ff3b30'
                }}
              >
                Cancel
              </button>
            ) : (
              <button 
                onClick={(e) => handleExecute(run.dagId, e)}
                disabled={isLoading}
                style={{ 
                  padding: 8, 
                  borderRadius: 6, 
                  border: '1px solid var(--border-subtle)', 
                  background: 'transparent', 
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.5 : 1
                }}
              >
                <Play size={14} />
              </button>
            )}
          </GlassCard>
          </div>
        ))
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
  return `${Math.floor(ms / 3600000)}h`;
}
