import * as React from 'react';
import { useShellState } from '../runtime/ShellState';
import { OperatorConsole } from './OperatorConsole';
import { TerminalTab } from './TerminalTab';
import { MonitorTab } from './MonitorTab';
import { ObserveView } from './ObserveView';
import { KanbanView } from './KanbanView';
import { BrainTerminal } from './BrainTerminal';

import { useBrain, BrainEvent } from '../runtime/BrainContext';

type ConsoleMode = 'observe' | 'console' | 'terminal';
type DrawerSize = 'collapsed' | 'expanded';

interface Session {
  id: string;
  title: string;
  folderId?: string;
  monitorVisible: boolean;
  brainId?: string;
}

interface Folder {
  id: string;
  title: string;
  isOpen: boolean;
}

interface EventLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  source: string;
  message: string;
  details?: Record<string, any>;
}

interface AgentStatus {
  id: string;
  name: string;
  status: 'idle' | 'working' | 'paused' | 'error';
  lastActivity: string;
  workload: number;
}

interface WorkflowState {
  id: string;
  name: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  progress: number;
  startTime: string;
  estimatedCompletion?: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  assigneeId?: string;
  createdAt: string;
  updatedAt: string;
}

interface Agent {
  id: string;
  name: string;
  avatar: string;
}

interface ConsoleDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  height?: number;
  onHeightChange?: (height: number) => void;
  eventStream?: EventLog[];
  agents?: AgentStatus[];
  workflows?: WorkflowState[];
  tasks?: Task[];
  agentsList?: Agent[];
  zones?: any[];
}

