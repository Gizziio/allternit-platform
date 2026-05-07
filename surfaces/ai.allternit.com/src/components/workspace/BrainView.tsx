/**
 * Brain View Component
 * 
 * Visualizes the task graph with nodes and edges.
 * Shows active tasks, dependencies, and progress.
 * 
 * NOW USES REAL WORKSPACE DATA via api prop
 */

import { useState, useEffect, useMemo } from 'react';
import { WorkspaceAPI } from '../../agent-workspace';
import { Task } from '../../agent-workspace';

interface BrainViewProps {
  api: WorkspaceAPI;
}

export function BrainView({ api }: BrainViewProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'pending' | 'completed'>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Local state for tasks (BrainView manages its own data fetching)
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [backend, setBackend] = useState<string>('http');

  // Load tasks from API
  const refreshTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const taskList = await api.listTasks();
      setTasks(taskList);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load tasks'));
    } finally {
      setLoading(false);
    }
  };

  // Refresh on mount
  useEffect(() => {
    refreshTasks();
  }, [api]);

  const filteredTasks = useMemo(() => {
    if (filter === 'all') return tasks;
    return tasks.filter(t => t.status === filter);
  }, [tasks, filter]);

  const stats = useMemo(() => ({
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    active: tasks.filter(t => t.status === 'in_progress').length,
    pending: tasks.filter(t => t.status === 'pending').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  }), [tasks]);

  const handleCreateTask = async (title: string, description: string, priority: 'low' | 'medium' | 'high') => {
    try {
      await api.createTask({ title, description, priority });
      await refreshTasks();
      setShowCreateForm(false);
    } catch (err) {
      console.error('Failed to create task:', err);
      alert('Failed to create task: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    try {
      await api.updateTask(taskId, { status: newStatus });
      await refreshTasks();
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  if (loading) {
    return (
      <div className="brain-view brain-view--loading">
        <div className="spinner" />
        <p>Loading task graph...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="brain-view brain-view--error">
        <h3>Error Loading Tasks</h3>
        <p>{error.message}</p>
        <button onClick={refreshTasks}>Retry</button>
      </div>
    );
  }

  return (
    <div className="brain-view">
      {/* Backend Indicator */}
      <div className="brain-view__backend">
        <BackendBadge backend={backend} />
        <button onClick={refreshTasks} className="refresh-btn">
          Refresh
        </button>
      </div>

      {/* Stats Bar */}
      <div className="brain-view__stats">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Completed" value={stats.completed} color="var(--status-success)" />
        <StatCard label="Active" value={stats.active} color="var(--status-info)" />
        <StatCard label="Pending" value={stats.pending} color="var(--status-warning)" />
        <StatCard label="Failed" value={stats.failed} color="var(--status-error)" />
      </div>

      {/* Controls */}
      <div className="brain-view__controls">
        <div className="brain-view__filters">
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
            All
          </FilterButton>
          <FilterButton active={filter === 'active'} onClick={() => setFilter('active')}>
            Active
          </FilterButton>
          <FilterButton active={filter === 'pending'} onClick={() => setFilter('pending')}>
            Pending
          </FilterButton>
          <FilterButton active={filter === 'completed'} onClick={() => setFilter('completed')}>
            Completed
          </FilterButton>
        </div>
        <button 
          className="create-task-btn"
          onClick={() => setShowCreateForm(true)}
        >
          + New Task
        </button>
      </div>

      {/* Create Task Form */}
      {showCreateForm && (
        <CreateTaskForm 
          onSubmit={handleCreateTask}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Task Grid */}
      <div className="brain-view__grid">
        {filteredTasks.length === 0 ? (
          <div className="brain-view__empty">
            <p>No tasks found</p>
            <button onClick={() => setShowCreateForm(true)}>Create your first task</button>
          </div>
        ) : (
          filteredTasks.map(task => (
            <TaskCard 
              key={task.id} 
              task={task} 
              onClick={() => setSelectedTask(task)}
              isSelected={selectedTask?.id === task.id}
              onStatusChange={(status) => handleUpdateTaskStatus(task.id, status)}
            />
          ))
        )}
      </div>

      {/* Task Detail Panel */}
      {selectedTask && (
        <TaskDetailPanel 
          task={selectedTask} 
          onClose={() => setSelectedTask(null)}
          allTasks={tasks}
          onStatusChange={(status) => handleUpdateTaskStatus(selectedTask.id, status)}
        />
      )}

      {/* Graph Visualization */}
      <div className="brain-view__graph">
        <h3>Task Graph Visualization</h3>
        <TaskGraphVisualization tasks={tasks} />
      </div>
    </div>
  );
}

// Backend Badge
function BackendBadge({ backend }: { backend: string | null }) {
  if (!backend) return null;
  
  const isHttp = backend === 'http';
  return (
    <span 
      className={`backend-badge ${isHttp ? 'backend-badge--http' : 'backend-badge--wasm'}`}
      title={isHttp ? 'Connected to TUI server' : 'Running in browser (WASM)'}
    >
      {isHttp ? '● Connected' : '○ Offline Mode'}
    </span>
  );
}

// Create Task Form
function CreateTaskForm({ 
  onSubmit, 
  onCancel 
}: { 
  onSubmit: (title: string, description: string, priority: 'low' | 'medium' | 'high') => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSubmit(title.trim(), description.trim(), priority);
    }
  };

  return (
    <form className="create-task-form" onSubmit={handleSubmit}>
      <h4>Create New Task</h4>
      <input
        type="text"
        placeholder="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
      />
      <select value={priority} onChange={(e) => setPriority(e.target.value as any)}>
        <option value="low">Low Priority</option>
        <option value="medium">Medium Priority</option>
        <option value="high">High Priority</option>
      </select>
      <div className="create-task-form__buttons">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="submit" disabled={!title.trim()}>Create</button>
      </div>
    </form>
  );
}

// Sub-components
function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="stat-card" style={{ borderLeftColor: color || 'var(--ui-text-muted)' }}>
      <span className="stat-card__value" style={{ color: color || 'var(--ui-text-primary)' }}>
        {value}
      </span>
      <span className="stat-card__label">{label}</span>
    </div>
  );
}

