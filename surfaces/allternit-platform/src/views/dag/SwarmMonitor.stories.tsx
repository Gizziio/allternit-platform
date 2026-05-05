import React from "react";
import type { Meta, StoryObj } from "@storybook/react";

// Complete mock component that shows all SwarmMonitor features
const SwarmMonitorComplete = () => {
  const [selectedThreadId, setSelectedThreadId] = React.useState('T1');
  const [sidebarExpanded, setSidebarExpanded] = React.useState(true);
  const [showHealthPanel, setShowHealthPanel] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  
  const threads = [
    { id: 'T1', goal: 'Search codebase', status: 'running', progress: 78, tactic: 'search', children: ['T2', 'T3'], tokenCount: 4523, elapsedSeconds: 3600, pinned: false },
    { id: 'T2', goal: 'Analyze JWT', status: 'running', progress: 45, tactic: 'analyze', children: [], tokenCount: 2134, elapsedSeconds: 1800, pinned: false, parentId: 'T1' },
    { id: 'T3', goal: 'Review middleware', status: 'paused', progress: 23, tactic: 'review', children: [], tokenCount: 892, elapsedSeconds: 600, pinned: false, parentId: 'T1' },
    { id: 'T4', goal: 'Refactor API', status: 'running', progress: 67, tactic: 'refactor', children: ['T5'], tokenCount: 6789, elapsedSeconds: 7200, pinned: true },
    { id: 'T5', goal: 'Update tests', status: 'compacting', progress: 95, tactic: 'test', children: [], tokenCount: 3456, elapsedSeconds: 2400, pinned: false, parentId: 'T4' },
    { id: 'T6', goal: 'Deploy staging', status: 'completed', progress: 100, tactic: 'deploy', children: [], tokenCount: 1234, elapsedSeconds: 240, pinned: false },
    { id: 'T7', goal: 'Lint code', status: 'running', progress: 56, tactic: 'lint', children: [], tokenCount: 567, elapsedSeconds: 600, pinned: false },
    { id: 'T8', goal: 'Build assets', status: 'failed', progress: 34, tactic: 'build', children: [], tokenCount: 0, elapsedSeconds: 30, pinned: false },
  ];
  
  const selectedThread = threads.find(t => t.id === selectedThreadId) || threads[0];
  
  const StatusDot = ({ status, size = 'sm' }: { status: string; size?: 'sm' | 'lg' }) => {
    const colors: Record<string, string> = {
      running: '#10b981',
      paused: '#f59e0b',
      completed: '#3b82f6',
      failed: '#ef4444',
      pending: '#64748b',
      compacting: '#a855f7',
    };
    const sizePx = size === 'lg' ? 12 : 8;
    return (
      <span style={{ 
        width: sizePx, height: sizePx, borderRadius: '50%', 
        background: colors[status] || colors.pending,
        display: 'inline-block',
        animation: (status === 'running' || status === 'compacting') ? 'pulse 2s infinite' : undefined
      }} />
    );
  };
  
  return (
    <div style={{ height: '100vh', width: '100vw', background: '#0d0d0d', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Top Strip */}
      <div style={{ height: '64px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setSidebarExpanded(!sidebarExpanded)} style={{ width: '32px', height: '32px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M6 3v12M6 3l6 6M6 3L0 9m12 3v12m0-12l6 6m-6-6l-6 6"/></svg>
          </button>
          <div>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Swarm</span>
            <span style={{ marginLeft: '8px', fontSize: '12px', padding: '2px 8px', background: 'var(--status-error-bg)', color: 'var(--status-error)', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>5</span>
          </div>
        </div>
        
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#64748b' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input 
            type="text" 
            placeholder="Search threads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '140px', height: '32px', paddingLeft: '28px', fontSize: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#e2e8f0' }}
          />
        </div>

        {/* Horizontal Scroll Strip */}
        <div style={{ flex: 1, overflowX: 'auto', display: 'flex', gap: '8px', padding: '8px 0' }}>
          <button style={{ width: '40px', height: '40px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', cursor: 'pointer', color: 'var(--status-warning)', fontSize: '20px', flexShrink: 0 }}>+</button>
          
          {threads.map(thread => (
            <div 
              key={thread.id} 
              onClick={() => setSelectedThreadId(thread.id)}
              style={{ 
                width: selectedThreadId === thread.id ? '160px' : '128px', 
                background: selectedThreadId === thread.id ? 'rgba(245, 158, 11, 0.1)' : '#0f172a', 
                border: `1px solid ${selectedThreadId === thread.id ? 'rgba(245, 158, 11, 0.5)' : '#1e293b'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                overflow: 'hidden',
                flexShrink: 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', borderBottom: '1px solid rgba(30, 41, 59, 0.5)' }}>
                <StatusDot status={thread.status} />
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>{thread.id}</span>
                {thread.pinned && <svg width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2L12 22M2 12L22 12"/></svg>}
              </div>
              <div style={{ padding: '4px 8px' }}>
                <p style={{ fontSize: '11px', color: '#cbd5e1', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{thread.goal}</p>
              </div>
              {thread.status !== 'completed' && thread.status !== 'failed' && (
                <div style={{ padding: '0 8px 6px' }}>
                  <div style={{ height: '4px', background: '#1e293b', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${thread.progress}%`, background: thread.status === 'compacting' ? '#a855f7' : thread.status === 'running' ? '#10b981' : '#f59e0b', borderRadius: '2px' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                    <span style={{ fontSize: '9px', color: '#64748b' }}>{Math.round(thread.progress)}%</span>
                    <span style={{ fontSize: '9px', color: '#64748b' }}>{(thread.tokenCount / 1000).toFixed(1)}k</span>
                  </div>
                </div>
              )}
              {thread.status === 'failed' && (
                <div style={{ padding: '0 8px 6px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--status-error)' }}>⚠ Failed</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button 
            onClick={() => setShowHealthPanel(!showHealthPanel)}
            style={{ width: '32px', height: '32px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--status-error)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </button>
          <button style={{ width: '32px', height: '32px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
          </button>
        </div>
      </div>

      {/* Health Panel */}
      {showHealthPanel && (
        <div style={{ height: '160px', borderBottom: '1px solid #1e293b', background: 'rgba(15, 23, 42, 0.5)', padding: '16px', overflow: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              Swarm Health
            </h3>
            <button onClick={() => setShowHealthPanel(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '12px' }}>
            <div style={{ background: '#0f172a', borderRadius: '6px', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Status</div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--status-warning)' }}>Degraded</div>
            </div>
            <div style={{ background: '#0f172a', borderRadius: '6px', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Active Agents</div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#e2e8f0' }}>6 / 8</div>
            </div>
            <div style={{ background: '#0f172a', borderRadius: '6px', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Queue Size</div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#e2e8f0' }}>12</div>
            </div>
            <div style={{ background: '#0f172a', borderRadius: '6px', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Avg Response</div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#e2e8f0' }}>245ms</div>
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--status-error)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
              Circuit Breakers Open
            </h4>
            <div style={{ background: 'var(--status-error-bg)', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', color: '#e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
              <span>agent-build-01</span>
              <span style={{ color: 'var(--status-error)' }}>5 failures</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        {sidebarExpanded && (
          <div style={{ width: '256px', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Thread Tree</span>
              <button style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
              {threads.filter(t => !t.parentId).map(thread => (
                <div 
                  key={thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '6px', 
                    padding: '6px 8px', borderRadius: '4px',
                    background: selectedThreadId === thread.id ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                    marginBottom: '4px', cursor: 'pointer'
                  }}
                >
                  <StatusDot status={thread.status} />
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>{thread.id}</span>
                  <span style={{ fontSize: '12px', color: selectedThreadId === thread.id ? '#f59e0b' : '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread.goal}</span>
                  {thread.pinned && <span style={{ color: 'var(--status-warning)' }}>📌</span>}
                </div>
              ))}
            </div>
            <div style={{ padding: '12px', borderTop: '1px solid #1e293b', fontSize: '11px', color: '#64748b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Running:</span><span style={{ color: 'var(--status-success)' }}>5</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Completed:</span><span style={{ color: 'var(--status-info)' }}>1</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Failed:</span><span style={{ color: 'var(--status-error)' }}>1</span>
              </div>
            </div>
          </div>
        )}

        {/* Main Panel */}
        <div style={{ flex: 1, padding: '16px', overflow: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <StatusDot status={selectedThread.status} size="lg" />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#e2e8f0' }}>{selectedThread.id}</h2>
                  {selectedThread.pinned && <span style={{ color: 'var(--status-warning)' }}>📌</span>}
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>{selectedThread.goal}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {selectedThread.status === 'running' && (
                <button style={{ width: '32px', height: '32px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--status-warning)' }}>⏸</button>
              )}
              {selectedThread.status === 'paused' && (
                <button style={{ width: '32px', height: '32px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--status-success)' }}>▶</button>
              )}
              <button style={{ width: '32px', height: '32px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#a855f7' }}>✨</button>
              <button style={{ width: '32px', height: '32px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--status-error)' }}>■</button>
            </div>
          </div>
          
          {/* Stats */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '11px', color: '#64748b' }}>
            <span>⚡ {(selectedThread.tokenCount / 1000).toFixed(1)}k tokens</span>
            <span>🕐 {Math.floor(selectedThread.elapsedSeconds! / 60)}m {selectedThread.elapsedSeconds! % 60}s</span>
            <span>📎 {selectedThread.children.length} children</span>
          </div>

          {/* Terminal */}
          <div style={{ background: '#020617', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '13px', minHeight: '300px' }}>
            <div style={{ color: '#64748b', marginBottom: '8px' }}>$ swarm thread --tactic={selectedThread.tactic} --goal="{selectedThread.goal}"</div>
            {selectedThread.status === 'running' && (
              <>
                <div style={{ color: '#94a3b8' }}>[14:32:01] Starting thread...</div>
                <div style={{ color: '#94a3b8' }}>[14:32:02] Executing tactic: {selectedThread.tactic}</div>
                <div style={{ color: '#94a3b8' }}>[14:32:05] Processing...</div>
                <div style={{ color: '#94a3b8' }}>[14:32:08] Analyzing context...</div>
              </>
            )}
            {selectedThread.status === 'compacting' && (
              <>
                <div style={{ color: '#94a3b8' }}>[14:50:45] 234 tests passed</div>
                <div style={{ color: '#a855f7' }}>[14:50:46] ⟳ Compressing context into episode...</div>
              </>
            )}
            {selectedThread.status === 'failed' && (
              <>
                <div style={{ color: '#94a3b8' }}>[14:55:05] Bundling with Vite...</div>
                <div style={{ color: 'var(--status-error)' }}>[14:55:30] ✗ Build failed: Out of memory</div>
              </>
            )}
            {selectedThread.status === 'running' && <div style={{ color: 'var(--status-warning)', marginTop: '8px', animation: 'pulse 1s infinite' }}>_</div>}
          </div>

          {/* Progress */}
          {selectedThread.status !== 'completed' && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>
                <span>Progress</span>
                <span>{Math.round(selectedThread.progress)}%</span>
              </div>
              <div style={{ height: '8px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${selectedThread.progress}%`, background: selectedThread.status === 'compacting' ? '#a855f7' : '#10b981', borderRadius: '4px' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Episode Bar */}
      {selectedThread.id === 'T6' && (
        <div style={{ borderTop: '1px solid #1e293b', background: 'rgba(15, 23, 42, 0.5)' }}>
          <div style={{ height: '48px', display: 'flex', alignItems: 'center', padding: '0 16px', gap: '16px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span style={{ fontSize: '13px', color: '#cbd5e1' }}>Episode E1</span>
            <span style={{ fontSize: '11px', color: '#64748b', flex: 1 }}>Deployed to staging with zero downtime</span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>3 decisions · 2 artifacts</span>
            <span style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--status-warning)', borderRadius: '4px' }}>85% compressed</span>
            <button style={{ fontSize: '11px', padding: '4px 12px', background: 'transparent', border: '1px solid #334155', borderRadius: '4px', color: '#cbd5e1', cursor: 'pointer' }}>Use as Context</button>
          </div>
        </div>
      )}
    </div>
  );
};

const meta: Meta<typeof SwarmMonitorComplete> = {
  title: "Views/DAG/SwarmMonitor",
  component: SwarmMonitorComplete,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof SwarmMonitorComplete>;

export const Default: Story = {
  args: {},
};
