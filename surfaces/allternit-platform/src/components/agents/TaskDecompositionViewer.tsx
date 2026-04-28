/**
 * Task Decomposition Viewer - AgentGPT-inspired
 *
 * Shows how goals are broken down into executable tasks.
 * Displays task hierarchy, dependencies, and execution status.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ListChecks,
  CheckCircle,
  Circle,
  Clock,
  Warning,
  CaretRight,
  CaretDown,
  GitBranch,
  Link,
  Play,
  Pause,
  SkipForward,
} from '@phosphor-icons/react';

// ============================================================================
// Types
// ============================================================================

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface DecomposedTask {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  dependencies: string[]; // Task IDs
  subtasks?: DecomposedTask[];
  agent?: {
    id: string;
    name: string;
    role: string;
  };
  estimatedDuration?: number; // ms
  actualDuration?: number; // ms
  progress?: number; // 0-100
  error?: string;
}

export interface TaskDecompositionViewerProps {
  tasks: DecomposedTask[];
  goalDescription?: string;
  isDecomposing?: boolean;
  onTaskClick?: (task: DecomposedTask) => void;
  onRunTask?: (taskId: string) => void;
  onSkipTask?: (taskId: string) => void;
}

// ============================================================================
// Task Item Component
// ============================================================================

function TaskItem({
  task,
  depth = 0,
  isExpanded,
  onToggle,
  onRun,
  onSkip,
}: {
  task: DecomposedTask;
  depth?: number;
  isExpanded: boolean;
  onToggle: () => void;
  onRun?: () => void;
  onSkip?: () => void;
}) {
  const statusConfig: Record<TaskStatus, { icon: any; color: string; label: string }> = {
    pending: { icon: Circle, color: 'var(--ui-text-muted)', label: 'Pending' },
    in_progress: { icon: Clock, color: 'var(--status-info)', label: 'In Progress' },
    completed: { icon: CheckCircle, color: 'var(--status-success)', label: 'Completed' },
    failed: { icon: Warning, color: 'var(--status-error)', label: 'Failed' },
    skipped: { icon: Circle, color: '#4b5563', label: 'Skipped' },
  };

  const StatusIcon = statusConfig[task.status].icon;
  const statusColor = statusConfig[task.status].color;

  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const hasDependencies = task.dependencies.length > 0;

  return (
    <div className="space-y-2">
      <motion.div
        layout
        className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
          task.status === 'in_progress'
            ? 'bg-blue-500/10 border-blue-500/30'
            : task.status === 'completed'
            ? 'bg-green-500/10 border-green-500/20'
            : task.status === 'failed'
            ? 'bg-red-500/10 border-red-500/20'
            : 'bg-white/5 border-white/5 hover:border-white/10'
        }`}
        style={{ marginLeft: depth * 16 }}
        onClick={onToggle}
      >
        {/* Expand/Collapse */}
        <button className="p-1 hover:bg-white/5 rounded transition-colors">
          {hasSubtasks ? (
            isExpanded ? (
              <CaretDown size={14} className="text-white/40" />
            ) : (
              <CaretRight size={14} className="text-white/40" />
            )
          ) : (
            <div className="w-3.5" />
          )}
        </button>

        {/* Status Icon */}
        <div
          className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
          style={{
            background: `${statusColor}22`,
            border: `1px solid ${statusColor}44`,
          }}
        >
          <StatusIcon size={14} style={{ color: statusColor }} />
        </div>

        {/* Task Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-white/90 truncate">
              {task.name}
            </span>
            {task.progress !== undefined && task.status === 'in_progress' && (
              <span className="text-xs text-blue-400">{task.progress}%</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-white/40">
            <span>{statusConfig[task.status].label}</span>
            {task.agent && (
              <span className="flex items-center gap-1">
                <GitBranch size={10} />
                {task.agent.name}
              </span>
            )}
            {task.estimatedDuration && (
              <span>~{Math.round(task.estimatedDuration / 1000)}s</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {task.status === 'pending' && onRun && (
            <button
              onClick={onRun}
              className="p-1.5 hover:bg-white/5 rounded transition-colors text-white/40 hover:text-green-400"
              title="Run task"
            >
              <Play size={14} />
            </button>
          )}
          {task.status === 'in_progress' && onSkip && (
            <button
              onClick={onSkip}
              className="p-1.5 hover:bg-white/5 rounded transition-colors text-white/40 hover:text-yellow-400"
              title="Skip task"
            >
              <SkipForward size={14} />
            </button>
          )}
        </div>
      </motion.div>

      {/* Subtasks */}
      <AnimatePresence>
        {isExpanded && hasSubtasks && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-2 overflow-hidden"
          >
            {task.subtasks!.map((subtask) => (
              <TaskItem
                key={subtask.id}
                task={subtask}
                depth={depth + 1}
                isExpanded={true}
                onToggle={() => {}}
                onRun={onRun}
                onSkip={onSkip}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dependencies */}
      {hasDependencies && !isExpanded && (
        <div
          className="flex items-center gap-1 text-xs text-white/30 ml-14"
          style={{ paddingLeft: depth * 16 }}
        >
          <Link size={10} />
          <span>{task.dependencies.length} dependencies</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Task Decomposition Viewer
// ============================================================================

export function TaskDecompositionViewer({
  tasks,
  goalDescription,
  isDecomposing = false,
  onTaskClick,
  onRunTask,
  onSkipTask,
}: TaskDecompositionViewerProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const toggleTask = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // Calculate progress
  const totalTasks = tasks.reduce((acc, task) => {
    const countSubtasks = (t: DecomposedTask): number => {
      let count = 1;
      if (t.subtasks) {
        count += t.subtasks.reduce((sum, st) => sum + countSubtasks(st), 0);
      }
      return count;
    };
    return acc + countSubtasks(task);
  }, 0);

  const completedTasks = tasks.reduce((acc, task) => {
    const countCompleted = (t: DecomposedTask): number => {
      let count = t.status === 'completed' ? 1 : 0;
      if (t.subtasks) {
        count += t.subtasks.reduce((sum, st) => sum + countCompleted(st), 0);
      }
      return count;
    };
    return acc + countCompleted(task);
  }, 0);

  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-purple-500/30">
            <ListChecks size={20} className="text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white/90">Task Breakdown</h3>
            <p className="text-xs text-white/40">
              {goalDescription || 'No goal defined'}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">Progress</span>
            <span className="text-white/60">
              {completedTasks}/{totalTasks} tasks ({progress}%)
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, #60a5fa 0%, #a78bfa 100%)`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-4">
        {isDecomposing ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mb-4">
              <Clock size={32} className="text-blue-400 animate-pulse" />
            </div>
            <p className="text-sm font-medium text-white/60 mb-1">
              Decomposing goal into tasks...
            </p>
            <p className="text-xs text-white/40">
              Analyzing requirements and creating execution plan
            </p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{
                background: 'var(--surface-hover)',
                border: '1px solid var(--ui-border-default)',
              }}
            >
              <ListChecks size={32} className="text-white/20" />
            </div>
            <p className="text-sm font-medium text-white/50 mb-1">
              No tasks yet
            </p>
            <p className="text-xs text-white/40">
              Define a goal to see the task breakdown
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                depth={0}
                isExpanded={expandedTasks.has(task.id)}
                onToggle={() => toggleTask(task.id)}
                onRun={() => onRunTask?.(task.id)}
                onSkip={() => onSkipTask?.(task.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {tasks.length > 0 && (
        <div className="p-4 border-t border-white/5 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-lg font-bold text-green-400">
              {tasks.filter((t) => t.status === 'completed').length}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-white/40">
              Completed
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-400">
              {tasks.filter((t) => t.status === 'in_progress').length}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-white/40">
              In Progress
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-400">
              {tasks.filter((t) => t.status === 'pending').length}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-white/40">
              Pending
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskDecompositionViewer;
