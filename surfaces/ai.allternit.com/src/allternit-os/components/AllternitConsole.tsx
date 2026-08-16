/**
 * allternit Super-Agent OS - Allternit Console Drawer
 *
 * The main agent control center featuring:
 * - Agent Terminal: REAL multi-session terminal using TerminalTabs
 * - Kanban Board: Visual task management for agent workflows
 * - Automation Hub: Trigger and monitor automated sequences
 *
 * THIS IS THE REAL IMPLEMENTATION - Uses actual node-pty via TerminalTabs
 */

import * as React from 'react';
const { useState, useEffect } = React;
import {
  TerminalWindow,
  Kanban,
  Lightning,
  Robot,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Stop,
  Circle,
  Clock,
  CalendarBlank,
  ArrowClockwise,
  Plus,
  Trash,
  X,
  type Icon,
} from '@phosphor-icons/react';
import { useSidecarStore } from '../stores/useSidecarStore';
import type { TaskNode } from '../types/programs';

// Import the REAL terminal implementation
import { TerminalTabs } from '@/views/nodes/terminal/TerminalTabs';
import { nodeTerminalService } from '@/views/nodes/terminal/terminal.service';

// ============================================================================
// Types
// ============================================================================

export interface AllternitConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

type ConsoleTab = 'terminal' | 'kanban' | 'automation';

interface KanbanColumn {
  id: string;
  title: string;
  status: TaskNode['status'];
  icon: Icon;
  color: string;
}

interface KanbanTask extends TaskNode {
  assignee?: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
}

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

// ============================================================================
// REAL Agent Terminal Component - Uses TerminalTabs
// ============================================================================

const AgentTerminal: React.FC = () => {
  const [summary, setSummary] = useState({
    attached: 0,
    restored: 0,
    replaying: 0,
    degraded: 0,
  });

  useEffect(() => {
    const refresh = () => {
      const sessions = nodeTerminalService.getActiveSessions();
      const next = sessions.reduce(
        (acc, session) => {
          const connected = nodeTerminalService.isConnected(session.id);
          const hasSnapshot = !!nodeTerminalService.getSnapshot(session.id);
          if (connected) {
            acc.attached += 1;
          }
          if (session.isReconnected) {
            acc.restored += 1;
          }
          if (!connected && hasSnapshot) {
            acc.replaying += 1;
          }
          if (!connected && !hasSnapshot) {
            acc.degraded += 1;
          }
          return acc;
        },
        { attached: 0, restored: 0, replaying: 0, degraded: 0 },
      );
      setSummary(next);
    };

    refresh();
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, []);

  // Use the REAL TerminalTabs component for multi-session terminal support
  // This connects to actual PTY via WebSocket - not a simulation
  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--surface-panel)]/50 backdrop-blur border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-[var(--status-success)]" />
          <span className="text-sm font-medium">Multi-Session Terminal</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span className="px-2 py-0.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
            Sidecar PTY
          </span>
          <span className="px-2 py-0.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
            Snapshot Restore
          </span>
          <span className="px-2 py-0.5 rounded-md bg-[var(--status-success)]/10 text-[var(--status-success)] border border-[var(--status-success)]/20">
            attached {summary.attached}
          </span>
          {summary.restored > 0 ? (
            <span className="px-2 py-0.5 rounded-md bg-[var(--status-info)]/10 text-[var(--status-info)] border border-[var(--status-info)]/20">
              restored {summary.restored}
            </span>
          ) : null}
          {summary.replaying > 0 ? (
            <span className="px-2 py-0.5 rounded-md bg-[var(--status-warning)]/10 text-[var(--status-warning)] border border-[var(--status-warning)]/20">
              replaying {summary.replaying}
            </span>
          ) : null}
          {summary.degraded > 0 ? (
            <span className="px-2 py-0.5 rounded-md bg-[var(--status-error)]/10 text-[var(--status-error)] border border-[var(--status-error)]/20">
              degraded {summary.degraded}
            </span>
          ) : null}
        </div>
      </div>

      {/* Real Terminal Tabs */}
      <div className="flex-1 overflow-hidden">
        <TerminalTabs />
      </div>
    </div>
  );
};

// ============================================================================
// Kanban Board Component
// ============================================================================

