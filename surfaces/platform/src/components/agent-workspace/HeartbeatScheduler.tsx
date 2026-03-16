/**
 * Heartbeat Scheduler Component
 * 
 * Allows users to configure periodic tasks for agents via the HEARTBEAT.md
 * file in their workspace. Integrates with the existing CronJob system.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Plus,
  Trash2,
  Play,
  Pause,
  AlertCircle,
  CheckCircle,
  Calendar,
  Repeat,
  ChevronDown,
  ChevronRight,
  Settings,
  Save,
  RefreshCw,
  X,
} from 'lucide-react';
import { agentWorkspaceService } from '@/lib/agents/agent-workspace.service';
import {
  createScheduledJob,
  listScheduledJobs,
  runScheduledJobNow as runJobNow,
  type ScheduledJobConfig,
} from '@/lib/agents/scheduled-jobs.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface HeartbeatTask {
  id: string;
  name: string;
  schedule: string;
  description: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

interface HeartbeatSchedulerProps {
  agentId: string;
  onClose: () => void;
  theme?: {
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    bgCard: string;
    bg: string;
    borderSubtle: string;
  };
}

const STUDIO_THEME = {
  textPrimary: '#ECECEC',
  textSecondary: '#A0A0A0',
  textMuted: '#6B6B6B',
  accent: '#D4956A',
  bgCard: 'rgba(42, 33, 26, 0.6)',
  bg: '#0E0D0C',
  borderSubtle: 'rgba(255,255,255,0.08)',
};

// Parse HEARTBEAT.md content to extract tasks
function parseHeartbeatContent(content: string): HeartbeatTask[] {
  const tasks: HeartbeatTask[] = [];
  const lines = content.split('\n');
  let currentTask: Partial<HeartbeatTask> | null = null;
  let id = 0;

  for (const line of lines) {
    // Match schedule patterns like "### Daily (09:00)" or "### Hourly"
    const scheduleMatch = line.match(/^###\s+(\w+)(?:\s*\(([^)]+)\))?/i);
    if (scheduleMatch) {
      if (currentTask?.name) {
        tasks.push({ ...currentTask, id: String(id++), enabled: true } as HeartbeatTask);
      }
      currentTask = {
        name: scheduleMatch[1],
        schedule: scheduleMatch[2] || scheduleMatch[1].toLowerCase(),
        description: '',
      };
    } else if (currentTask && line.trim().startsWith('-')) {
      // Task items
      currentTask.description += line.trim().substring(1).trim() + '\n';
    }
  }

  if (currentTask?.name) {
    tasks.push({ ...currentTask, id: String(id++), enabled: true } as HeartbeatTask);
  }

  return tasks;
}

// Generate HEARTBEAT.md content from tasks
function generateHeartbeatContent(tasks: HeartbeatTask[]): string {
  const lines = [
    '# HEARTBEAT.md — Agent Periodic Tasks',
    '',
    '## Scheduled Tasks',
    '',
  ];

  for (const task of tasks) {
    const scheduleDisplay = task.schedule.includes(':') 
      ? `${task.name} (${task.schedule})`
      : task.name;
    lines.push(`### ${scheduleDisplay}`);
    lines.push('');
    for (const line of task.description.split('\n').filter(Boolean)) {
      lines.push(`- ${line}`);
    }
    lines.push('');
  }

  lines.push('## Task History');
  lines.push('');
  lines.push('*Tasks will be logged here when executed*');
  lines.push('');

  return lines.join('\n');
}

// Convert HeartbeatTask to ScheduledJobConfig
function taskToJobConfig(task: HeartbeatTask, agentId: string): Partial<ScheduledJobConfig> {
  // Parse schedule like "09:00" or "hourly" or "daily"
  let cronExpression = task.schedule;
  
  // Convert common schedules to cron
  if (task.schedule.toLowerCase() === 'hourly') {
    cronExpression = '0 * * * *';
  } else if (task.schedule.toLowerCase() === 'daily') {
    cronExpression = '0 9 * * *';
  } else if (task.schedule.toLowerCase() === 'weekly') {
    cronExpression = '0 9 * * 1';
  } else if (task.schedule.match(/^\d{1,2}:\d{2}$/)) {
    // Time like "09:00"
    const [hour, minute] = task.schedule.split(':');
    cronExpression = `${minute} ${hour} * * *`;
  }

  return {
    name: `Heartbeat: ${task.name}`,
    description: task.description,
    schedule: cronExpression,
    prompt: `Execute heartbeat task: ${task.name}\n\n${task.description}`,
    taskType: 'custom-task',
    parameters: { agentId, taskId: task.id, heartbeatTask: true },
    enabled: task.enabled,
    maxRetries: 3,
    timeout: 300,
    notifyOnSuccess: false,
    notifyOnFailure: true,
  };
}

export function HeartbeatScheduler({ agentId, onClose, theme = STUDIO_THEME }: HeartbeatSchedulerProps) {
  const [tasks, setTasks] = useState<HeartbeatTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [syncedJobs, setSyncedJobs] = useState<ScheduledJobConfig[]>([]);

  // Form state for new task
  const [newTask, setNewTask] = useState<Partial<HeartbeatTask>>({
    name: '',
    schedule: '09:00',
    description: '',
    enabled: true,
  });

  // Load HEARTBEAT.md content
  const loadHeartbeat = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const content = await agentWorkspaceService.readFile(agentId, '.a2r/governance/HEARTBEAT.md');
      const parsed = parseHeartbeatContent(content);
      setTasks(parsed);
    } catch (e) {
      // File doesn't exist yet, start with empty tasks
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  // Load synced cron jobs
  const loadSyncedJobs = useCallback(async () => {
    try {
      const jobs = await listScheduledJobs();
      const heartbeatJobs = jobs.filter(j => j.parameters?.heartbeatTask === true);
      setSyncedJobs(heartbeatJobs);
    } catch (e) {
      console.error('Failed to load synced jobs:', e);
    }
  }, []);

  useEffect(() => {
    loadHeartbeat();
    loadSyncedJobs();
  }, [loadHeartbeat, loadSyncedJobs]);

  // Save HEARTBEAT.md and sync with cron jobs
  const saveHeartbeat = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const content = generateHeartbeatContent(tasks);
      await agentWorkspaceService.writeFile(agentId, '.a2r/governance/HEARTBEAT.md', content);

      // Sync with scheduled jobs
      for (const task of tasks) {
        if (task.enabled) {
          const jobConfig = taskToJobConfig(task, agentId);
          await createScheduledJob(jobConfig as ScheduledJobConfig);
        }
      }

      await loadSyncedJobs();
    } catch (e) {
      setError('Failed to save heartbeat configuration');
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const addTask = () => {
    if (!newTask.name) return;
    const task: HeartbeatTask = {
      id: Date.now().toString(),
      name: newTask.name,
      schedule: newTask.schedule || '09:00',
      description: newTask.description || '',
      enabled: newTask.enabled ?? true,
    };
    setTasks([...tasks, task]);
    setNewTask({ name: '', schedule: '09:00', description: '', enabled: true });
    setShowAddForm(false);
  };

  const removeTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const updateTask = (id: string, updates: Partial<HeartbeatTask>) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const runTaskNow = async (task: HeartbeatTask) => {
    try {
      await runJobNow(task.id);
    } catch (e) {
      console.error('Failed to run task:', e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
      {/* Header - Responsive */}
      <div
        style={{
          padding: '16px',
          background: theme.bgCard,
          borderRadius: '8px',
          border: `1px solid ${theme.borderSubtle}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: '1 1 auto' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '8px',
              background: `${theme.accent}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Clock style={{ width: 20, height: 20, color: theme.accent }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: theme.textPrimary }}>
              Heartbeat Scheduler
            </span>
            <p style={{ fontSize: '13px', color: theme.textSecondary, margin: '2px 0 0 0' }}>
              {tasks.length} task{tasks.length !== 1 ? 's' : ''} configured • {syncedJobs.length} synced
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
          <button
            onClick={loadHeartbeat}
            disabled={isLoading}
            title="Refresh"
            style={{
              padding: '8px',
              borderRadius: '6px',
              background: 'transparent',
              border: `1px solid ${theme.borderSubtle}`,
              color: theme.textSecondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RefreshCw style={{ width: 16, height: 16, animation: isLoading ? 'spin 1s linear infinite' : undefined }} />
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            title="Add Task"
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              background: theme.accent,
              border: 'none',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            <Plus style={{ width: 14, height: 14 }} />
            <span>Add</span>
          </button>
          <button
            onClick={saveHeartbeat}
            disabled={isSaving}
            title="Save & Sync"
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              background: isSaving ? theme.textMuted : theme.accent,
              border: 'none',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 500,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            <Save style={{ width: 14, height: 14 }} />
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </button>
          <button
            onClick={onClose}
            title="Close"
            style={{
              padding: '8px',
              borderRadius: '6px',
              background: 'transparent',
              border: `1px solid ${theme.borderSubtle}`,
              color: theme.textSecondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle style={{ width: 16, height: 16, color: '#ef4444' }} />
          <span style={{ fontSize: '13px', color: '#ef4444' }}>{error}</span>
        </div>
      )}

      {/* Add Task Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              padding: '16px',
              background: theme.bgCard,
              borderRadius: '8px',
              border: `1px solid ${theme.borderSubtle}`,
            }}
          >
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: theme.textPrimary, margin: '0 0 16px 0' }}>
              New Heartbeat Task
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: theme.textMuted, marginBottom: '4px', display: 'block' }}>
                    Task Name
                  </label>
                  <Input
                    value={newTask.name}
                    onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                    placeholder="e.g., Daily Health Check"
                    style={{ background: theme.bg, border: `1px solid ${theme.borderSubtle}`, color: theme.textPrimary }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: theme.textMuted, marginBottom: '4px', display: 'block' }}>
                    Schedule
                  </label>
                  <Input
                    value={newTask.schedule}
                    onChange={(e) => setNewTask({ ...newTask, schedule: e.target.value })}
                    placeholder="09:00 or hourly"
                    style={{ background: theme.bg, border: `1px solid ${theme.borderSubtle}`, color: theme.textPrimary }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: theme.textMuted, marginBottom: '4px', display: 'block' }}>
                  Description / Actions
                </label>
                <Textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="What should the agent do?"
                  rows={3}
                  style={{ background: theme.bg, border: `1px solid ${theme.borderSubtle}`, color: theme.textPrimary }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Switch
                  checked={newTask.enabled}
                  onCheckedChange={(checked) => setNewTask({ ...newTask, enabled: checked })}
                />
                <span style={{ fontSize: '13px', color: theme.textSecondary }}>Enable this task</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={addTask} disabled={!newTask.name} style={{ background: theme.accent }}>
                  Add Task
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {tasks.length === 0 ? (
          <div
            style={{
              padding: '40px',
              textAlign: 'center',
              background: theme.bgCard,
              borderRadius: '8px',
              border: `1px dashed ${theme.borderSubtle}`,
            }}
          >
            <Clock style={{ width: 40, height: 40, color: theme.textMuted, margin: '0 auto 16px' }} />
            <p style={{ fontSize: '14px', color: theme.textSecondary, margin: '0 0 8px 0' }}>
              No heartbeat tasks configured
            </p>
            <p style={{ fontSize: '13px', color: theme.textMuted, margin: 0 }}>
              Add tasks to schedule periodic actions for your agent
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <motion.div
              key={task.id}
              layout
              style={{
                background: theme.bgCard,
                borderRadius: '8px',
                border: `1px solid ${theme.borderSubtle}`,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                }}
                onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
              >
                {expandedTask === task.id ? (
                  <ChevronDown style={{ width: 16, height: 16, color: theme.textMuted }} />
                ) : (
                  <ChevronRight style={{ width: 16, height: 16, color: theme.textMuted }} />
                )}
                
                <Switch
                  checked={task.enabled}
                  onCheckedChange={(checked) => updateTask(task.id, { enabled: checked })}
                  onClick={(e) => e.stopPropagation()}
                />
                
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: theme.textPrimary }}>
                      {task.name}
                    </span>
                    <Badge
                      variant={task.enabled ? 'default' : 'secondary'}
                      style={{
                        background: task.enabled ? `${theme.accent}20` : `${theme.textMuted}20`,
                        color: task.enabled ? theme.accent : theme.textMuted,
                        fontSize: '10px',
                      }}
                    >
                      {task.schedule}
                    </Badge>
                  </div>
                  {task.description && (
                    <p style={{ fontSize: '12px', color: theme.textSecondary, margin: '4px 0 0 0' }}>
                      {task.description.split('\n')[0]}
                      {task.description.split('\n').length > 1 && '...'}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      runTaskNow(task);
                    }}
                    style={{
                      padding: '6px',
                      borderRadius: '6px',
                      background: 'transparent',
                      border: `1px solid ${theme.borderSubtle}`,
                      color: theme.textSecondary,
                      cursor: 'pointer',
                    }}
                    title="Run now"
                  >
                    <Play style={{ width: 14, height: 14 }} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTask(task.id);
                    }}
                    style={{
                      padding: '6px',
                      borderRadius: '6px',
                      background: 'transparent',
                      border: `1px solid ${theme.borderSubtle}`,
                      color: theme.textSecondary,
                      cursor: 'pointer',
                    }}
                    title="Remove task"
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {expandedTask === task.id && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    style={{ borderTop: `1px solid ${theme.borderSubtle}` }}
                  >
                    <div style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div>
                            <label style={{ fontSize: '12px', color: theme.textMuted, marginBottom: '4px', display: 'block' }}>
                              Task Name
                            </label>
                            <Input
                              value={task.name}
                              onChange={(e) => updateTask(task.id, { name: e.target.value })}
                              style={{ background: theme.bg, border: `1px solid ${theme.borderSubtle}`, color: theme.textPrimary }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '12px', color: theme.textMuted, marginBottom: '4px', display: 'block' }}>
                              Schedule
                            </label>
                            <Input
                              value={task.schedule}
                              onChange={(e) => updateTask(task.id, { schedule: e.target.value })}
                              style={{ background: theme.bg, border: `1px solid ${theme.borderSubtle}`, color: theme.textPrimary }}
                            />
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: theme.textMuted, marginBottom: '4px', display: 'block' }}>
                            Description / Actions
                          </label>
                          <Textarea
                            value={task.description}
                            onChange={(e) => updateTask(task.id, { description: e.target.value })}
                            rows={4}
                            style={{ background: theme.bg, border: `1px solid ${theme.borderSubtle}`, color: theme.textPrimary }}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>

      {/* Info footer */}
      <div
        style={{
          padding: '12px 16px',
          background: `${theme.accent}10`,
          borderRadius: '8px',
          border: `1px solid ${theme.accent}30`,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <Settings style={{ width: 16, height: 16, color: theme.accent }} />
        <p style={{ fontSize: '12px', color: theme.textSecondary, margin: 0 }}>
          Heartbeat tasks are stored in <code style={{ background: theme.bg, padding: '2px 6px', borderRadius: '4px' }}>.a2r/governance/HEARTBEAT.md</code> and synced with the Cron scheduler.
        </p>
      </div>
    </div>
  );
}

export default HeartbeatScheduler;
