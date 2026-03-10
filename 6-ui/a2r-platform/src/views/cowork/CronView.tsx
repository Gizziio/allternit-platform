/**
 * CronView - Schedule and automate tasks
 * Shows scheduled and recurring tasks with form overlays for creation and management
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useCoworkStore } from './CoworkStore';
import { 
  CalendarCheck, 
  Clock, 
  Plus, 
  X,
  Play,
  Trash2,
  Pencil,
  ChevronDown,
  FolderOpen,
  Bot,
  CheckSquare,
  MoreVertical,
  Calendar,
  Sparkles,
  Cpu,
  RefreshCw,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useModelSelection } from '@/providers/model-selection-provider';
import { ModelPicker, type ModelSelection } from '@/components/model-picker';
import { useAgentStore } from '@/lib/agents';
import { HeartbeatScheduler } from '@/components/agent-workspace';
import { 
  createScheduledJob, 
  runScheduledJobNow, 
  deleteScheduledJob,
  listScheduledJobs,
  updateScheduledJob,
  type ScheduledJobConfig 
} from '@/lib/agents/scheduled-jobs.service';

// Task with scheduling info
type Frequency = 'manual' | 'hourly' | 'daily' | 'weekdays' | 'weekly';

interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  prompt: string;
  modelOrAgent: string;
  modelSelection?: ModelSelection;
  agentId?: string;
  folder: string;
  frequency: Frequency;
  isActive: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
  mode: 'agent' | 'task';
}

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
];

export function CronView() {
  const { tasks, createTask, deleteTask, renameTask } = useCoworkStore();
  const [activeTab, setActiveTab] = useState<'scheduled' | 'recurring' | 'agent-heartbeats'>('scheduled');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [selectedTask, setSelectedTask] = useState<ScheduledTask | null>(null);
  const [selectedHeartbeatAgent, setSelectedHeartbeatAgent] = useState<string | null>(null);
  
  // Scheduled tasks from store
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Load scheduled jobs from backend on mount
  useEffect(() => {
    loadScheduledJobs();
  }, []);
  
  const loadScheduledJobs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const jobs = await listScheduledJobs();
      // Convert backend jobs to our ScheduledTask format
      const convertedTasks: ScheduledTask[] = jobs.map(job => {
        // Determine frequency from cron schedule
        let frequency: Frequency = 'manual';
        if (job.schedule === '0 * * * *') frequency = 'hourly';
        else if (job.schedule === '0 9 * * *') frequency = 'daily';
        else if (job.schedule === '0 9 * * 1-5') frequency = 'weekdays';
        else if (job.schedule === '0 9 * * 1') frequency = 'weekly';
        
        return {
          id: job.id || `job-${Date.now()}`,
          name: job.name,
          description: job.description || '',
          prompt: job.prompt || '',
          modelOrAgent: job.taskType || 'default',
          folder: (job.parameters?.folder as string) || '/workspace',
          frequency,
          isActive: job.enabled,
          lastRun: job.lastRunAt,
          nextRun: job.nextRunAt,
          createdAt: job.createdAt || new Date().toISOString(),
          mode: (job.parameters?.mode as 'agent' | 'task') || 'task',
          agentId: job.parameters?.agentId as string,
        };
      });
      setScheduledTasks(convertedTasks);
    } catch (e) {
      setError('Failed to load scheduled jobs');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Filter tasks
  const filteredTasks = useMemo(() => {
    if (activeTab === 'scheduled') {
      return scheduledTasks.filter(t => t.frequency !== 'manual');
    } else {
      return scheduledTasks.filter(t => t.frequency === 'manual' || t.frequency === 'hourly');
    }
  }, [scheduledTasks, activeTab]);
  
  // Create new scheduled task
  const handleCreateTask = async (taskData: Omit<ScheduledTask, 'id' | 'createdAt' | 'isActive'>) => {
    setIsLoading(true);
    setError(null);
    try {
      // Convert frequency to cron expression
      let cronSchedule: string;
      switch (taskData.frequency) {
        case 'hourly': cronSchedule = '0 * * * *'; break;
        case 'daily': cronSchedule = '0 9 * * *'; break;
        case 'weekdays': cronSchedule = '0 9 * * 1-5'; break;
        case 'weekly': cronSchedule = '0 9 * * 1'; break;
        case 'manual': 
        default: cronSchedule = '0 0 * * *'; break;
      }
      
      // Create the job on the backend
      const jobConfig = await createScheduledJob({
        name: taskData.name,
        description: taskData.description,
        schedule: cronSchedule,
        prompt: taskData.prompt,
        taskType: (taskData.mode === 'agent' ? 'agent-task' : 'custom-task') as 'custom-task',
        parameters: {
          folder: taskData.folder,
          agentId: taskData.agentId,
          mode: taskData.mode,
        },
        enabled: true,
        maxRetries: 3,
        timeout: 300,
        notifyOnSuccess: false,
        notifyOnFailure: true,
      });
      
      const newTask: ScheduledTask = {
        ...taskData,
        id: jobConfig.id || `sched-${Date.now()}`,
        createdAt: jobConfig.createdAt || new Date().toISOString(),
        isActive: true,
      };
      setScheduledTasks([...scheduledTasks, newTask]);
      setShowCreateForm(false);
    } catch (e) {
      setError('Failed to create scheduled job');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Delete task
  const handleDeleteTask = async (taskId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await deleteScheduledJob(taskId);
      setScheduledTasks(scheduledTasks.filter(t => t.id !== taskId));
      if (selectedTask?.id === taskId) {
        setSelectedTask(null);
      }
    } catch (e) {
      setError('Failed to delete scheduled job');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Update task (local state only - for toggle active/inactive)
  const handleUpdateTask = (taskId: string, updates: Partial<ScheduledTask>) => {
    setScheduledTasks(scheduledTasks.map(t => 
      t.id === taskId ? { ...t, ...updates } : t
    ));
    if (selectedTask?.id === taskId) {
      setSelectedTask({ ...selectedTask, ...updates });
    }
  };
  
  // Edit task - save changes to backend
  const handleEditTask = async (taskId: string, taskData: Omit<ScheduledTask, 'id' | 'createdAt' | 'isActive'>) => {
    setIsLoading(true);
    setError(null);
    try {
      // Convert frequency to cron expression
      let cronSchedule: string;
      switch (taskData.frequency) {
        case 'hourly': cronSchedule = '0 * * * *'; break;
        case 'daily': cronSchedule = '0 9 * * *'; break;
        case 'weekdays': cronSchedule = '0 9 * * 1-5'; break;
        case 'weekly': cronSchedule = '0 9 * * 1'; break;
        case 'manual': 
        default: cronSchedule = '0 0 * * *'; break;
      }
      
      // Update the job on the backend
      await updateScheduledJob(taskId, {
        name: taskData.name,
        description: taskData.description,
        schedule: cronSchedule,
        prompt: taskData.prompt,
        taskType: (taskData.mode === 'agent' ? 'agent-task' : 'custom-task') as 'custom-task',
        parameters: {
          folder: taskData.folder,
          agentId: taskData.agentId,
          mode: taskData.mode,
        },
      });
      
      // Update local state
      const updatedTask: ScheduledTask = {
        ...taskData,
        id: taskId,
        createdAt: editingTask?.createdAt || new Date().toISOString(),
        isActive: editingTask?.isActive ?? true,
      };
      
      setScheduledTasks(scheduledTasks.map(t => 
        t.id === taskId ? updatedTask : t
      ));
      
      // Close edit form and detail view
      setShowEditForm(false);
      setEditingTask(null);
      setSelectedTask(null);
      
      // Refresh the list to get updated data from backend
      await loadScheduledJobs();
    } catch (e) {
      setError('Failed to update scheduled job');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Run task now
  const handleRunNow = async (task: ScheduledTask) => {
    setRunningTaskId(task.id);
    setError(null);
    try {
      await runScheduledJobNow(task.id);
      // Update the task with last run time
      handleUpdateTask(task.id, { lastRun: new Date().toISOString() });
    } catch (e) {
      setError(`Failed to run task: ${task.name}`);
      console.error(e);
    } finally {
      setRunningTaskId(null);
    }
  };
  
  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '24px 24px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Title row - centered */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 600,
              color: '#f0c8aa',
            }}>
              Cron
            </h1>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: 14,
              color: '#6b6b6b',
            }}>
              Schedule and automate your tasks
            </p>
          </div>
        </div>
      </div>
      
      {/* Tabs with button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <TabButton 
            active={activeTab === 'scheduled'} 
            onClick={() => setActiveTab('scheduled')}
            icon={Clock}
            count={scheduledTasks.filter(t => t.frequency !== 'manual').length}
          >
            Scheduled
          </TabButton>
          <TabButton 
            active={activeTab === 'recurring'} 
            onClick={() => setActiveTab('recurring')}
            icon={CalendarCheck}
            count={scheduledTasks.filter(t => t.frequency === 'manual' || t.frequency === 'hourly').length}
          >
            Recurring
          </TabButton>
          <TabButton 
            active={activeTab === 'agent-heartbeats'} 
            onClick={() => setActiveTab('agent-heartbeats')}
            icon={Bot}
            count={0}
          >
            Agent Heartbeats
          </TabButton>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={loadScheduledJobs}
            disabled={isLoading}
            style={{
              padding: '6px 12px',
              height: 32,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: '#9b9b9b',
              fontSize: 13,
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            <RefreshCw size={14} style={{ animation: isLoading ? 'spin 1s linear infinite' : undefined }} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            disabled={isLoading}
            style={{
              padding: '6px 12px',
              height: 32,
              background: 'linear-gradient(135deg, rgba(217,119,87,0.9) 0%, rgba(212,176,140,0.8) 100%)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(217,119,87,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <Plus size={16} />
          New Scheduled Task
        </button>
      </div>
      </div>
      
      {/* Error Display */}
      {error && (
        <div style={{
          padding: '12px 24px',
          background: 'rgba(239, 68, 68, 0.1)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#ef4444',
          fontSize: '13px',
        }}>
          <AlertCircle size={16} />
          {error}
          <button 
            onClick={() => setError(null)}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      
      {/* Task Cards Grid or Agent Heartbeats */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto', 
        padding: '24px',
      }}>
        {activeTab === 'agent-heartbeats' ? (
          <AgentHeartbeatsTab 
            selectedAgent={selectedHeartbeatAgent}
            onSelectAgent={setSelectedHeartbeatAgent}
          />
        ) : filteredTasks.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
          }}>
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isRunning={runningTaskId === task.id}
                onClick={() => setSelectedTask(task)}
                onRunNow={() => handleRunNow(task)}
              />
            ))}
          </div>
        ) : (
          <EmptyState 
            icon={activeTab === 'scheduled' ? Clock : CalendarCheck}
            title={`No ${activeTab} tasks`}
            description={`Create a ${activeTab} task to automate your workflow.`}
          />
        )}
      </div>
      
      {/* Create Task Form Overlay */}
      {showCreateForm && (
        <CreateTaskForm
          onClose={() => setShowCreateForm(false)}
          onSave={handleCreateTask}
        />
      )}
      
      {/* Edit Task Form Overlay */}
      {showEditForm && editingTask && (
        <EditTaskForm
          task={editingTask}
          onClose={() => {
            setShowEditForm(false);
            setEditingTask(null);
          }}
          onSave={handleEditTask}
        />
      )}
      
      {/* Task Detail Overlay */}
      {selectedTask && (
        <TaskDetailOverlay
          task={selectedTask}
          isRunning={runningTaskId === selectedTask.id}
          onClose={() => setSelectedTask(null)}
          onUpdate={(updates) => handleUpdateTask(selectedTask.id, updates)}
          onDelete={() => handleDeleteTask(selectedTask.id)}
          onRunNow={() => handleRunNow(selectedTask)}
          onEdit={() => {
            setEditingTask(selectedTask);
            setShowEditForm(true);
          }}
        />
      )}
    </div>
  );
}

