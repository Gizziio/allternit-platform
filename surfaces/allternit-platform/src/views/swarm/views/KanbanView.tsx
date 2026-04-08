/**
 * Kanban View - Drag-and-drop task board
 * 
 * Features:
 * - Column-based workflow (Backlog, Ready, In Progress, Review, Done)
 * - Drag-and-drop task cards between columns
 * - Assign/unassign agents to tasks
 * - Quick task creation
 * - Real-time updates from agent store
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Plus, Brain, Robot, Cpu, ClipboardText, UserPlus, DotsThree, Tray, X } from '@phosphor-icons/react';
import { TEXT, MODE_COLORS, STATUS, BACKGROUND } from '@/design/allternit.tokens';
import { useSwarmMonitorStore, useAgents } from '../SwarmMonitor.store';
import { SwarmAgent, Task } from '../types';
import { toast } from '@/hooks/use-toast';

const AGENT_ICON_MAP: Record<string, React.ElementType> = {
  brain: Brain, robot: Robot, microchip: Cpu, 'clipboard-check': ClipboardText,
};
function AgentIconInline({ icon, color, size = 10 }: { icon: string; color: string; size?: number }) {
  const Icon = AGENT_ICON_MAP[icon] ?? Robot;
  return <Icon size={size} color={color} weight="duotone" />;
}

interface KanbanTask {
  id: string;
  title: string;
  description?: string;
  status: 'backlog' | 'ready' | 'in-progress' | 'review' | 'done';
  assignedAgentId?: string;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface KanbanColumn {
  id: string;
  title: string;
  status: KanbanTask['status'];
  color: string;
}

const COLUMNS: KanbanColumn[] = [
  { id: 'backlog', title: 'Backlog', status: 'backlog', color: TEXT.tertiary },
  { id: 'ready', title: 'Ready', status: 'ready', color: STATUS.info },
  { id: 'in-progress', title: 'In Progress', status: 'in-progress', color: '#c17817' },
  { id: 'review', title: 'Review', status: 'review', color: '#a78bfa' },
  { id: 'done', title: 'Done', status: 'done', color: STATUS.success },
];

const PRIORITY_COLORS = {
  low: '#6b7280',
  medium: '#c17817',
  high: STATUS.error,
};

// Generate initial tasks from agents
function generateTasksFromAgents(agents: SwarmAgent[]): KanbanTask[] {
  const tasks: KanbanTask[] = [];
  
  agents.forEach(agent => {
    agent.currentTasks.forEach(task => {
      let status: KanbanTask['status'] = 'backlog';
      if (task.status === 'active') status = 'in-progress';
      else if (task.status === 'completed') status = 'done';
      else if (task.status === 'pending') status = 'ready';
      
      tasks.push({
        id: task.id,
        title: task.name,
        description: task.description,
        status,
        assignedAgentId: agent.id,
        priority: 'medium',
        tags: [agent.role],
        createdAt: task.startTime,
        startedAt: task.status === 'active' ? task.startTime : undefined,
        completedAt: task.status === 'completed' ? new Date().toISOString() : undefined,
      });
    });
  });
  
  // Add some unassigned tasks
  tasks.push(
    {
      id: 'task-unassigned-1',
      title: 'API Documentation',
      description: 'Document all API endpoints',
      status: 'backlog',
      priority: 'low',
      tags: ['documentation'],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'task-unassigned-2',
      title: 'Performance Optimization',
      description: 'Optimize database queries',
      status: 'ready',
      priority: 'high',
      tags: ['performance', 'database'],
      createdAt: new Date().toISOString(),
    }
  );
  
  return tasks;
}

interface KanbanViewProps {
  modeColors: { accent: string };
}

export function KanbanView({ modeColors }: KanbanViewProps) {
  const agents = useAgents();
  const [tasks, setTasks] = useState<KanbanTask[]>(() => generateTasksFromAgents(agents));
  const [draggingTask, setDraggingTask] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);

  // Update tasks when agents change
  useEffect(() => {
    setTasks(generateTasksFromAgents(agents));
  }, [agents]);

  const handleDragStart = useCallback((taskId: string) => {
    setDraggingTask(taskId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, status: KanbanTask['status']) => {
    e.preventDefault();
    
    if (!draggingTask) return;
    
    setTasks(prev => prev.map(task => {
      if (task.id !== draggingTask) return task;
      
      const updates: Partial<KanbanTask> = { status };
      
      if (status === 'in-progress' && !task.startedAt) {
        updates.startedAt = new Date().toISOString();
      }
      if (status === 'done' && !task.completedAt) {
        updates.completedAt = new Date().toISOString();
      }
      
      return { ...task, ...updates };
    }));
    
    setDraggingTask(null);
    setDragOverColumn(null);
    
    toast({
      title: 'Task Updated',
      description: `Moved to ${COLUMNS.find(c => c.status === status)?.title}`,
    });
  }, [draggingTask]);

  const handleCreateTask = useCallback((title: string, priority: KanbanTask['priority']) => {
    const newTask: KanbanTask = {
      id: `task-${Date.now()}`,
      title,
      status: 'backlog',
      priority,
      tags: [],
      createdAt: new Date().toISOString(),
    };
    
    setTasks(prev => [...prev, newTask]);
    setShowCreateModal(false);
    
    toast({
      title: 'Task Created',
      description: `"${title}" added to backlog`,
    });
  }, []);

  const handleAssignAgent = useCallback((taskId: string, agentId: string | undefined) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, assignedAgentId: agentId } : task
    ));
    
    const agent = agents.find(a => a.id === agentId);
    toast({
      title: agent ? 'Agent Assigned' : 'Agent Unassigned',
      description: agent ? `Assigned to ${agent.name}` : 'Task unassigned',
    });
  }, [agents]);

  const handleDeleteTask = useCallback((taskId: string) => {
    if (confirm('Delete this task?')) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast({ title: 'Task Deleted', description: 'Task removed from board' });
    }
  }, []);

  const getTasksForColumn = (status: KanbanTask['status']) => 
    tasks.filter(t => t.status === status);

  const getAssignedAgent = (agentId?: string) => agents.find(a => a.id === agentId);

  return (
    <div className="h-full flex flex-col" style={{ background: BACKGROUND.primary }}>
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-4">
          <div className="text-xs" style={{ color: TEXT.tertiary }}>
            <span className="mono" style={{ color: modeColors.accent }}>{tasks.length}</span> tasks
          </div>
          <div className="flex items-center gap-2">
            {COLUMNS.map(col => (
              <div key={col.id} className="flex items-center gap-1.5 text-xs" style={{ color: TEXT.tertiary }}>
                <span className="w-2 h-2 rounded-full" style={{ background: col.color }}></span>
                {getTasksForColumn(col.status).length}
              </div>
            ))}
          </div>
        </div>
        
        <button 
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{ background: `${modeColors.accent}20`, color: modeColors.accent }}
        >
          <Plus size={11} weight="bold" style={{ marginRight: 4 }} /> New Task
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full" style={{ minWidth: '1200px' }}>
          {COLUMNS.map(column => {
            const columnTasks = getTasksForColumn(column.status);
            const isDragOver = dragOverColumn === column.id;
            
            return (
              <div 
                key={column.id}
                className="flex-1 flex flex-col min-w-[220px] max-w-[280px]"
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.status)}
              >
                {/* Column Header */}
                <div 
                  className="flex items-center justify-between px-3 py-2 rounded-t-lg border-t border-x"
                  style={{ 
                    background: isDragOver ? `${column.color}20` : 'rgba(255,255,255,0.02)',
                    borderColor: isDragOver ? column.color : 'rgba(255,255,255,0.05)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: column.color }}></span>
                    <span className="text-xs font-medium">{column.title}</span>
                  </div>
                  <span 
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(255,255,255,0.05)', color: TEXT.tertiary }}
                  >
                    {columnTasks.length}
                  </span>
                </div>

                {/* Column Body */}
                <div 
                  className="flex-1 p-2 rounded-b-lg border-b border-x overflow-y-auto"
                  style={{ 
                    background: isDragOver ? `${column.color}10` : 'rgba(255,255,255,0.02)',
                    borderColor: isDragOver ? column.color : 'rgba(255,255,255,0.05)',
                  }}
                >
                  <div className="space-y-2">
                    {columnTasks.map(task => {
                      const assignedAgent = getAssignedAgent(task.assignedAgentId);
                      const isDragging = draggingTask === task.id;
                      
                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={() => handleDragStart(task.id)}
                          onClick={() => setSelectedTask(task)}
                          className="p-3 rounded-lg border cursor-pointer transition-all hover:border-white/20"
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            borderColor: isDragging ? column.color : 'rgba(255,255,255,0.08)',
                            opacity: isDragging ? 0.5 : 1,
                          }}
                        >
                          {/* Priority & Tags */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex gap-1">
                              {task.tags.slice(0, 2).map(tag => (
                                <span 
                                  key={tag}
                                  className="text-[10px] px-1.5 py-0.5 rounded"
                                  style={{ background: 'rgba(255,255,255,0.05)', color: TEXT.tertiary }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <span 
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: PRIORITY_COLORS[task.priority] }}
                              title={`Priority: ${task.priority}`}
                            ></span>
                          </div>

                          {/* Title */}
                          <h4 className="text-sm font-medium mb-1 line-clamp-2">{task.title}</h4>
                          
                          {task.description && (
                            <p className="text-xs mb-2 line-clamp-2" style={{ color: TEXT.tertiary }}>
                              {task.description}
                            </p>
                          )}

                          {/* Assigned Agent */}
                          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                            {assignedAgent ? (
                              <div className="flex items-center gap-1.5">
                                <div 
                                  className="w-5 h-5 rounded flex items-center justify-center"
                                  style={{ background: `${assignedAgent.color}20` }}
                                >
                                  <AgentIconInline icon={assignedAgent.icon} color={assignedAgent.color} size={10} />
                                </div>
                                <span className="text-[10px] truncate max-w-[80px]" style={{ color: TEXT.secondary }}>
                                  {assignedAgent.name}
                                </span>
                              </div>
                            ) : (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Show agent selector
                                }}
                                className="text-[10px] px-2 py-1 rounded transition-colors hover:bg-white/5"
                                style={{ color: TEXT.tertiary }}
                              >
                                <UserPlus size={10} weight="bold" style={{ marginRight: 4 }} /> Assign
                              </button>
                            )}
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTask(task.id);
                              }}
                              className="text-[10px] p-1 rounded hover:bg-white/5"
                              style={{ color: TEXT.tertiary }}
                            >
                              <DotsThree size={12} weight="bold" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    
                    {columnTasks.length === 0 && (
                      <div 
                        className="p-4 rounded-lg border border-dashed text-center"
                        style={{ borderColor: 'rgba(255,255,255,0.05)', color: TEXT.tertiary }}
                      >
                        <Tray size={20} weight="duotone" style={{ margin: '0 auto 4px' }} />
                        <span className="text-xs">No tasks</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <CreateTaskModal
          onCreate={handleCreateTask}
          onClose={() => setShowCreateModal(false)}
          modeColors={modeColors}
        />
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          agents={agents}
          onAssign={handleAssignAgent}
          onClose={() => setSelectedTask(null)}
          modeColors={modeColors}
        />
      )}
    </div>
  );
}