export const ConsoleDrawer: React.FC<ConsoleDrawerProps> = ({
  isOpen,
  onToggle,
  height: controlledHeight,
  onHeightChange,
  eventStream,
  agents,
  workflows,
  tasks,
  agentsList,
  zones,
}) => {
  const { journalEvents, capsules } = useShellState();
  const { profiles, activeSession, createSession } = useBrain();
  const [mode, setMode] = React.useState<ConsoleMode>('observe');
  const [size, setSize] = React.useState<DrawerSize>('collapsed');
  const [internalHeight, setInternalHeight] = React.useState<number>(360);
  const [sidebarOpen, setSidebarOpen] = React.useState<boolean>(true);
  const [isResizing, setIsResizing] = React.useState(false);
  const [consoleViewMode, setConsoleViewMode] = React.useState<'console' | 'kanban'>('console');

  // Extract data from journalEvents if not provided via props
  const eventData = eventStream || journalEvents.map(event => ({
    id: event.eventId || `event-${Date.now()}`,
    timestamp: event.timestamp || new Date().toISOString(),
    level: event.kind?.includes('error') ? 'error' :
           event.kind?.includes('warning') ? 'warning' :
           event.kind?.includes('debug') ? 'debug' : 'info',
    source: event.kind || 'system',
    message: event.payload?.message || event.payload?.intent_text || JSON.stringify(event.payload),
    details: event.payload
  }));

  // Create zones from capsules if not provided
  const zonesData = zones || capsules.map((capsule, index) => ({
    id: capsule.capsuleId,
    name: capsule.title || 'Untitled Zone',
    type: capsule.category || 'general',
    status: capsule.status || 'active',
    position: { x: 50 + (index * 250), y: 50 },
    size: { width: 200, height: 150 }
  }));

  const currentHeight = controlledHeight ?? internalHeight;
  const setHeight = onHeightChange ?? setInternalHeight;

  // Drag State
  const draggingRef = React.useRef(false);
  const startYRef = React.useRef(0);
  const startHRef = React.useRef(0);

  // Data State - brain sessions from BrainContext + legacy terminal
  const [folders, setFolders] = React.useState<Folder[]>([]);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  // Drag & Drop State (Internal)
  const [draggedId, setDraggedId] = React.useState<string | null>(null);

  // Get brain sessions and active session from BrainContext
  const { sessions: brainSessions, activeSessionId: brainActiveId, setActiveSession, closeSession } = useBrain();
  
  // Legacy terminal session
  const legacySession: Session = { id: 'term-1', title: 'Legacy Terminal', monitorVisible: false };
  
  // Combined sessions list
  const allSessions = React.useMemo(() => {
    const brainSessionItems = brainSessions.map(s => ({
      id: s.session.id,
      title: s.session.brain_name || `Brain: ${s.session.brain_id}`,
      monitorVisible: s.isStreaming,
      brainId: s.session.brain_id,
      status: s.session.status
    }));
    return [legacySession, ...brainSessionItems];
  }, [brainSessions]);

  // Set active session from BrainContext
  React.useEffect(() => {
    if (brainActiveId && brainActiveId !== activeSessionId) {
      setActiveSessionId(brainActiveId);
    }
  }, [brainActiveId]);

  // Default to legacy terminal if no brain session active
  const [activeSessionId, setActiveSessionId] = React.useState<string>('term-1');

  // Drag Resize Effect
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      
      const deltaY = startYRef.current - e.clientY;
      const newHeight = Math.max(56, Math.min(window.innerHeight, startHRef.current + deltaY));
      
      setHeight(newHeight);

      if (newHeight > 80 && size === 'collapsed') {
        setSize('expanded');
        if (!isOpen) onToggle();
      } else if (newHeight <= 80 && size === 'expanded') {
        setSize('collapsed');
        if (isOpen) onToggle();
      }
    };

    const handleMouseUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false;
        setIsResizing(false);
        document.body.style.cursor = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [size, isOpen, onToggle, setHeight]);

  // Sync size with isOpen prop
  React.useEffect(() => {
    if (!isOpen && size !== 'collapsed') {
      setSize('collapsed');
    } else if (isOpen && size === 'collapsed') {
      setSize('expanded');
    }
  }, [isOpen]);

  const startResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    draggingRef.current = true;
    startYRef.current = e.clientY;
    startHRef.current = size === 'collapsed' ? 56 : currentHeight;
    document.body.style.cursor = 'row-resize';
  };

  const handleLaunchBrain = async (profileId: string) => {
    const profile = profiles.find(p => p.config.id === profileId);
    if (profile) {
      await createSession(profile.config);
      setMode('terminal');
    }
  };

  const addBrainSession = async () => {
    if (profiles.length > 0) {
      // For now, launch the first profile or the most recent one
      await handleLaunchBrain(profiles[0].config.id);
    } else {
      console.warn('No brain profiles available to launch');
    }
  };

  const addFolder = () => {
    const id = `folder-${Date.now()}`;
    setFolders(prev => [...prev, { id, title: 'New Folder', isOpen: true }]);
    setEditingId(id);
  };

  const toggleMonitor = (sessionId: string) => {
    setSessions(prev => prev.map(s => 
      s.id === sessionId ? { ...s, monitorVisible: !s.monitorVisible } : s
    ));
  };

  const toggleFolder = (folderId: string) => {
    setFolders(prev => prev.map(f => 
      f.id === folderId ? { ...f, isOpen: !f.isOpen } : f
    ));
  };

  const handleRename = (id: string, newTitle: string, isFolder: boolean) => {
    if (isFolder) {
      setFolders(prev => prev.map(f => f.id === id ? { ...f, title: newTitle } : f));
    } else {
      // Can't rename brain sessions
      setEditingId(null);
    }
    setEditingId(null);
  };

  const deleteFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFolders(prev => prev.filter(f => f.id !== folderId));
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string, isFolder: boolean) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    setDraggedId(null);
  };

  const handleHeaderClick = () => {
    if (draggingRef.current) return;
    
    if (size === 'collapsed') {
      setSize('expanded');
      onToggle();
    } else {
      setSize('collapsed');
      onToggle();
    }
  };

  const activeSessionData = allSessions.find(s => s.id === activeSessionId);

  // Handle session close - close brain sessions, ignore legacy terminal
  const handleCloseSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessionId === 'term-1') return; // Can't close legacy terminal
    
    // Find brain session and close it
    const brainSession = brainSessions.find(s => s.session.id === sessionId);
    if (brainSession) {
      await closeSession(sessionId);
    }
  };

  const renderSessionItem = (session: Session) => (
    <div
      key={session.id}
      draggable={session.id !== 'term-1'}
      onDragStart={(e) => session.id !== 'term-1' && handleDragStart(e, session.id)}
      className={`session-item ${activeSessionId === session.id ? 'active' : ''} ${draggedId === session.id ? 'is-dragging' : ''} ${session.brainId ? 'brain-session' : ''}`}
      onClick={() => {
        setActiveSessionId(session.id);
        if (session.brainId) {
          setActiveSession(session.id);
        }
      }}
      onDoubleClick={() => session.id !== 'term-1' && setEditingId(session.id)}
    >
      <span className="session-icon">{session.brainId ? '🧠' : '❯'}</span>
      {editingId === session.id ? (
        <input
          className="session-input"
          autoFocus
          defaultValue={session.title}
          onBlur={(e) => handleRename(session.id, e.target.value, false)}
          onKeyDown={(e) => e.key === 'Enter' && handleRename(session.id, e.currentTarget.value, false)}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="session-name">{session.title}</span>
      )}
      <div className="session-actions">
        {session.brainId && (
          <button 
            className="icon-btn" 
            onClick={(e) => handleCloseSession(session.id, e)}
            title="Close session"
          >✕</button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {isOpen && <div className="drawer-backdrop" onClick={onToggle} />}
      <div
        className={`console-drawer ${isOpen ? 'open' : 'closed'} ${isResizing ? 'resizing' : ''}`}
        style={{ height: size === 'collapsed' ? 56 : currentHeight }}
      >
        <div className="console-drawer-header" onClick={handleHeaderClick}>
          <div
            className="drawer-toggle-handle"
            onMouseDown={startResize}
            onClick={(e) => e.stopPropagation()}
            title="Drag to resize"
          />
          <div className="console-drawer-title">
            <div className="console-icon">
              {mode === 'observe' ? '🔍' :
               mode === 'console' ? '📜' :
               '⌨️'}
            </div>
            <span>Agent Operations</span>
          </div>

          <div className="console-drawer-controls">
            <div className="mode-tabs">
              <button
                className={`mode-tab ${mode === 'observe' ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setMode('observe'); }}
                title="Observe: Structured logs, agent status, workflow state, errors, traces, metrics"
              >
                Observe
              </button>
              <button
                className={`mode-tab ${mode === 'console' ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setMode('console'); }}
                title="Console: Traditional console view"
              >
                Console
              </button>
              <button
                className={`mode-tab ${mode === 'terminal' ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setMode('terminal'); }}
                title="Terminal: Embedded terminal with monitor for CLI visual output"
              >
                Terminal
              </button>
            </div>
          </div>
        </div>

        <div className="console-drawer-body" style={{ display: size === 'collapsed' ? 'none' : 'flex' }}>
          {/* Always mount all three modes but show only one */}
          <div style={{ display: mode === 'observe' ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}>
            <ObserveView
              eventStream={eventData}
              agents={agents}
              workflows={workflows}
              tasks={tasks}
              agentsList={agentsList}
              zones={zonesData}
            />
          </div>

          <div style={{ display: mode === 'console' ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
              <div style={{
                padding: '8px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-start',
                gap: '8px'
              }}>
                <button
                  className={`view-mode-btn ${consoleViewMode === 'console' ? 'active' : ''}`}
                  onClick={() => setConsoleViewMode('console')}
                  style={{
                    padding: '4px 12px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: consoleViewMode === 'console' ? '#e2e8f0' : 'white',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Console
                </button>
                <button
                  className={`view-mode-btn ${consoleViewMode === 'kanban' ? 'active' : ''}`}
                  onClick={() => setConsoleViewMode('kanban')}
                  style={{
                    padding: '4px 12px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: consoleViewMode === 'kanban' ? '#e2e8f0' : 'white',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Kanban
                </button>
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {consoleViewMode === 'console' ? (
                  <OperatorConsole eventStream={eventData} agents={agents} workflows={workflows} />
                ) : (
                  <KanbanView
                    tasks={tasks || []}
                    agents={agentsList || []}
                    onTaskStatusChange={(taskId, newStatus) => {
                      // Handle task status change
                      console.log('Task status changed:', taskId, newStatus);
                    }}
                    onTaskAssign={(taskId, agentId) => {
                      // Handle task assignment
                      console.log('Task assigned:', taskId, agentId);
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          <div style={{ display: mode === 'terminal' ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}>
            <div className={`console-sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
              <div className="console-sidebar-header">
                <span>Workspace Shells</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="icon-btn" onClick={(e) => { e.stopPropagation(); addFolder(); }} title="New Group">📂</button>
                </div>
              </div>

              <div className="session-list">
                {/* Section: Neural Runtimes */}
                <div className="session-section">
                  <div className="section-header">
                    <span className="section-label">Neural Runtimes</span>
                  </div>
                  <div className="section-content">
                    {allSessions.filter(s => s.brainId).map(renderSessionItem)}
                    {allSessions.filter(s => s.brainId).length === 0 && (
                      <div className="empty-section-hint">No active runtimes</div>
                    )}
                  </div>
                </div>

                <div className="section-divider" />

                {/* Section: Persistent Shells - Legacy terminal */}
                <div className="session-section">
                  <div className="section-header">
                    <span className="section-label">Terminal</span>
                  </div>
                  <div className="section-content">
                    {/* Folders */}
                    {folders.map(folder => (
                      <div
                        key={folder.id}
                        className="folder-item"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, folder.id, true)}
                      >
                        <div className="folder-header" onClick={() => toggleFolder(folder.id)}>
                          <span className={`folder-icon ${folder.isOpen ? 'open' : ''}`}>▶</span>
                          {editingId === folder.id ? (
                            <input
                              className="session-input"
                              autoFocus
                              defaultValue={folder.title}
                              onBlur={(e) => handleRename(folder.id, e.target.value, true)}
                              onKeyDown={(e) => e.key === 'Enter' && handleRename(folder.id, e.currentTarget.value, true)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span onDoubleClick={(e) => { e.stopPropagation(); setEditingId(folder.id); }}>{folder.title}</span>
                          )}
                          <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id, e); }}>✕</button>
                        </div>
                        {folder.isOpen && (
                          <div className="folder-content">
                            {/* Legacy terminal only */}
                            <div
                              key="term-1"
                              className={`session-item ${activeSessionId === 'term-1' ? 'active' : ''}`}
                              onClick={() => setActiveSessionId('term-1')}
                            >
                              <span className="session-icon">❯</span>
                              <span className="session-name">Legacy Terminal</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Legacy terminal */}
                    <div
                      key="term-1"
                      className={`session-item ${activeSessionId === 'term-1' ? 'active' : ''}`}
                      onClick={() => setActiveSessionId('term-1')}
                    >
                      <span className="session-icon">❯</span>
                      <span className="session-name">Legacy Terminal</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="workspace-container">
              {activeSessionData && (
                <div className="workspace-toolbar">
                  <button
                    className={`icon-btn ${sidebarOpen ? 'active' : ''}`}
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
                    style={{ marginRight: 8 }}
                  >
                    {sidebarOpen ? '◀' : '▶'}
                  </button>
                  <div className="workspace-title">{activeSessionData.title}</div>
                  <div className="workspace-actions">
                    <button
                      className={`tool-btn ${activeSessionData.monitorVisible ? 'active' : ''}`}
                      onClick={() => toggleMonitor(activeSessionData.id)}
                    >
                      Monitor
                    </button>
                  </div>
                </div>
              )}

              <div className="split-view" style={{ flex: 1, display: allSessions.length > 0 ? 'flex' : 'none' }}>
                {allSessions.map(session => (
                  <div
                    key={session.id}
                    className="split-pane terminal"
                    style={{ display: activeSessionId === session.id ? 'flex' : 'none' }}
                  >
                    {session.brainId ? (
                      <BrainTerminal 
                        sessionId={session.id} 
                        isActive={activeSessionId === session.id} 
                      />
                    ) : (
                      <TerminalTab isActive={activeSessionId === session.id} />
                    )}
                  </div>
                ))}
                {activeSessionData && activeSessionData.monitorVisible && (
                  <div className="split-pane monitor">
                    <MonitorTab eventStream={eventData} agents={agents} workflows={workflows} />
                  </div>
                )}
              </div>

              {allSessions.length === 0 && (
                <div className="empty-state">No active session</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
