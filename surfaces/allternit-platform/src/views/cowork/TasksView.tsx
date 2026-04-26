import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckSquare,
  Robot,
  User,
  ChatTeardropText,
  Lightning,
  Play,
  Pause,
  PencilSimple,
  X,
  Check,
  Timer,
  ClockCounterClockwise,
} from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';
import { useCoworkStore } from './CoworkStore';
import { useTasksAPI } from './hooks/useTasksAPI';
import { useTaskRealtime } from './hooks/useTaskRealtime';
import { useToast } from '@/hooks/use-toast';
import { AuditLogViewer } from './AuditLogViewer';
import { IntelliSchedulePanel } from './IntelliSchedulePanel';
import { TaskEstimateModal } from './TaskEstimateModal';

interface TaskViewItem {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  tag: string;
  assignee: string;
  column: 'backlog' | 'todo' | 'in-progress' | 'in-review' | 'done';
  workspaceId?: string;
  assigneeType?: 'human' | 'agent';
  assigneeName?: string;
  assigneeAvatar?: string;
  estimatedMinutes?: number;
  deadline?: string;
  risk?: 'low' | 'medium' | 'high';
  optimizeRank?: number;
  comments?: Array<{ id: string; author: string; body: string; createdAt: string }>;
}

const getPriorityColor = (priority: TaskViewItem['priority']) => {
  switch (priority) {
    case 'high':
      return '#ef4444';
    case 'medium':
      return '#f59e0b';
    case 'low':
      return '#3b82f6';
    default:
      return 'var(--text-secondary)';
  }
};

const getTagBg = (tag: string) => {
  switch (tag) {
    case 'Agent':
      return '#dbeafe';
    case 'Code':
      return '#ddd6fe';
    case 'Docs':
      return '#fce7f3';
    default:
      return 'var(--bg-secondary)';
  }
};

const getTagColor = (tag: string) => {
  switch (tag) {
    case 'Agent':
      return '#0369a1';
    case 'Code':
      return '#5b21b6';
    case 'Docs':
      return '#be185d';
    default:
      return 'var(--text-secondary)';
  }
};

const getColumnAccent = (column: TaskViewItem['column']) => {
  switch (column) {
    case 'backlog':
      return '#6b7280';
    case 'todo':
      return '#af52de';
    case 'in-progress':
      return '#f59e0b';
    case 'in-review':
      return '#3b82f6';
    case 'done':
      return '#22c55e';
    default:
      return 'var(--text-secondary)';
  }
};

const getRiskColor = (risk?: TaskViewItem['risk']) => {
  switch (risk) {
    case 'high':
      return '#ef4444';
    case 'medium':
      return '#f59e0b';
    case 'low':
      return '#22c55e';
    default:
      return 'transparent';
  }
};

