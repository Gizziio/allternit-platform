import React, { useState } from 'react';

interface AutomationSequence {
  id: string;
  name: string;
  description: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  progress: number;
  triggers: string[];
  lastRun?: string;
  nextRun?: string;
  runCount: number;
}

export const AutomationHub: React.FC = () => {
  const [sequences, setSequences] = useState<AutomationSequence[]>([
    {
      id: 'auto-1',
      name: 'Daily Report Generation',
      description: 'Automatically generate and email daily analytics reports',
      status: 'idle',
      progress: 0,
      triggers: ['schedule: daily 9am', 'manual'],
      runCount: 42,
    },
    {
      id: 'auto-2',
      name: 'Code Review Pipeline',
      description: 'Run automated code review and security scans on PRs',
      status: 'running',
      progress: 65,
      triggers: ['github: pull_request'],
      lastRun: '2026-03-09T10:30:00Z',
      runCount: 156,
    },
    {
      id: 'auto-3',
      name: 'Data Backup',
      description: 'Backup all project data to S3',
      status: 'completed',
      progress: 100,
      triggers: ['schedule: hourly'],
      lastRun: '2026-03-09T11:00:00Z',
      runCount: 720,
    },
    {
      id: 'auto-4',
      name: 'Dependency Updates',
      description: 'Check for and apply security updates',
      status: 'error',
      progress: 30,
      triggers: ['schedule: weekly'],
      lastRun: '2026-03-08T02:00:00Z',
      runCount: 12,
    },
  ]);

  const [showCreateModal, setShowCreateModal] = useState(false);

  const getStatusColor = (status: AutomationSequence['status']) => {
    switch (status) {
      case 'running': return 'var(--accent-info, #3b82f6)';
      case 'completed': return 'var(--accent-success, #10b981)';
      case 'error': return 'var(--accent-error, #ef4444)';
      case 'paused': return 'var(--accent-warning, #f59e0b)';
      default: return 'var(--text-tertiary, #6b7280)';
    }
  };

  const getStatusBgColor = (status: AutomationSequence['status']) => {
    switch (status) {
      case 'running': return 'rgba(59, 130, 246, 0.2)';
      case 'completed': return 'rgba(16, 185, 129, 0.2)';
      case 'error': return 'rgba(239, 68, 68, 0.2)';
      case 'paused': return 'rgba(245, 158, 11, 0.2)';
      default: return 'rgba(107, 114, 128, 0.2)';
    }
  };

  const getStatusIcon = (status: AutomationSequence['status']) => {
    switch (status) {
      case 'running': return '▶️';
      case 'completed': return '✅';
      case 'error': return '❌';
      case 'paused': return '⏸️';
      default: return '⏹️';
    }
  };

  const handleRunSequence = (id: string) => {
    setSequences(prev => prev.map(seq => 
      seq.id === id 
        ? { ...seq, status: 'running', progress: 0 }
        : seq
    ));

    // Simulate progress
    const interval = setInterval(() => {
      setSequences(prev => {
        const seq = prev.find(s => s.id === id);
        if (!seq || seq.status !== 'running') {
          clearInterval(interval);
          return prev;
        }
        
        const newProgress = seq.progress + 10;
        if (newProgress >= 100) {
          clearInterval(interval);
          return prev.map(s => 
            s.id === id 
              ? { ...s, status: 'completed', progress: 100, lastRun: new Date().toISOString(), runCount: s.runCount + 1 }
              : s
          );
        }
        
        return prev.map(s => 
          s.id === id 
            ? { ...s, progress: newProgress }
            : s
        );
      });
    }, 500);
  };

  const handleToggleSequence = (id: string) => {
    setSequences(prev => prev.map(seq => {
      if (seq.id !== id) return seq;
      return {
        ...seq,
        status: seq.status === 'paused' ? 'idle' : 'paused',
      };
    }));
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-primary, #111827)',
    }}>
      {/* Hub Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'var(--bg-secondary, #1f2937)',
        borderBottom: '1px solid var(--border-subtle, #374151)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ fontSize: '20px' }}>🤖</span>
          <h2 style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary, #f9fafb)',
            margin: 0,
          }}>Automation Hub</h2>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '6px 12px',
            background: 'var(--accent-success, #10b981)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          ➕ New Sequence
        </button>
      </div>

      {/* Sequences List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sequences.map(seq => (
            <div
              key={seq.id}
              style={{
                background: 'var(--bg-secondary, #1f2937)',
                border: '1px solid var(--border-subtle, #374151)',
                borderRadius: '8px',
                padding: '16px',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <span style={{ fontSize: '24px' }}>{getStatusIcon(seq.status)}</span>
                  <div>
                    <h3 style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--text-primary, #f9fafb)',
                      margin: '0 0 4px 0',
                    }}>{seq.name}</h3>
                    <p style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary, #9ca3af)',
                      margin: 0,
                    }}>{seq.description}</p>
                  </div>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <button
                    onClick={() => handleRunSequence(seq.id)}
                    disabled={seq.status === 'running'}
                    style={{
                      padding: '6px 12px',
                      background: seq.status === 'running' 
                        ? 'var(--bg-tertiary, #374151)' 
                        : 'var(--accent-primary, #3b82f6)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: seq.status === 'running' ? 'not-allowed' : 'pointer',
                      opacity: seq.status === 'running' ? 0.6 : 1,
                    }}
                  >
                    {seq.status === 'running' ? 'Running...' : '▶ Run'}
                  </button>
                  <button
                    onClick={() => handleToggleSequence(seq.id)}
                    style={{
                      padding: '6px',
                      background: 'transparent',
                      border: '1px solid var(--border-subtle, #374151)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: 'var(--text-secondary, #9ca3af)',
                    }}
                  >
                    {seq.status === 'paused' ? '▶️' : '⏸️'}
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              {seq.status === 'running' && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{
                    width: '100%',
                    height: '8px',
                    background: 'var(--bg-tertiary, #374151)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}>
                    <div
                      style={{
                        height: '100%',
                        background: 'var(--accent-info, #3b82f6)',
                        width: `${seq.progress}%`,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--text-tertiary, #6b7280)',
                    marginTop: '4px',
                  }}>{seq.progress}% complete</div>
                </div>
              )}

              {/* Sequence Details */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '16px',
                fontSize: '12px',
                color: 'var(--text-secondary, #9ca3af)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>🔄</span>
                  <span>{seq.runCount} runs</span>
                </div>
                {seq.lastRun && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>📅</span>
                    <span>Last: {new Date(seq.lastRun).toLocaleDateString()}</span>
                  </div>
                )}
                {seq.nextRun && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>⏰</span>
                    <span>Next: {new Date(seq.nextRun).toLocaleDateString()}</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>⚡</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {seq.triggers.map((t, i) => (
                      <span
                        key={i}
                        style={{
                          padding: '2px 8px',
                          background: 'var(--bg-tertiary, #374151)',
                          borderRadius: '4px',
                          fontSize: '11px',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--bg-secondary, #1f2937)',
            borderRadius: '8px',
            padding: '24px',
            width: '384px',
            border: '1px solid var(--border-subtle, #374151)',
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--text-primary, #f9fafb)',
              margin: '0 0 16px 0',
            }}>Create Automation Sequence</h3>
            <p style={{
              fontSize: '13px',
              color: 'var(--text-secondary, #9ca3af)',
              marginBottom: '16px',
            }}>
              Automation sequences can be created via the WorkflowBuilder or by writing a workflow file.
            </p>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
            }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  color: 'var(--text-secondary, #9ca3af)',
                  border: '1px solid var(--border-subtle, #374151)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: '8px 16px',
                  background: 'var(--accent-primary, #3b82f6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Open WorkflowBuilder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomationHub;