// Tab Button Component
function TabButton({ 
  active, 
  onClick, 
  icon: Icon, 
  children,
  count 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ElementType;
  children: React.ReactNode;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 16px',
        borderRadius: 10,
        border: 'none',
        background: active 
          ? 'linear-gradient(135deg, rgba(217,119,87,0.18) 0%, rgba(212,176,140,0.12) 100%)' 
          : 'transparent',
        color: active ? '#f0c8aa' : '#6b6b6b',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transition: 'all 0.2s',
      }}
    >
      <Icon size={16} />
      {children}
      <span style={{ 
        fontSize: 11, 
        opacity: 0.7,
        marginLeft: 4,
      }}>
        {count}
      </span>
    </button>
  );
}

// Task Card Component
function TaskCard({ 
  task, 
  onClick, 
  onRunNow,
  isRunning = false
}: { 
  task: ScheduledTask; 
  onClick: () => void;
  onRunNow: () => void;
  isRunning?: boolean;
}) {
  const getFrequencyLabel = (freq: Frequency) => {
    return FREQUENCY_OPTIONS.find(o => o.value === freq)?.label || freq;
  };
  
  const formatNextRun = (nextRun?: string) => {
    if (!nextRun) return 'Not scheduled';
    const date = new Date(nextRun);
    return date.toLocaleString();
  };
  
  // Get display name for model/agent
  const getModelOrAgentDisplay = () => {
    if (task.mode === 'agent' && task.agentId) {
      return 'Agent Task';
    }
    return task.modelSelection?.modelName || task.modelOrAgent || 'Default Model';
  };
  
  return (
    <div
      onClick={onClick}
      style={{
        padding: 20,
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.06)',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
        e.currentTarget.style.borderColor = 'rgba(212,176,140,0.2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: task.mode === 'agent' 
            ? 'linear-gradient(135deg, rgba(167,139,250,0.2) 0%, rgba(167,139,250,0.1) 100%)' 
            : 'linear-gradient(135deg, rgba(217,119,87,0.2) 0%, rgba(212,176,140,0.1) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {task.mode === 'agent' ? <Bot size={20} color="#d4c5f9" /> : <CheckSquare size={20} color="#d4b08c" />}
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{
            padding: '4px 10px',
            borderRadius: 20,
            background: task.isActive ? 'rgba(34,197,94,0.1)' : 'rgba(107,107,107,0.1)',
            color: task.isActive ? '#22c55e' : '#6b6b6b',
            fontSize: 11,
            fontWeight: 600,
          }}>
            {task.isActive ? 'Active' : 'Inactive'}
          </span>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isRunning) onRunNow();
            }}
            disabled={isRunning}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: isRunning ? 'rgba(107,107,107,0.1)' : 'rgba(217,119,87,0.1)',
              color: isRunning ? '#6b6b6b' : '#d4b08c',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isRunning ? (
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Play size={16} />
            )}
          </button>
        </div>
      </div>
      
      {/* Content */}
      <h3 style={{
        margin: '0 0 8px 0',
        fontSize: 16,
        fontWeight: 600,
        color: '#f0c8aa',
      }}>
        {task.name}
      </h3>
      
      <p style={{
        margin: '0 0 16px 0',
        fontSize: 13,
        color: '#6b6b6b',
        lineHeight: 1.5,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {task.description}
      </p>
      
      {/* Footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        paddingTop: 16,
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calendar size={14} color="#6b6b6b" />
          <span style={{ fontSize: 12, color: '#6b6b6b' }}>
            {getFrequencyLabel(task.frequency)}
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {task.mode === 'agent' ? <Bot size={14} color="#6b6b6b" /> : <Cpu size={14} color="#6b6b6b" />}
          <span style={{ fontSize: 12, color: '#6b6b6b' }}>
            {getModelOrAgentDisplay()}
          </span>
        </div>
      </div>
    </div>
  );
}

// Create Task Form Overlay
function CreateTaskForm({ 
  onClose, 
  onSave 
}: { 
  onClose: () => void;
  onSave: (task: Omit<ScheduledTask, 'id' | 'createdAt' | 'isActive'>) => void;
}) {
  return (
    <TaskForm
      mode="create"
      onClose={onClose}
      onSave={(taskId, taskData) => onSave(taskData)}
    />
  );
}

// Edit Task Form Overlay
function EditTaskForm({ 
  task,
  onClose, 
  onSave 
}: { 
  task: ScheduledTask;
  onClose: () => void;
  onSave: (taskId: string, task: Omit<ScheduledTask, 'id' | 'createdAt' | 'isActive'>) => void;
}) {
  return (
    <TaskForm
      mode="edit"
      initialTask={task}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

// Shared Task Form Component (for both Create and Edit)
function TaskForm({ 
  mode,
  initialTask,
  onClose, 
  onSave 
}: { 
  mode: 'create' | 'edit';
  initialTask?: ScheduledTask;
  onClose: () => void;
  onSave: (taskId: string, task: Omit<ScheduledTask, 'id' | 'createdAt' | 'isActive'>) => void;
}) {
  const [formData, setFormData] = useState({
    name: initialTask?.name || '',
    description: initialTask?.description || '',
    prompt: initialTask?.prompt || '',
    modelOrAgent: initialTask?.modelOrAgent || '',
    modelSelection: initialTask?.modelSelection || null as ModelSelection | null,
    agentId: initialTask?.agentId || '',
    folder: initialTask?.folder || '',
    frequency: initialTask?.frequency || 'manual' as Frequency,
    mode: initialTask?.mode || 'task' as 'agent' | 'task',
  });
  const [showFrequencyDropdown, setShowFrequencyDropdown] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  
  // Get agents from store
  const { agents, fetchAgents } = useAgentStore();
  
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);
  
  const isValid = formData.name.trim() && formData.description.trim() && formData.prompt.trim() &&
    (formData.mode === 'task' ? formData.modelSelection : formData.agentId);
  
  const handleSave = () => {
    if (!isValid) return;
    // Handled inline in onClick now
  };
  
  const handleModelSelect = (selection: ModelSelection) => {
    setFormData({ 
      ...formData, 
      modelSelection: selection,
      modelOrAgent: selection.modelName || selection.modelId 
    });
    setShowModelPicker(false);
  };
  
  const handleAgentSelect = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    setFormData({ 
      ...formData, 
      agentId,
      modelOrAgent: agent?.name || 'Unknown Agent'
    });
    setShowAgentPicker(false);
  };
  
  return (
    <OverlayContainer onClose={onClose}>
      <div style={{
        background: 'linear-gradient(180deg, rgba(37,33,31,0.98), rgba(26,23,22,0.98))',
        borderRadius: 20,
        border: '1px solid rgba(212,176,140,0.2)',
        width: '100%',
        maxWidth: 560,
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 24px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 600,
            color: '#f0c8aa',
          }}>
            {mode === 'create' ? 'Create Scheduled Task' : 'Edit Scheduled Task'}
          </h2>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: '#6b6b6b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Form */}
        <div style={{ padding: '24px' }}>
          {/* Mode Toggle */}
          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: '#9b9b9b',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Task Type
            </label>
            <div style={{
              display: 'flex',
              gap: 8,
            }}>
              <ModeButton
                active={formData.mode === 'task'}
                onClick={() => setFormData({ ...formData, mode: 'task', agentId: '', modelSelection: null })}
                icon={CheckSquare}
              >
                Task
              </ModeButton>
              <ModeButton
                active={formData.mode === 'agent'}
                onClick={() => setFormData({ ...formData, mode: 'agent', agentId: '', modelSelection: null })}
                icon={Bot}
              >
                Agent Task
              </ModeButton>
            </div>
          </div>
          
          {/* Name */}
          <FormField label="Name *" required>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter task name"
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                color: '#f0c8aa',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </FormField>
          
          {/* Description */}
          <FormField label="Description *" required>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of what this task does"
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                color: '#f0c8aa',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </FormField>
          
          {/* Prompt */}
          <FormField label="Prompt *" required>
            <textarea
              value={formData.prompt}
              onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
              placeholder="Detailed instructions for the task..."
              rows={5}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                color: '#f0c8aa',
                fontSize: 14,
                outline: 'none',
                resize: 'vertical',
                minHeight: 120,
              }}
            />
          </FormField>
          
          {/* Model Selection (for Task mode) */}
          {formData.mode === 'task' && (
            <FormField label="Model *" required>
              <button
                onClick={() => setShowModelPicker(true)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  color: formData.modelSelection ? '#f0c8aa' : '#6b6b6b',
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {formData.modelSelection ? (
                    <>
                      <Sparkles size={16} color="#d4b08c" />
                      {formData.modelSelection.modelName || formData.modelSelection.modelId}
                      <span style={{ color: '#6b6b6b', fontSize: 12 }}>
                        via {formData.modelSelection.providerId}
                      </span>
                    </>
                  ) : (
                    'Select model...'
                  )}
                </span>
                <ChevronDown size={16} />
              </button>
            </FormField>
          )}
          
          {/* Agent Selection (for Agent Task mode) */}
          {formData.mode === 'agent' && (
            <FormField label="Agent *" required>
              <button
                onClick={() => setShowAgentPicker(true)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  color: formData.agentId ? '#f0c8aa' : '#6b6b6b',
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {formData.agentId ? (
                    <>
                      <Bot size={16} color="#d4c5f9" />
                      {agents.find(a => a.id === formData.agentId)?.name || 'Unknown Agent'}
                    </>
                  ) : (
                    'Select agent...'
                  )}
                </span>
                <ChevronDown size={16} />
              </button>
              
              {/* Agent Picker Dropdown */}
              {showAgentPicker && (
                <>
                  <div
                    style={{
                      position: 'fixed',
                      inset: 0,
                      zIndex: 9998,
                    }}
                    onClick={() => setShowAgentPicker(false)}
                  />
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    marginTop: 4,
                    background: 'linear-gradient(180deg, rgba(37,33,31,0.98), rgba(26,23,22,0.98))',
                    borderRadius: 10,
                    border: '1px solid rgba(212,176,140,0.14)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                    zIndex: 9999,
                    overflow: 'hidden',
                    maxHeight: 300,
                    overflowY: 'auto',
                  }}>
                    {agents.length === 0 ? (
                      <div style={{
                        padding: '16px',
                        color: '#6b6b6b',
                        fontSize: 14,
                        textAlign: 'center',
                      }}>
                        No agents registered
                      </div>
                    ) : (
                      agents.map(agent => (
                        <button
                          key={agent.id}
                          onClick={() => handleAgentSelect(agent.id)}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: 'none',
                            background: formData.agentId === agent.id 
                              ? 'rgba(167,139,250,0.1)' 
                              : 'transparent',
                            color: formData.agentId === agent.id ? '#d4c5f9' : '#9b9b9b',
                            fontSize: 14,
                            cursor: 'pointer',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                          }}
                          onMouseEnter={(e) => {
                            if (formData.agentId !== agent.id) {
                              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (formData.agentId !== agent.id) {
                              e.currentTarget.style.background = 'transparent';
                            }
                          }}
                        >
                          <Bot size={18} color="#d4c5f9" />
                          <div>
                            <div style={{ fontWeight: 500 }}>{agent.name}</div>
                            {agent.description && (
                              <div style={{ fontSize: 12, color: '#6b6b6b', marginTop: 2 }}>
                                {agent.description}
                              </div>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </FormField>
          )}
          
          {/* Folder */}
          <FormField label="Folder to work in">
            <div style={{
              display: 'flex',
              gap: 8,
            }}>
              <input
                type="text"
                value={formData.folder}
                onChange={(e) => setFormData({ ...formData, folder: e.target.value })}
                placeholder="Select folder..."
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  color: '#f0c8aa',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              <button
                onClick={() => {
                  setFormData({ ...formData, folder: '/workspace/tasks' });
                }}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  color: '#d4b08c',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <FolderOpen size={18} />
                Browse
              </button>
            </div>
          </FormField>
          
          {/* Frequency */}
          <FormField label="Frequency">
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowFrequencyDropdown(!showFrequencyDropdown)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  color: '#f0c8aa',
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                {FREQUENCY_OPTIONS.find(o => o.value === formData.frequency)?.label}
                <ChevronDown size={16} />
              </button>
              
              {showFrequencyDropdown && (
                <>
                  <div
                    style={{
                      position: 'fixed',
                      inset: 0,
                      zIndex: 9998,
                    }}
                    onClick={() => setShowFrequencyDropdown(false)}
                  />
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 4,
                    background: 'linear-gradient(180deg, rgba(37,33,31,0.98), rgba(26,23,22,0.98))',
                    borderRadius: 10,
                    border: '1px solid rgba(212,176,140,0.14)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                    zIndex: 9999,
                    overflow: 'hidden',
                  }}>
                    {FREQUENCY_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFormData({ ...formData, frequency: option.value });
                          setShowFrequencyDropdown(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: 'none',
                          background: formData.frequency === option.value 
                            ? 'rgba(212,176,140,0.1)' 
                            : 'transparent',
                          color: formData.frequency === option.value ? '#f0c8aa' : '#9b9b9b',
                          fontSize: 14,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </FormField>
        </div>
        
        {/* Footer */}
        <div style={{
          padding: '16px 24px 24px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          gap: 12,
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '12px 20px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: '#9b9b9b',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (mode === 'edit' && initialTask) {
                onSave(initialTask.id, {
                  name: formData.name,
                  description: formData.description,
                  prompt: formData.prompt,
                  modelOrAgent: formData.mode === 'task' 
                    ? (formData.modelSelection?.modelName || 'Default Model')
                    : (agents.find(a => a.id === formData.agentId)?.name || 'Unknown Agent'),
                  modelSelection: formData.modelSelection || undefined,
                  agentId: formData.agentId || undefined,
                  folder: formData.folder,
                  frequency: formData.frequency,
                  mode: formData.mode,
                });
              } else {
                onSave('', {
                  name: formData.name,
                  description: formData.description,
                  prompt: formData.prompt,
                  modelOrAgent: formData.mode === 'task' 
                    ? (formData.modelSelection?.modelName || 'Default Model')
                    : (agents.find(a => a.id === formData.agentId)?.name || 'Unknown Agent'),
                  modelSelection: formData.modelSelection || undefined,
                  agentId: formData.agentId || undefined,
                  folder: formData.folder,
                  frequency: formData.frequency,
                  mode: formData.mode,
                });
              }
            }}
            disabled={!isValid}
            style={{
              padding: '12px 24px',
              borderRadius: 10,
              border: 'none',
              background: isValid 
                ? 'linear-gradient(135deg, rgba(217,119,87,0.9) 0%, rgba(212,176,140,0.8) 100%)' 
                : 'rgba(255,255,255,0.1)',
              color: isValid ? '#fff' : '#6b6b6b',
              fontSize: 14,
              fontWeight: 600,
              cursor: isValid ? 'pointer' : 'not-allowed',
            }}
          >
            {mode === 'create' ? 'Save Task' : 'Update Task'}
          </button>
        </div>
      </div>
      
      {/* Model Picker Dialog */}
      {showModelPicker && (
        <ModelPicker
          open={showModelPicker}
          onOpenChange={setShowModelPicker}
          onSelect={handleModelSelect}
          onCancel={() => setShowModelPicker(false)}
        />
      )}
    </OverlayContainer>
  );
}

// Task Detail Overlay
function TaskDetailOverlay({ 
  task, 
  onClose, 
  onUpdate, 
  onDelete,
  onRunNow,
  onEdit,
  isRunning = false
}: { 
  task: ScheduledTask;
  onClose: () => void;
  onUpdate: (updates: Partial<ScheduledTask>) => void;
  onDelete: () => void;
  onRunNow: () => void;
  onEdit: () => void;
  isRunning?: boolean;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { agents } = useAgentStore();
  
  const getFrequencyLabel = (freq: Frequency) => {
    return FREQUENCY_OPTIONS.find(o => o.value === freq)?.label || freq;
  };
  
  // Get display info for model/agent
  const getExecutorInfo = () => {
    if (task.mode === 'agent' && task.agentId) {
      const agent = agents.find(a => a.id === task.agentId);
      return { type: 'Agent', name: agent?.name || 'Unknown Agent', icon: Bot };
    }
    return { 
      type: 'Model', 
      name: task.modelSelection?.modelName || task.modelOrAgent || 'Default Model',
      icon: Sparkles 
    };
  };
  
  const executorInfo = getExecutorInfo();
  
  return (
    <OverlayContainer onClose={onClose}>
      <div style={{
        background: 'linear-gradient(180deg, rgba(37,33,31,0.98), rgba(26,23,22,0.98))',
        borderRadius: 20,
        border: '1px solid rgba(212,176,140,0.2)',
        width: '100%',
        maxWidth: 480,
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 24px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}>
            <div>
              <h2 style={{
                margin: '0 0 8px 0',
                fontSize: 22,
                fontWeight: 600,
                color: '#f0c8aa',
              }}>
                {task.name}
              </h2>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  background: task.isActive ? 'rgba(34,197,94,0.1)' : 'rgba(107,107,107,0.1)',
                  color: task.isActive ? '#22c55e' : '#6b6b6b',
                  fontSize: 11,
                  fontWeight: 600,
                }}>
                  {task.isActive ? 'Active' : 'Inactive'}
                </span>
                {task.isActive && task.nextRun && (
                  <span style={{
                    fontSize: 12,
                    color: '#6b6b6b',
                  }}>
                    Next run: {new Date(task.nextRun).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            
            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: '#6b6b6b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: 8,
          }}>
            <ActionButton onClick={onEdit} icon={Pencil}>
              Edit
            </ActionButton>
            <ActionButton onClick={() => setShowDeleteConfirm(true)} icon={Trash2} variant="danger">
              Delete
            </ActionButton>
            <ActionButton onClick={onRunNow} icon={isRunning ? Loader2 : Play} variant="primary" isLoading={isRunning}>
              {isRunning ? 'Running...' : 'Run Now'}
            </ActionButton>
          </div>
        </div>
        
        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Toggle Active */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 12,
            marginBottom: 24,
          }}>
            <span style={{
              fontSize: 14,
              fontWeight: 500,
              color: '#9b9b9b',
            }}>
              {task.isActive ? 'Active' : 'Inactive'}
            </span>
            <ToggleSwitch 
              checked={task.isActive} 
              onChange={(checked) => onUpdate({ isActive: checked })}
            />
          </div>
          
          {/* Details */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            paddingTop: 24,
          }}>
            <DetailItem label="Description" value={task.description} />
            <DetailItem label="Instructions" value={task.prompt} />
            <DetailItem 
              label={executorInfo.type} 
              value={executorInfo.name}
              icon={executorInfo.icon}
            />
            <DetailItem label="Working Folder" value={task.folder || 'Not set'} />
            <DetailItem label="Frequency" value={getFrequencyLabel(task.frequency)} />
            {task.lastRun && (
              <DetailItem label="Last Run" value={new Date(task.lastRun).toLocaleString()} />
            )}
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <DeleteConfirmDialog
          title="Delete Scheduled Task?"
          message={`Are you sure you want to delete "${task.name}"? This action cannot be undone.`}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={() => {
            onDelete();
            setShowDeleteConfirm(false);
          }}
        />
      )}
    </OverlayContainer>
  );
}

// Helper Components

function OverlayContainer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          zIndex: 10000,
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10001,
          width: '90%',
          maxWidth: 560,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  );
}