const formatEstimate = (minutes?: number) => {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const formatDeadline = (deadline?: string) => {
  if (!deadline) return null;
  const date = new Date(deadline);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const mapPriority = (priority?: number): TaskViewItem['priority'] => {
  if (typeof priority !== 'number') return 'medium';
  if (priority >= 70) return 'high';
  if (priority >= 40) return 'medium';
  return 'low';
};

const mapTag = (assigneeType?: string): string => {
  if (assigneeType === 'agent') return 'Agent';
  return 'Task';
};

function TimerDisplay({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(Math.floor((Date.now() - startTime) / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return <span>{m}:{s.toString().padStart(2, '0')}</span>;
}

export const TasksView: React.FC = () => {
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('all');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<'tags' | 'notes' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [auditTask, setAuditTask] = useState<{ id: string; title: string } | null>(null);
  const [estimateModalTaskId, setEstimateModalTaskId] = useState<string | null>(null);
  const storeTasks = useCoworkStore((s) => s.tasks);
  const optimizeSchedule = useCoworkStore((s) => s.optimizeSchedule);
  const startTaskTimer = useCoworkStore((s) => s.startTaskTimer);
  const stopTaskTimer = useCoworkStore((s) => s.stopTaskTimer);
  const setTaskTags = useCoworkStore((s) => s.setTaskTags);
  const setTaskNotes = useCoworkStore((s) => s.setTaskNotes);
  const taskTimers = useCoworkStore((s) => s.taskTimers);
  const addAuditLogEntry = useCoworkStore((s) => s.addAuditLogEntry);
  const { addToast } = useToast();

  const workspaceId = selectedWorkspace === 'all' ? 'default' : selectedWorkspace;
  const { tasks: apiTasks, isLoading, error } = useTasksAPI(workspaceId);
  useTaskRealtime(workspaceId);

  useEffect(() => {
    if (error) {
      addToast({
        title: 'Tasks Error',
        description: error instanceof Error ? error.message : 'Failed to load tasks',
        type: 'error',
      });
    }
  }, [error, addToast]);

  const taskItems = useMemo<TaskViewItem[]>(() => {
    return apiTasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: mapPriority(t.priority),
      tag: mapTag(t.assigneeType),
      assignee: t.assigneeName || '',
      column: t.status,
      workspaceId: t.workspace_id,
      assigneeType: t.assigneeType,
      assigneeName: t.assigneeName,
      assigneeAvatar: t.assigneeAvatar,
      estimatedMinutes: t.estimatedMinutes,
      deadline: t.deadline,
      risk: t.risk,
      optimizeRank: t.optimizeRank,
    }));
  }, [apiTasks]);

  const columns = ['backlog', 'todo', 'in-progress', 'in-review', 'done'] as const;
  const columnLabels = {
    backlog: 'BACKLOG',
    todo: 'TODO',
    'in-progress': 'IN PROGRESS',
    'in-review': 'IN REVIEW',
    done: 'DONE',
  };

  const workspaces = Array.from(new Set(taskItems.map((t) => t.workspaceId).filter(Boolean)));

  const filteredTasks = selectedWorkspace === 'all'
    ? taskItems
    : taskItems.filter((t) => t.workspaceId === selectedWorkspace);

  const getTasksForColumn = (columnId: string) => {
    return filteredTasks.filter((task) => task.column === columnId);
  };

  return (
    <div style={{ padding: 'var(--spacing-lg)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
          <CheckSquare size={24} color="#af52de" />
          <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '24px', fontWeight: 600 }}>Tasks</h1>
        </div>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>Project task management</p>
      </div>

      {/* Controls Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-lg)', flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
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

        {/* Optimize Schedule Button */}
        <button
          onClick={optimizeSchedule}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#06b6d4',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0891b2';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#06b6d4';
          }}
        >
          <Lightning size={16} weight="fill" />
          Optimize Schedule
        </button>
      </div>

      {/* Intelli-Schedule Panel */}
      <IntelliSchedulePanel />

      {/* Loading State */}
      {isLoading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--spacing-xl)',
            color: 'var(--text-secondary)',
            fontSize: '14px',
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              border: '2px solid var(--border-subtle)',
              borderTopColor: '#af52de',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginRight: 'var(--spacing-md)',
            }}
          />
          Loading tasks…
        </div>
      )}

      {/* Kanban Board */}
      {!isLoading && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(280px, 1fr))',
            gap: 'var(--spacing-lg)',
            minHeight: '600px',
            overflowX: 'auto',
          }}
        >
          {columns.map((column) => {
            const tasks = getTasksForColumn(column);
            const accent = getColumnAccent(column);
            return (
              <div key={column} style={{ display: 'flex', flexDirection: 'column', minWidth: 280 }}>
                {/* Column Header */}
                <div style={{ marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: accent,
                      flexShrink: 0,
                    }}
                  />
                  <h2
                    style={{
                      margin: 0,
                      color: accent,
                      fontSize: '14px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {columnLabels[column]}
                  </h2>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-secondary)',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    {tasks.length}
                  </span>
                </div>

                {/* Task Cards Container */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', flex: 1 }}>
                  {tasks.map((task) => (
                    <GlassSurface
                      key={task.id}
                      style={{
                        padding: 'var(--spacing-md)',
                        cursor: 'grab',
                        transition: 'all 0.2s ease',
                        boxShadow:
                          hoveredTaskId === task.id
                            ? '0 20px 40px rgba(0, 0, 0, 0.15)'
                            : '0 8px 16px rgba(0, 0, 0, 0.08)',
                      }}
                      onMouseEnter={() => setHoveredTaskId(task.id)}
                      onMouseLeave={() => setHoveredTaskId(null)}
                    >
                      {/* Task Title */}
                      <h3
                        style={{
                          margin: '0 0 var(--spacing-md) 0',
                          color: 'var(--text-primary)',
                          fontSize: '14px',
                          fontWeight: 500,
                        }}
                      >
                        {task.title}
                      </h3>

                      {/* Priority and Tag */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                        {/* Priority Dot */}
                        <div
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: getPriorityColor(task.priority),
                            flexShrink: 0,
                          }}
                        />

                        {/* Tag Chip */}
                        <span
                          style={{
                            display: 'inline-block',
                            fontSize: '11px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            backgroundColor: getTagBg(task.tag),
                            color: getTagColor(task.tag),
                            fontWeight: 500,
                          }}
                        >
                          {task.tag}
                        </span>

                        {/* Optimize Rank */}
                        {typeof task.optimizeRank === 'number' && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              backgroundColor: '#06b6d4',
                              color: '#fff',
                              fontSize: '10px',
                              fontWeight: 700,
                            }}
                          >
                            {task.optimizeRank}
                          </span>
                        )}
                      </div>

                      {/* Meta Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                        {task.estimatedMinutes && (
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-secondary)',
                              fontWeight: 500,
                            }}
                          >
                            ⏱ {formatEstimate(task.estimatedMinutes)}
                          </span>
                        )}
                        {task.deadline && (
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-secondary)',
                              fontWeight: 500,
                            }}
                          >
                            📅 {formatDeadline(task.deadline)}
                          </span>
                        )}
                        {task.comments && task.comments.length > 0 && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-secondary)',
                              fontWeight: 500,
                            }}
                          >
                            <ChatTeardropText size={12} />
                            {task.comments.length}
                          </span>
                        )}
                      </div>

                      {/* Tags & Time Tracking */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                        {/* Tags */}
                        {(task as any).tags?.map((tag: string) => (
                          <span key={tag} style={{
                            fontSize: '10px',
                            padding: '1px 6px',
                            borderRadius: '999px',
                            background: 'rgba(139, 92, 246, 0.15)',
                            color: '#a78bfa',
                            fontWeight: 500,
                          }}>
                            #{tag}
                          </span>
                        ))}
                        {/* Actual time */}
                        {(task as any).actualMinutes ? (
                          <span style={{
                            fontSize: '10px',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                            fontWeight: 500,
                          }}>
                            ⏱ {(task as any).actualMinutes}m actual
                          </span>
                        ) : null}
                        {/* Notes indicator */}
                        {(task as any).notes && (
                          <span style={{
                            fontSize: '10px',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#f59e0b',
                            fontWeight: 500,
                          }}>
                            📝 notes
                          </span>
                        )}
                      </div>

                      {/* Inline Tag Editor */}
                      {editingTaskId === task.id && editMode === 'tags' && (
                        <div style={{ marginBottom: 'var(--spacing-md)' }}>
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const tags = editValue.split(',').map((t) => t.trim()).filter(Boolean);
                                setTaskTags(task.id, tags);
                                addAuditLogEntry(task.id, 'updated', `Changed tags to [${tags.join(', ')}]`);
                                setEditingTaskId(null);
                                setEditMode(null);
                              }
                              if (e.key === 'Escape') {
                                setEditingTaskId(null);
                                setEditMode(null);
                              }
                            }}
                            onBlur={() => {
                              const tags = editValue.split(',').map((t) => t.trim()).filter(Boolean);
                              setTaskTags(task.id, tags);
                              addAuditLogEntry(task.id, 'updated', `Changed tags to [${tags.join(', ')}]`);
                              setEditingTaskId(null);
                              setEditMode(null);
                            }}
                            autoFocus
                            placeholder="tag1, tag2, tag3"
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-subtle)',
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-primary)',
                              fontSize: '12px',
                              outline: 'none',
                            }}
                          />
                        </div>
                      )}

                      {/* Inline Notes Editor */}
                      {editingTaskId === task.id && editMode === 'notes' && (
                        <div style={{ marginBottom: 'var(--spacing-md)' }}>
                          <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                setEditingTaskId(null);
                                setEditMode(null);
                              }
                            }}
                            onBlur={() => {
                              setTaskNotes(task.id, editValue);
                              addAuditLogEntry(task.id, 'updated', editValue ? 'Updated notes' : 'Cleared notes');
                              setEditingTaskId(null);
                              setEditMode(null);
                            }}
                            autoFocus
                            placeholder="Add notes..."
                            rows={3}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-subtle)',
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-primary)',
                              fontSize: '12px',
                              outline: 'none',
                              resize: 'vertical',
                              fontFamily: 'inherit',
                            }}
                          />
                        </div>
                      )}

                      {/* Action Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: 'var(--spacing-md)' }}>
                        {/* Timer Button */}
                        {taskTimers[task.id] ? (
                          <button
                            onClick={() => {
                              stopTaskTimer(task.id);
                              addAuditLogEntry(task.id, 'time_tracked', `Stopped timer for "${task.title}"`);
                              addToast({ title: 'Timer Stopped', description: `Stopped tracking "${task.title}"`, type: 'success' });
                            }}
                            title="Stop timer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: 'rgba(239, 68, 68, 0.12)',
                              color: '#ef4444',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                            }}
                          >
                            <Pause size={12} weight="fill" />
                            <TimerDisplay startTime={taskTimers[task.id]} />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              startTaskTimer(task.id);
                              addAuditLogEntry(task.id, 'time_tracked', `Started timer for "${task.title}"`);
                              addToast({ title: 'Timer Started', description: `Tracking "${task.title}"`, type: 'success' });
                            }}
                            title="Start timer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: 'rgba(34, 197, 94, 0.12)',
                              color: '#22c55e',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(34, 197, 94, 0.12)';
                            }}
                          >
                            <Play size={12} weight="fill" />
                            Track
                          </button>
                        )}

                        {/* Edit Tags Button */}
                        <button
                          onClick={() => {
                            setEditingTaskId(task.id);
                            setEditMode('tags');
                            setEditValue(((task as any).tags || []).join(', '));
                          }}
                          title="Edit tags"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: 'rgba(139, 92, 246, 0.1)',
                            color: '#a78bfa',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(139, 92, 246, 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(139, 92, 246, 0.1)';
                          }}
                        >
                          <PencilSimple size={12} />
                        </button>

                        {/* Edit Notes Button */}
                        <button
                          onClick={() => {
                            setEditingTaskId(task.id);
                            setEditMode('notes');
                            setEditValue((task as any).notes || '');
                          }}
                          title="Edit notes"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: 'rgba(245, 158, 11, 0.1)',
                            color: '#f59e0b',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(245, 158, 11, 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
                          }}
                        >
                          <PencilSimple size={12} />
                        </button>

                        {/* Set Estimate Button */}
                        <button
                          onClick={() => setEstimateModalTaskId(task.id)}
                          title="Set estimate"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: 'rgba(6, 182, 212, 0.1)',
                            color: '#06b6d4',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(6, 182, 212, 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(6, 182, 212, 0.1)';
                          }}
                        >
                          <Timer size={12} />
                        </button>

                        {/* Audit Log Button */}
                        <button
                          onClick={() => setAuditTask({ id: task.id, title: task.title })}
                          title="View audit log"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: 'rgba(107, 114, 128, 0.1)',
                            color: '#9ca3af',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(107, 114, 128, 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(107, 114, 128, 0.1)';
                          }}
                        >
                          <ClockCounterClockwise size={12} />
                        </button>
                      </div>

                      {/* Assignee and Risk */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {/* Assignee Avatar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              backgroundColor: task.assigneeType === 'agent' ? '#3b82f6' : '#af52de',
                              color: '#fff',
                              fontSize: '12px',
                              fontWeight: 600,
                              overflow: 'hidden',
                            }}
                          >
                            {task.assigneeAvatar ? (
                              <img src={task.assigneeAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : task.assigneeType === 'agent' ? (
                              <Robot size={14} weight="fill" />
                            ) : (
                              <User size={14} weight="fill" />
                            )}
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {task.assigneeName || task.assignee}
                          </span>
                        </div>

                        {/* Risk Indicator */}
                        {task.risk && (
                          <div
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: getRiskColor(task.risk),
                              flexShrink: 0,
                            }}
                            title={`Risk: ${task.risk}`}
                          />
                        )}
                      </div>
                    </GlassSurface>
                  ))}
                  {tasks.length === 0 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 1,
                        color: 'var(--text-tertiary)',
                        fontSize: '13px',
                      }}
                    >
                      No tasks
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Spinner animation style */}
      <style>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>

      {/* Audit Log Modal */}
      {auditTask && (
        <AuditLogViewer
          taskId={auditTask.id}
          taskTitle={auditTask.title}
          onClose={() => setAuditTask(null)}
        />
      )}

      {/* Task Estimate Modal */}
      {estimateModalTaskId && (() => {
        const t = storeTasks.find((x) => x.id === estimateModalTaskId);
        return t ? (
          <TaskEstimateModal
            task={t}
            onClose={() => setEstimateModalTaskId(null)}
          />
        ) : null;
      })()}
    </div>
  );
};

export default TasksView;