function FilterButton({ 
  active, 
  onClick, 
  children 
}: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
}) {
  return (
    <button 
      className={`filter-button ${active ? 'filter-button--active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function TaskCard({ 
  task, 
  onClick, 
  isSelected,
  onStatusChange,
}: { 
  task: Task;
  onClick: () => void;
  isSelected: boolean;
  onStatusChange: (status: Task['status']) => void;
}) {
  const statusColors = {
    pending: 'var(--status-warning)',
    in_progress: 'var(--status-info)',
    completed: 'var(--status-success)',
    failed: 'var(--status-error)',
  };

  const priorityLabels = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
  };

  return (
    <div 
      className={`task-card ${isSelected ? 'task-card--selected' : ''}`}
      onClick={onClick}
    >
      <div className="task-card__header">
        <span 
          className="task-card__status" 
          style={{ backgroundColor: statusColors[task.status] }}
        />
        <span className="task-card__priority">{priorityLabels[task.priority]}</span>
      </div>
      
      <h4 className="task-card__title">{task.title}</h4>
      
      {task.description && (
        <p className="task-card__description">{task.description}</p>
      )}
      
      {task.dependencies.length > 0 && (
        <div className="task-card__dependencies">
          <span>Depends on: {task.dependencies.length} tasks</span>
        </div>
      )}

      {/* Quick Status Actions */}
      <div className="task-card__actions" onClick={(e) => e.stopPropagation()}>
        {task.status !== 'completed' && (
          <button 
            className="task-card__action task-card__action--complete"
            onClick={() => onStatusChange('completed')}
            title="Mark as completed"
          >
            ✓
          </button>
        )}
        {task.status === 'pending' && (
          <button 
            className="task-card__action task-card__action--start"
            onClick={() => onStatusChange('in_progress')}
            title="Start task"
          >
            ▶
          </button>
        )}
      </div>
    </div>
  );
}

function TaskDetailPanel({ 
  task, 
  onClose,
  allTasks,
  onStatusChange,
}: { 
  task: Task;
  onClose: () => void;
  allTasks: Task[];
  onStatusChange: (status: Task['status']) => void;
}) {
  const dependencies = allTasks.filter(t => task.dependencies.includes(t.id));
  
  const statusOptions: Task['status'][] = ['pending', 'in_progress', 'completed', 'failed'];
  
  return (
    <div className="task-detail-panel">
      <div className="task-detail-panel__header">
        <h3>{task.title}</h3>
        <button onClick={onClose} className="task-detail-panel__close">×</button>
      </div>
      
      <div className="task-detail-panel__content">
        <div className="task-detail-panel__field">
          <label>Status</label>
          <select 
            value={task.status} 
            onChange={(e) => onStatusChange(e.target.value as Task['status'])}
          >
            {statusOptions.map(s => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        
        <div className="task-detail-panel__field">
          <label>Priority</label>
          <span>{task.priority}</span>
        </div>
        
        {task.description && (
          <div className="task-detail-panel__field">
            <label>Description</label>
            <p>{task.description}</p>
          </div>
        )}
        
        {dependencies.length > 0 && (
          <div className="task-detail-panel__field">
            <label>Dependencies</label>
            <ul>
              {dependencies.map(dep => (
                <li key={dep.id}>{dep.title}</li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="task-detail-panel__field">
          <label>Created</label>
          <span>{new Date(task.createdAt).toLocaleString()}</span>
        </div>
        
        <div className="task-detail-panel__field">
          <label>Updated</label>
          <span>{new Date(task.updatedAt).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

function TaskGraphVisualization({ tasks }: { tasks: Task[] }) {
  return (
    <div className="task-graph-viz">
      <svg viewBox="0 0 800 400" className="task-graph-viz__svg">
        {tasks.map((task, index) => {
          const x = 100 + (index % 4) * 180;
          const y = 80 + Math.floor(index / 4) * 100;
          const colors = {
            pending: 'var(--status-warning)',
            in_progress: 'var(--status-info)',
            completed: 'var(--status-success)',
            failed: 'var(--status-error)',
          };
          
          return (
            <g key={task.id} transform={`translate(${x}, ${y})`}>
              <circle 
                r="30" 
                fill={colors[task.status]} 
                opacity="0.8"
                stroke="#fff"
                strokeWidth="2"
              />
              <text 
                textAnchor="middle" 
                dy="5" 
                fill="#fff"
                fontSize="12"
                fontWeight="bold"
              >
                {task.title.slice(0, 8)}...
              </text>
              
              {task.dependencies.map((depId, i) => {
                const depIndex = tasks.findIndex(t => t.id === depId);
                if (depIndex === -1) return null;
                const depX = 100 + (depIndex % 4) * 180;
                const depY = 80 + Math.floor(depIndex / 4) * 100;
                
                return (
                  <line
                    key={`${task.id}-${depId}`}
                    x1={depX - x + 30}
                    y1={depY - y}
                    x2="0"
                    y2="-30"
                    stroke="#666"
                    strokeWidth="2"
                    markerEnd="url(#arrowhead)"
                  />
                );
              })}
            </g>
          );
        })}
        
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}

// CSS Styles
export const brainViewStyles = `
.brain-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.brain-view__backend {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.backend-badge {
  font-size: 0.875rem;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-weight: 500;
}

.backend-badge--http {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.backend-badge--wasm {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.refresh-btn {
  padding: 0.5rem 1rem;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  color: #e0e0e0;
  cursor: pointer;
}

.refresh-btn:hover {
  background: #3a3a3a;
}

.brain-view--loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 1rem;
}

.brain-view--error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 1rem;
  color: #ef4444;
}

.brain-view__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
}

.stat-card {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-left-width: 4px;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-card__value {
  font-size: 2rem;
  font-weight: 700;
}

.stat-card__label {
  font-size: 0.875rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.brain-view__controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.brain-view__filters {
  display: flex;
  gap: 0.5rem;
}

.filter-button {
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  color: #888;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-button:hover {
  background: #2a2a2a;
  color: #e0e0e0;
}

.filter-button--active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.create-task-btn {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  font-weight: 500;
}

.create-task-btn:hover {
  background: #2563eb;
}

.create-task-form {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.create-task-form h4 {
  margin: 0;
}

.create-task-form input,
.create-task-form textarea,
.create-task-form select {
  padding: 0.75rem;
  background: #0f0f0f;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 0.875rem;
}

.create-task-form__buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.create-task-form__buttons button {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
}

.create-task-form__buttons button[type="button"] {
  background: transparent;
  border: 1px solid #2a2a2a;
  color: #888;
}

.create-task-form__buttons button[type="submit"] {
  background: #3b82f6;
  border: none;
  color: white;
}

.create-task-form__buttons button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.brain-view__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.brain-view__empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 3rem;
  color: #666;
}

.task-card {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.task-card:hover {
  border-color: #3b82f6;
  transform: translateY(-2px);
}

.task-card--selected {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
}

.task-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.task-card__status {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.task-card__priority {
  font-size: 0.75rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.task-card__title {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  font-weight: 600;
}

.task-card__description {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  color: #888;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-card__dependencies {
  font-size: 0.75rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.task-card__actions {
  position: absolute;
  top: 1rem;
  right: 1rem;
  display: flex;
  gap: 0.5rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.task-card:hover .task-card__actions {
  opacity: 1;
}

.task-card__action {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
}

.task-card__action--complete {
  background: #10b981;
  color: white;
}

.task-card__action--start {
  background: #3b82f6;
  color: white;
}

.task-detail-panel {
  position: fixed;
  right: 0;
  top: 0;
  width: 400px;
  height: 100vh;
  background: #1a1a1a;
  border-left: 1px solid #2a2a2a;
  z-index: 100;
  overflow-y: auto;
}

.task-detail-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #2a2a2a;
}

.task-detail-panel__header h3 {
  margin: 0;
  font-size: 1.25rem;
}

.task-detail-panel__close {
  background: none;
  border: none;
  color: #888;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.25rem;
}

.task-detail-panel__close:hover {
  color: #e0e0e0;
}

.task-detail-panel__content {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.task-detail-panel__field label {
  display: block;
  font-size: 0.75rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

.task-detail-panel__field p {
  margin: 0;
  line-height: 1.6;
}

.task-detail-panel__field select {
  padding: 0.5rem;
  background: #0f0f0f;
  border: 1px solid #2a2a2a;
  border-radius: 4px;
  color: #e0e0e0;
}

.brain-view__graph {
  margin-top: 2rem;
  padding: 1.5rem;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
}

.brain-view__graph h3 {
  margin: 0 0 1rem;
  font-size: 1rem;
}

.task-graph-viz {
  background: #0f0f0f;
  border-radius: 8px;
  overflow: hidden;
}

.task-graph-viz__svg {
  width: 100%;
  height: 400px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #2a2a2a;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
`;