function FormField({ 
  label, 
  children, 
  required 
}: { 
  label: string; 
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{
        display: 'block',
        fontSize: 12,
        fontWeight: 600,
        color: required ? '#d4b08c' : '#9b9b9b',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {label}
        {required && <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function ModeButton({ 
  active, 
  onClick, 
  icon: Icon, 
  children 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '12px 16px',
        borderRadius: 10,
        border: `1px solid ${active ? 'rgba(212,176,140,0.3)' : 'rgba(255,255,255,0.1)'}`,
        background: active ? 'rgba(212,176,140,0.1)' : 'transparent',
        color: active ? '#f0c8aa' : '#6b6b6b',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <Icon size={18} />
      {children}
    </button>
  );
}

function ActionButton({ 
  onClick, 
  icon: Icon, 
  children, 
  variant = 'default',
  isLoading = false
}: { 
  onClick: () => void; 
  icon: React.ElementType; 
  children: React.ReactNode;
  variant?: 'default' | 'danger' | 'primary';
  isLoading?: boolean;
}) {
  const colors = {
    default: { bg: 'rgba(255,255,255,0.05)', color: '#9b9b9b' },
    danger: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
    primary: { bg: 'rgba(217,119,87,0.2)', color: '#d4b08c' },
  };
  
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      style={{
        flex: 1,
        padding: '10px 16px',
        borderRadius: 10,
        border: 'none',
        background: isLoading ? 'rgba(107,107,107,0.1)' : colors[variant].bg,
        color: isLoading ? '#6b6b6b' : colors[variant].color,
        fontSize: 13,
        fontWeight: 600,
        cursor: isLoading ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {isLoading ? (
        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
      ) : (
        <Icon size={16} />
      )}
      {children}
    </button>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 48,
        height: 26,
        borderRadius: 13,
        border: 'none',
        background: checked ? 'rgba(34,197,94,0.3)' : 'rgba(107,107,107,0.3)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
      }}
    >
      <div style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: checked ? '#22c55e' : '#6b6b6b',
        position: 'absolute',
        top: 3,
        left: checked ? 25 : 3,
        transition: 'left 0.2s',
      }} />
    </button>
  );
}

function DetailItem({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: '#6b6b6b',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 14,
        color: '#9b9b9b',
        lineHeight: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        {Icon && <Icon size={14} />}
        {value}
      </div>
    </div>
  );
}

function EmptyState({ 
  icon: Icon, 
  title, 
  description
}: { 
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div style={{
      padding: '80px 20px',
      textAlign: 'center',
      color: '#6b6b6b',
    }}>
      <Icon size={64} style={{ opacity: 0.3, marginBottom: 24 }} />
      <h3 style={{ 
        fontSize: 18, 
        fontWeight: 600, 
        color: '#9b9b9b',
        margin: '0 0 8px 0' 
      }}>
        {title}
      </h3>
      <p style={{ fontSize: 14, margin: 0 }}>{description}</p>
    </div>
  );
}

function DeleteConfirmDialog({ 
  title, 
  message, 
  onCancel, 
  onConfirm 
}: { 
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 10002,
        }}
        onClick={onCancel}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'linear-gradient(180deg, rgba(37,33,31,0.98), rgba(26,23,22,0.98))',
          borderRadius: 16,
          border: '1px solid rgba(212,176,140,0.2)',
          padding: '24px',
          minWidth: 320,
          zIndex: 10003,
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        }}
      >
        <h3 style={{ 
          margin: '0 0 12px 0', 
          fontSize: 16, 
          fontWeight: 700, 
          color: '#f0c8aa' 
        }}>
          {title}
        </h3>
        <p style={{ 
          margin: '0 0 20px 0', 
          fontSize: 13, 
          color: '#9b9b9b',
          lineHeight: 1.5 
        }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: '#9b9b9b',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, rgba(239,68,68,0.8) 0%, rgba(220,38,38,0.8) 100%)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </>
  );
}