// ============================================================================
// Create Task Modal
// ============================================================================

interface CreateTaskModalProps {
  onCreate: (title: string, priority: 'low' | 'medium' | 'high') => void;
  onClose: () => void;
  modeColors: { accent: string };
}

function CreateTaskModal({ onCreate, onClose, modeColors }: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onCreate(title.trim(), priority);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div 
        className="w-full max-w-sm p-5 rounded-xl border"
        style={{ background: BACKGROUND.primary, borderColor: 'rgba(255,255,255,0.1)' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold mb-4">New Task</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: TEXT.tertiary }}>Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ 
                background: 'rgba(255,255,255,0.03)', 
                border: '1px solid rgba(255,255,255,0.08)',
                color: TEXT.primary 
              }}
              placeholder="What needs to be done?"
            />
          </div>

          <div>
            <label className="block text-xs mb-1.5" style={{ color: TEXT.tertiary }}>Priority</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className="flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-all"
                  style={{
                    background: priority === p ? `${PRIORITY_COLORS[p]}20` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${priority === p ? PRIORITY_COLORS[p] : 'rgba(255,255,255,0.08)'}`,
                    color: priority === p ? PRIORITY_COLORS[p] : TEXT.tertiary,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
              style={{ background: 'rgba(255,255,255,0.05)', color: TEXT.secondary }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all hover:opacity-80 disabled:opacity-50"
              style={{ background: `${modeColors.accent}20`, color: modeColors.accent }}
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Task Detail Modal
// ============================================================================

interface TaskDetailModalProps {
  task: KanbanTask;
  agents: SwarmAgent[];
  onAssign: (taskId: string, agentId: string | undefined) => void;
  onClose: () => void;
  modeColors: { accent: string };
}

function TaskDetailModal({ task, agents, onAssign, onClose, modeColors }: TaskDetailModalProps) {
  const assignedAgent = agents.find(a => a.id === task.assignedAgentId);
  const column = COLUMNS.find(c => c.status === task.status);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md p-5 rounded-xl border"
        style={{ background: BACKGROUND.primary, borderColor: 'rgba(255,255,255,0.1)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span 
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: `${column?.color}20`, color: column?.color }}
              >
                {column?.title}
              </span>
              <span 
                className="w-2 h-2 rounded-full"
                style={{ background: PRIORITY_COLORS[task.priority] }}
                title={`Priority: ${task.priority}`}
              ></span>
            </div>
            <h3 className="text-lg font-semibold">{task.title}</h3>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5"
            style={{ color: TEXT.tertiary }}
          >
            <X size={12} weight="bold" />
          </button>
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-sm mb-4" style={{ color: TEXT.secondary }}>
            {task.description}
          </p>
        )}

        {/* Assigned Agent */}
        <div className="mb-4">
          <label className="block text-xs mb-2" style={{ color: TEXT.tertiary }}>Assigned Agent</label>
          
          {assignedAgent ? (
            <div className="flex items-center justify-between p-3 rounded-lg border" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: `${assignedAgent.color}20` }}
                >
                  <AgentIconInline icon={assignedAgent.icon} color={assignedAgent.color} size={14} />
                </div>
                <div>
                  <div className="font-medium">{assignedAgent.name}</div>
                  <div className="text-xs" style={{ color: TEXT.tertiary }}>{assignedAgent.role}</div>
                </div>
              </div>
              <button
                onClick={() => onAssign(task.id, undefined)}
                className="px-3 py-1.5 rounded-lg text-xs"
                style={{ color: TEXT.tertiary }}
              >
                <X size={10} weight="bold" style={{ marginRight: 4 }} /> Unassign
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs" style={{ color: TEXT.tertiary }}>Select an agent:</div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {agents.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => onAssign(task.id, agent.id)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors hover:bg-white/5"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div 
                      className="w-8 h-8 rounded flex items-center justify-center"
                      style={{ background: `${agent.color}20` }}
                    >
                      <AgentIconInline icon={agent.icon} color={agent.color} size={12} />
                    </div>
                    <div>
                      <div className="text-sm">{agent.name}</div>
                      <div className="text-[10px]" style={{ color: TEXT.tertiary }}>{agent.status}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="mb-4">
          <label className="block text-xs mb-2" style={{ color: TEXT.tertiary }}>Tags</label>
          <div className="flex flex-wrap gap-1">
            {task.tags.map(tag => (
              <span 
                key={tag}
                className="text-xs px-2 py-1 rounded"
                style={{ background: 'rgba(255,255,255,0.05)', color: TEXT.secondary }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Dates */}
        <div className="pt-4 border-t space-y-1 text-xs" style={{ borderColor: 'rgba(255,255,255,0.05)', color: TEXT.tertiary }}>
          <div className="flex justify-between">
            <span>Created</span>
            <span className="mono">{new Date(task.createdAt).toLocaleDateString()}</span>
          </div>
          {task.startedAt && (
            <div className="flex justify-between">
              <span>Started</span>
              <span className="mono">{new Date(task.startedAt).toLocaleDateString()}</span>
            </div>
          )}
          {task.completedAt && (
            <div className="flex justify-between">
              <span>Completed</span>
              <span className="mono">{new Date(task.completedAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