const KanbanBoard: React.FC = () => {
  useSidecarStore();

  const columns: KanbanColumn[] = [
    {
      id: 'pending',
      title: 'Pending',
      status: 'pending',
      icon: Circle,
      color: 'text-[var(--text-tertiary)]',
    },
    {
      id: 'running',
      title: 'In Progress',
      status: 'running',
      icon: ArrowClockwise,
      color: 'text-[var(--status-info)]',
    },
    {
      id: 'completed',
      title: 'Completed',
      status: 'completed',
      icon: CheckCircle,
      color: 'text-[var(--status-success)]',
    },
    {
      id: 'error',
      title: 'Error',
      status: 'error',
      icon: XCircle,
      color: 'text-[var(--status-error)]',
    },
  ];

  const [tasks, setTasks] = useState<KanbanTask[]>([
    {
      id: 'task-1',
      name: 'Research Phase',
      status: 'completed',
      dependencies: [],
      assignee: 'researcher',
      priority: 'high',
      dueDate: '2026-03-10',
    },
    {
      id: 'task-2',
      name: 'Data Analysis',
      status: 'running',
      dependencies: ['task-1'],
      assignee: 'analyst',
      priority: 'medium',
      dueDate: '2026-03-11',
    },
    {
      id: 'task-3',
      name: 'Code Implementation',
      status: 'pending',
      dependencies: ['task-2'],
      assignee: 'developer',
      priority: 'high',
      dueDate: '2026-03-12',
    },
    {
      id: 'task-4',
      name: 'UI Design Review',
      status: 'pending',
      dependencies: [],
      assignee: 'designer',
      priority: 'low',
      dueDate: '2026-03-13',
    },
  ]);

  const [draggedTask, setDraggedTask] = useState<KanbanTask | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');

  const handleDragStart = (task: KanbanTask) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: TaskNode['status']) => {
    e.preventDefault();
    if (!draggedTask) return;

    setTasks((prev) =>
      prev.map((task) => (task.id === draggedTask.id ? { ...task, status } : task)),
    );
    setDraggedTask(null);
  };

  const handleAddTask = () => {
    if (!newTaskName.trim()) return;

    const newTask: KanbanTask = {
      id: `task-${Date.now()}`,
      name: newTaskName,
      status: 'pending',
      dependencies: [],
      assignee: 'unassigned',
      priority: 'medium',
    };

    setTasks((prev) => [...prev, newTask]);
    setNewTaskName('');
    setShowAddTask(false);
  };

  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'bg-[var(--status-error)]/10 text-[var(--status-error)] border-[var(--status-error)]/20';
      case 'medium':
        return 'bg-[var(--status-warning)]/10 text-[var(--status-warning)] border-[var(--status-warning)]/20';
      case 'low':
        return 'bg-[var(--status-success)]/10 text-[var(--status-success)] border-[var(--status-success)]/20';
      default:
        return 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-subtle)]';
    }
  };

  const getTasksForColumn = (status: TaskNode['status']) => {
    return tasks.filter((task) => task.status === status);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Board Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-code)]/10 text-[var(--accent-code)]">
            <Kanban size={18} weight="duotone" />
          </div>
          <h2 className="font-semibold text-[var(--text-primary)]">Kanban Board</h2>
          <span className="text-sm text-[var(--text-secondary)]">({tasks.length} tasks)</span>
        </div>
        <button
          type="button"
          onClick={() => setShowAddTask(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-code)] text-[var(--text-inverse)] rounded-lg text-sm font-medium hover:bg-[var(--accent-code)]/90 transition-colors"
        >
          <Plus size={16} />
          Add Task
        </button>
      </div>

      {/* Board Columns */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full min-w-max">
          {columns.map((column) => {
            const ColumnIcon = column.icon;
            return (
              <div
                key={column.id}
                className="w-72 flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.status)}
              >
                {/* Column Header */}
                <div className="px-3 py-2.5 rounded-t-xl bg-[var(--bg-tertiary)] border-b border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ColumnIcon size={16} className={column.color} weight="duotone" />
                      <span className="font-medium text-sm text-[var(--text-primary)]">
                        {column.title}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs font-medium">
                      {getTasksForColumn(column.status).length}
                    </span>
                  </div>
                </div>

                {/* Column Tasks */}
                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  {getTasksForColumn(column.status).map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task)}
                      className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg p-3 cursor-move hover:border-[var(--border-hover)] hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-medium text-sm text-[var(--text-primary)]">
                          {task.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(task.id)}
                          className="opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-[var(--status-error)] transition-opacity p-1"
                          aria-label="Delete task"
                        >
                          <Trash size={14} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {task.assignee && (
                            <span className="px-2 py-0.5 rounded-md bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                              @{task.assignee}
                            </span>
                          )}
                          {task.priority && (
                            <span
                              className={`px-2 py-0.5 rounded-md border ${getPriorityColor(
                                task.priority,
                              )}`}
                            >
                              {task.priority}
                            </span>
                          )}
                        </div>
                        {task.dueDate && (
                          <span className="flex items-center gap-1 text-[var(--text-tertiary)]">
                            <CalendarBlank size={12} />
                            {task.dueDate}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 bg-[var(--shell-overlay-backdrop)] flex items-center justify-center z-50">
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-6 w-96 shadow-lg">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Add New Task</h3>
            <input
              aria-label="Input"
              type="text"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              placeholder="Task name…"
              className="w-full px-4 py-2 rounded-lg mb-4 bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--border-focus)]"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddTask(false)}
                className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddTask}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--accent-primary)] text-[var(--text-inverse)] rounded-lg hover:bg-[var(--accent-primary)]/90 transition-colors"
              >
                <Plus size={16} />
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Automation Hub Component
// ============================================================================

const AutomationHub: React.FC = () => {
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
      case 'running':
        return 'bg-[var(--status-info)]';
      case 'completed':
        return 'bg-[var(--status-success)]';
      case 'error':
        return 'bg-[var(--status-error)]';
      case 'paused':
        return 'bg-[var(--status-warning)]';
      default:
        return 'bg-[var(--bg-tertiary)]';
    }
  };

  const getStatusIcon = (status: AutomationSequence['status']) => {
    switch (status) {
      case 'running':
        return <ArrowClockwise size={20} className="text-[var(--status-info)] animate-spin" />;
      case 'completed':
        return <CheckCircle size={20} className="text-[var(--status-success)]" />;
      case 'error':
        return <XCircle size={20} className="text-[var(--status-error)]" />;
      case 'paused':
        return <Pause size={20} className="text-[var(--status-warning)]" />;
      default:
        return <Stop size={20} className="text-[var(--text-tertiary)]" />;
    }
  };

  const handleRunSequence = (id: string) => {
    setSequences((prev) =>
      prev.map((seq) =>
        seq.id === id ? { ...seq, status: 'running', progress: 0 } : seq,
      ),
    );

    // Simulate progress
    const interval = setInterval(() => {
      setSequences((prev) => {
        const seq = prev.find((s) => s.id === id);
        if (!seq || seq.status !== 'running') {
          clearInterval(interval);
          return prev;
        }

        const newProgress = seq.progress + 10;
        if (newProgress >= 100) {
          clearInterval(interval);
          return prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: 'completed',
                  progress: 100,
                  lastRun: new Date().toISOString(),
                  runCount: s.runCount + 1,
                }
              : s,
          );
        }

        return prev.map((s) =>
          s.id === id ? { ...s, progress: newProgress } : s,
        );
      });
    }, 500);
  };

  const handleToggleSequence = (id: string) => {
    setSequences((prev) =>
      prev.map((seq) => {
        if (seq.id !== id) return seq;
        return {
          ...seq,
          status: seq.status === 'paused' ? 'idle' : 'paused',
        };
      }),
    );
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Hub Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
            <Robot size={18} weight="duotone" />
          </div>
          <h2 className="font-semibold text-[var(--text-primary)]">Automation Hub</h2>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-code)] text-[var(--text-inverse)] rounded-lg text-sm font-medium hover:bg-[var(--accent-code)]/90 transition-colors"
        >
          <Plus size={16} />
          New Sequence
        </button>
      </div>

      {/* Sequences List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sequences.map((seq) => (
          <div
            key={seq.id}
            className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-4 transition-all hover:border-[var(--border-hover)] hover:shadow-sm"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--bg-primary)] shrink-0">
                  {getStatusIcon(seq.status)}
                </div>
                <div>
                  <h3 className="font-medium text-[var(--text-primary)]">{seq.name}</h3>
                  <p className="text-sm text-[var(--text-secondary)]">{seq.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleRunSequence(seq.id)}
                  disabled={seq.status === 'running'}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-primary)] text-[var(--text-inverse)] rounded-md text-sm font-medium hover:bg-[var(--accent-primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {seq.status === 'running' ? (
                    <>
                      <ArrowClockwise size={14} className="animate-spin" />
                      Running…
                    </>
                  ) : (
                    <>
                      <Play size={14} />
                      Run
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleSequence(seq.id)}
                  className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
                  aria-label={seq.status === 'paused' ? 'Resume sequence' : 'Pause sequence'}
                >
                  {seq.status === 'paused' ? <Play size={16} /> : <Pause size={16} />}
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            {seq.status === 'running' && (
              <div className="mb-3">
                <div className="w-full h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getStatusColor(seq.status)} transition-all duration-300`}
                    style={{ width: `${seq.progress}%` }}
                  />
                </div>
                <div className="text-xs text-[var(--text-tertiary)] mt-1">{seq.progress}% complete</div>
              </div>
            )}

            {/* Sequence Details */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--text-secondary)]">
              <div className="flex items-center gap-1.5">
                <ArrowClockwise size={14} className="text-[var(--text-tertiary)]" />
                <span>{seq.runCount} runs</span>
              </div>
              {seq.lastRun && (
                <div className="flex items-center gap-1.5">
                  <CalendarBlank size={14} className="text-[var(--text-tertiary)]" />
                  <span>Last: {seq.lastRun.split('T')[0]}</span>
                </div>
              )}
              {seq.nextRun && (
                <div className="flex items-center gap-1.5">
                  <Clock size={14} className="text-[var(--text-tertiary)]" />
                  <span>Next: {seq.nextRun.split('T')[0]}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Lightning size={14} className="text-[var(--text-tertiary)]" />
                <span className="flex gap-1 flex-wrap">
                  {seq.triggers.map((t) => (
                    <span
                      key={`${seq.id}-${t}`}
                      className="px-2 py-0.5 rounded-md bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs border border-[var(--border-subtle)]"
                    >
                      {t}
                    </span>
                  ))}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-[var(--shell-overlay-backdrop)] flex items-center justify-center z-50">
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-6 w-96 shadow-lg">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
              Create Automation Sequence
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Automation sequences can be created via the WorkflowBuilder or by writing a workflow
              file.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-[var(--accent-code)] text-[var(--text-inverse)] rounded-lg hover:bg-[var(--accent-code)]/90 transition-colors"
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

// ============================================================================
// Main Allternit Console Component
// ============================================================================

export const AllternitConsole: React.FC<AllternitConsoleProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<ConsoleTab>('terminal');

  if (!isOpen) return null;

  const tabs: { id: ConsoleTab; label: string; icon: Icon }[] = [
    { id: 'terminal', label: 'Terminal', icon: TerminalWindow },
    { id: 'kanban', label: 'Kanban', icon: Kanban },
    { id: 'automation', label: 'Automation', icon: Lightning },
  ];

  return (
    <div className="h-full flex flex-col bg-[var(--bg-elevated)] text-[var(--text-primary)]">
      {/* Drawer Header with Tabs */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--surface-panel)]/50 backdrop-blur-md border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-4">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-code)]/10 text-[var(--accent-code)]">
            <Robot size={18} weight="duotone" />
          </div>
          <span className="font-semibold text-[var(--text-primary)]">Allternit Console</span>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 ml-4 p-1 rounded-lg bg-[var(--surface-panel)]/50 backdrop-blur border border-[var(--border-subtle)]">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--accent-code)] text-[var(--text-inverse)] shadow-sm'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <TabIcon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
          aria-label="Close console"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'terminal' && <AgentTerminal />}
        {activeTab === 'kanban' && <KanbanBoard />}
        {activeTab === 'automation' && <AutomationHub />}
      </div>
    </div>
  );
};

// ============================================================================
// Allternit Console Toggle Button
// ============================================================================

export const AllternitConsoleToggle: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-code)] text-[var(--text-inverse)] rounded-lg hover:bg-[var(--accent-code)]/90 transition-all shadow-sm"
    >
      <Robot size={20} weight="duotone" />
      <span className="font-medium">Allternit</span>
    </button>
  );
};

export default AllternitConsole;
