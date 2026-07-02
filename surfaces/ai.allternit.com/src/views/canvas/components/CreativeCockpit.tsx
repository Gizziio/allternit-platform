/**
 * CreativeCockpit.tsx
 * 
 * MoA (Mixture of Agents) progress indicator.
 * Shows parallel task execution status like Genspark's "Creative Cockpit".
 * 
 * Now connected to real MoA backend via SSE.
 */

import React, { useEffect, useReducer, useMemo, useState } from 'react';
import { m, AnimatePresence, LazyMotion, domAnimation } from 'framer-motion';
import {
  Cpu,
  CheckCircle,
  Circle,
  CircleNotch,
  Warning,
  Lightning,
  X,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MoAClient, type MoAProgressEvent } from '@/lib/api/moa-client';

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('CreativeCockpit');

interface MoATask {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'complete' | 'error' | 'skipped';
  progress?: number;
  title: string;
}

interface State {
  tasks: MoATask[];
  progress: number;
  status: 'queued' | 'running' | 'complete' | 'error';
}

type Action = 
  | { type: 'SET_INITIAL'; payload: { progress: number; status: State['status'] } }
  | { type: 'UPDATE_PROGRESS'; payload: MoAProgressEvent }
  | { type: 'RESET'; payload: MoATask[] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_INITIAL':
      return { ...state, ...action.payload };
    case 'UPDATE_PROGRESS':
      return {
        ...state,
        progress: action.payload.progress,
        status: action.payload.status as any,
        tasks: action.payload.tasks.map(t => ({
          id: t.id,
          type: t.id.split('-')[1] || 'unknown',
          status: t.status as any,
          progress: t.progress,
          title: t.id,
        }))
      };
    case 'RESET':
      return {
        tasks: action.payload,
        progress: 0,
        status: 'queued'
      };
    default:
      return state;
  }
}

interface CreativeCockpitProps {
  jobId?: string;
  tasks?: MoATask[];
  compact?: boolean;
  onClose?: () => void;
}

export function CreativeCockpit({ 
  jobId, 
  tasks: initialTasks = [], 
  compact = false,
  onClose 
}: CreativeCockpitProps) {
  const [state, dispatch] = useReducer(reducer, {
    tasks: initialTasks,
    progress: 0,
    status: 'queued'
  });

  // Reset pattern for derived state
  const [prevInitialTasks, setPrevInitialTasks] = useState(initialTasks);
  if (initialTasks !== prevInitialTasks) {
    dispatch({ type: 'RESET', payload: initialTasks });
    setPrevInitialTasks(initialTasks);
  }

  const { tasks, progress, status } = state;

  // Connect to SSE stream if jobId provided
  useEffect(() => {
    if (!jobId) return;

    let cleanup: (() => void) | undefined;
    let isCancelled = false;

    const connect = async () => {
      try {
        // Get initial status
        const job = await MoAClient.getJob(jobId);
        if (isCancelled) return;

        dispatch({ 
          type: 'SET_INITIAL', 
          payload: { progress: job.progress, status: job.status as any } 
        });

        // Connect to SSE stream
        cleanup = MoAClient.streamProgress(jobId, (event: MoAProgressEvent) => {
          if (!isCancelled) {
            dispatch({ type: 'UPDATE_PROGRESS', payload: event });
          }
        });
      } catch (error) {
        if (!isCancelled) {
          logger.error({ err: error }, 'Failed to connect to MoA stream:');
        }
      }
    };

    connect();

    return () => {
      isCancelled = true;
      if (cleanup) cleanup();
    };
  }, [jobId]);

  // Calculate overall progress
  const { totalTasks, completedTasks, runningTasks, pendingTasks } = useMemo(() => {
    return {
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'complete').length,
      runningTasks: tasks.filter(t => t.status === 'running').length,
      pendingTasks: tasks.filter(t => t.status === 'pending').length,
    };
  }, [tasks]);
  
  const overallProgress = totalTasks > 0 
    ? Math.round((completedTasks / totalTasks) * 100) 
    : progress;

  // Get status icon
  const getStatusIcon = (taskStatus: MoATask['status']) => {
    switch (taskStatus) {
      case 'complete':
        return <CheckCircle className="size-4  text-green-500" />;
      case 'running':
        return <CircleNotch className="size-4  text-orange-500 animate-spin" />;
      case 'error':
        return <Warning className="size-4  text-red-500" />;
      case 'pending':
      default:
        return <Circle className="size-4  text-[var(--text-tertiary)]" />;
    }
  };

  if (compact) {
    return (
      <div className="h-8 flex items-center gap-3 px-3 text-xs">
        <div className="flex items-center gap-2">
          <Cpu className="size-3  text-[var(--accent-primary)]" />
          <span className="font-medium text-[var(--text-secondary)]">
            {completedTasks}/{totalTasks} complete
          </span>
        </div>
        {runningTasks > 0 && (
          <div className="flex items-center gap-1">
            <CircleNotch className="size-3  text-orange-500 animate-spin" />
            <span className="text-[var(--text-tertiary)]">{runningTasks} running</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <LazyMotion features={domAnimation}>
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightning className="size-4  text-[var(--accent-primary)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">
              Creative Cockpit
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">
              {overallProgress}% complete
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-green-500">{completedTasks} done</span>
            <span className="text-[var(--border-subtle)]">•</span>
            <span className="text-orange-500">{runningTasks} running</span>
            <span className="text-[var(--border-subtle)]">•</span>
            <span className="text-[var(--text-tertiary)]">{pendingTasks} pending</span>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="size-6  p-0 text-[var(--text-tertiary)]"
            >
              <X size={12} />
            </Button>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden">
          <m.div
            className="h-full bg-gradient-to-r from-[var(--accent-primary)] to-green-500"
            initial={{ width: 0 }}
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Tasks */}
        <div className="space-y-2">
          <AnimatePresence>
            {tasks.map((task, index) => (
              <m.div
                key={task.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg",
                  "bg-[var(--bg-primary)] border border-[var(--border-subtle)]",
                  task.status === 'running' && "border-orange-500/30"
                )}
              >
                {/* Status icon */}
                <div className="flex-shrink-0">
                  {getStatusIcon(task.status)}
                </div>

                {/* Task info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-sm font-medium",
                      task.status === 'complete' && "text-[var(--text-secondary)]",
                      task.status === 'running' && "text-[var(--text-primary)]",
                      task.status === 'pending' && "text-[var(--text-tertiary)]"
                    )}>
                      {task.title}
                    </span>
                    {task.type && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-tertiary)] capitalize">
                        {task.type}
                      </span>
                    )}
                  </div>
                  
                  {/* Progress bar for running tasks */}
                  {task.status === 'running' && task.progress !== undefined && (
                    <div className="mt-1.5 h-1 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                      <m.div
                        className="h-full bg-orange-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${task.progress}%` }}
                        transition={{ duration: 0.2 }}
                      />
                    </div>
                  )}
                </div>

                {/* Status text */}
                <div className="flex-shrink-0 text-xs">
                  {task.status === 'complete' && (
                    <span className="text-green-500">Done</span>
                  )}
                  {task.status === 'running' && (
                    <span className="text-orange-500">
                      {task.progress !== undefined ? `${task.progress}%` : 'Running...'}
                    </span>
                  )}
                  {task.status === 'pending' && (
                    <span className="text-[var(--text-tertiary)]">Waiting</span>
                  )}
                  {task.status === 'error' && (
                    <span className="text-red-500">Error</span>
                  )}
                </div>
              </m.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </LazyMotion>
  );
}
