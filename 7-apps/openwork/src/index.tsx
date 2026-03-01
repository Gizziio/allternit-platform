import * as React from 'react';

/**
 * OpenWork - Ops Center Integration
 *
 * This is a simplified React wrapper for OpenWork functionality.
 * The full OpenWork (SolidJS/Tauri) can be integrated more deeply later.
 */

export interface OpenWorkSession {
  id: string;
  title: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  createdAt: number;
}

export interface OpenWorkProps {
  className?: string;
}

export const OpenWorkApp: React.FC<OpenWorkProps> = ({ className = '' }) => {
  const [viewMode, setViewMode] = React.useState<'dashboard' | 'sessions' | 'templates'>('dashboard');

  // Demo sessions
  const demoSessions: OpenWorkSession[] = [
    {
      id: 'demo-1',
      title: 'Weekly Finance Recap',
      status: 'completed',
      createdAt: Date.now() - 3600000,
    },
    {
      id: 'demo-2',
      title: 'Notes Summary',
      status: 'completed',
      createdAt: Date.now() - 7200000,
    },
  ];

  return (
    <div className={`openwork-app ${className}`}>
      {/* Header */}
      <div className="openwork-header">
        <div className="openwork-brand">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2L2 7l10 5v10l-10 5z" />
            <path d="M12 22V11.5a5.5 5.5 0 0 1-3.5-3.5H7a2 2 0 0 1-2 2v-2H5.5a2 2 0 0 1-2 2V7z" />
          </svg>
          <span>OpenWork</span>
        </div>
        <div className="openwork-status">
          <span className="status-dot online"></span>
          <span className="status-text">Connected</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="openwork-tabs">
        <button
          className={`tab ${viewMode === 'dashboard' ? 'active' : ''}`}
          onClick={() => setViewMode('dashboard')}
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18" />
            <path d="M9 3v18" />
          </svg>
          <span>Dashboard</span>
        </button>
        <button
          className={`tab ${viewMode === 'sessions' ? 'active' : ''}`}
          onClick={() => setViewMode('sessions')}
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.75v7.25a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.25" />
            <polyline points="15 3 21 3 21 9" />
          </svg>
          <span>Sessions</span>
        </button>
        <button
          className={`tab ${viewMode === 'templates' ? 'active' : ''}`}
          onClick={() => setViewMode('templates')}
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9h18" />
            <path d="M3 9v6" />
          </svg>
          <span>Templates</span>
        </button>
      </div>

      {/* Content */}
      <div className="openwork-content">
        {viewMode === 'dashboard' && (
          <div className="openwork-dashboard">
            <h2>Ops Center Dashboard</h2>
            <p className="dashboard-note">
              OpenWork is now integrated as a native React module inside the A2rchitech Shell UI.
            </p>

            <div className="dashboard-grid">
              <div className="dashboard-card">
                <h3>Active Sessions</h3>
                <div className="session-list">
                  {demoSessions.map((session) => (
                    <div key={session.id} className="session-item">
                      <div className={`session-status ${session.status}`} />
                      <div className="session-info">
                        <span className="session-title">{session.title}</span>
                        <span className="session-time">
                          {new Date(session.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="dashboard-card">
                <h3>Quick Actions</h3>
                <div className="action-list">
                  <button className="action-btn" type="button">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <path d="M12 16v.01" />
                    </svg>
                    <span>New Session</span>
                  </button>
                  <button className="action-btn" type="button">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 9h18" />
                      <path d="M3 9v6" />
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                    </svg>
                    <span>Manage Templates</span>
                  </button>
                  <button className="action-btn" type="button">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9.09 9a3 3 0 0 1 5.83 5.83V8h6.34a3 3 0 0 1 5.83 5.83v5.09c.7 2.74 1.55 3.77 2.06 3.63 2.83 5.41 4.09 6.16 4.6a3 3 0 0 1 3.83 5.83V8" />
                      <polyline points="22 12 18 12 15 21" />
                    </svg>
                    <span>View Logs</span>
                  </button>
                </div>
              </div>

              <div className="dashboard-card">
                <h3>Integration Status</h3>
                <div className="status-list">
                  <div className="status-item">
                    <span className="status-label">Shell UI:</span>
                    <span className="status-value success">Connected (port 5713)</span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Kernel API:</span>
                    <span className="status-value success">Connected (port 3004)</span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">UI-TARS Operator:</span>
                    <span className="status-value success">Connected (port 3008)</span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">PTY Brains:</span>
                    <span className="status-value pending">Ready</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'sessions' && (
          <div className="openwork-sessions">
            <h2>Brain Sessions</h2>
            <p>Manage your PTY brain sessions (opencode, claude-code, amp, aider, etc.)</p>
            <div className="sessions-placeholder">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M21 11.75v7.25a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.25" />
                <polyline points="15 3 21 3 21 9" />
              </svg>
              <p>Session management will be available when PTY brain integration is complete.</p>
            </div>
          </div>
        )}

        {viewMode === 'templates' && (
          <div className="openwork-templates">
            <h2>Workspace Templates</h2>
            <p>Create and manage workspace templates for rapid task execution.</p>
            <div className="templates-placeholder">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M3 9h18" />
                <path d="M3 9v6" />
              </svg>
              <p>Template management will be available in future updates.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OpenWorkApp;