// Agent Heartbeats Tab Component
interface AgentHeartbeatsTabProps {
  selectedAgent: string | null;
  onSelectAgent: (agentId: string | null) => void;
}

function AgentHeartbeatsTab({ selectedAgent, onSelectAgent }: AgentHeartbeatsTabProps) {
  const { agents, fetchAgents } = useAgentStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents().then(() => setLoading(false));
  }, [fetchAgents]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#6b6b6b',
      }}>
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginRight: 12 }} />
        Loading agents...
      </div>
    );
  }

  // If an agent is selected, show the HeartbeatScheduler
  if (selectedAgent) {
    const agent = agents.find(a => a.id === selectedAgent);
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Agent header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          padding: '12px 16px',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(167,139,250,0.2) 0%, rgba(167,139,250,0.1) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Bot size={18} color="#d4c5f9" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f0c8aa' }}>
                {agent?.name || 'Unknown Agent'}
              </div>
              <div style={{ fontSize: 12, color: '#6b6b6b' }}>
                Managing heartbeat tasks
              </div>
            </div>
          </div>
          <button
            onClick={() => onSelectAgent(null)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: '#9b9b9b',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <X size={16} />
            Change Agent
          </button>
        </div>

        {/* Heartbeat Scheduler */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <HeartbeatScheduler 
            agentId={selectedAgent} 
            onClose={() => onSelectAgent(null)}
            theme={{
              bg: '#1a1716',
              bgCard: 'rgba(255,255,255,0.03)',
              textPrimary: '#f0c8aa',
              textSecondary: '#9b9b9b',
              textMuted: '#6b6b6b',
              accent: '#d4b08c',
              borderSubtle: 'rgba(255,255,255,0.06)',
            }}
          />
        </div>
      </div>
    );
  }

  // No agent selected - show agent list
  if (agents.length === 0) {
    return (
      <EmptyState 
        icon={Bot}
        title="No agents available"
        description="Create an agent first to configure heartbeat tasks."
      />
    );
  }

  return (
    <div>
      <div style={{
        marginBottom: 20,
        padding: '16px 20px',
        background: 'linear-gradient(135deg, rgba(167,139,250,0.08) 0%, rgba(212,176,140,0.08) 100%)',
        borderRadius: 12,
        border: '1px solid rgba(212,176,140,0.1)',
      }}>
        <h3 style={{
          margin: '0 0 8px 0',
          fontSize: 16,
          fontWeight: 600,
          color: '#f0c8aa',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <Clock size={18} />
          Agent Heartbeat Tasks
        </h3>
        <p style={{
          margin: 0,
          fontSize: 13,
          color: '#9b9b9b',
          lineHeight: 1.5,
        }}>
          Configure periodic tasks that agents execute automatically. Heartbeat tasks are stored in each agent's workspace and synced with the scheduler.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 16,
      }}>
        {agents.map(agent => (
          <div
            key={agent.id}
            onClick={() => onSelectAgent(agent.id)}
            style={{
              padding: 20,
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              e.currentTarget.style.borderColor = 'rgba(212,176,140,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
            }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: agent.status === 'running' 
                  ? 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.05) 100%)'
                  : 'linear-gradient(135deg, rgba(167,139,250,0.15) 0%, rgba(167,139,250,0.05) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Bot size={22} color={agent.status === 'running' ? '#22c55e' : '#d4c5f9'} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 4,
                }}>
                  <span style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: '#f0c8aa',
                  }}>
                    {agent.name}
                  </span>
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: agent.status === 'running' ? '#22c55e' : '#6b6b6b',
                  }} />
                </div>
                <p style={{
                  margin: '0 0 12px 0',
                  fontSize: 13,
                  color: '#6b6b6b',
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {agent.description || 'No description'}
                </p>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <span style={{
                    fontSize: 11,
                    color: '#9b9b9b',
                    padding: '4px 10px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: 6,
                  }}>
                    {agent.type}
                  </span>
                  <span style={{
                    fontSize: 11,
                    color: '#d4b08c',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    <Clock size={12} />
                    Configure Heartbeats
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
