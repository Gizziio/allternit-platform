/**
 * OperatorBrowserView
 *
 * UI for Allternit Operator Browser Automation Control.
 * Provides interface for creating and monitoring browser automation tasks.
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { GlassSurface } from '@/design/GlassSurface';
import { GlassCard } from '@/design/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Globe,
  Play,
  Square,
  ArrowsClockwise,
  Pulse as Activity,
  CheckCircle,
  Warning,
  Clock,
  Terminal,
  Eye,
  Cursor,
  Keyboard,
  Camera,
  DownloadSimple,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { GATEWAY_URL } from '@/integration/api-client';

// ============================================================================
// Types
// ============================================================================

interface BrowserTask {
  id: string;
  url: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  actions: BrowserAction[];
  result?: BrowserTaskResult;
}

interface BrowserAction {
  type: 'navigate' | 'click' | 'type' | 'extract' | 'screenshot' | 'wait';
  selector?: string;
  value?: string;
  status?: 'pending' | 'completed' | 'failed';
}

interface BrowserTaskResult {
  success: boolean;
  data?: unknown;
  screenshot?: string;
  error?: string;
}

interface OperatorStatus {
  available: boolean;
  browserAvailable: boolean;
  activeTasks: number;
  lastHealthCheck?: string;
}

// ============================================================================
// Component
// ============================================================================

export function OperatorBrowserView() {
  const [operatorStatus, setOperatorStatus] = useState<OperatorStatus>({
    available: false,
    browserAvailable: false,
    activeTasks: 0,
  });
  const [tasks, setTasks] = useState<BrowserTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<BrowserTask | null>(null);
  const [url, setUrl] = useState('https://');
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check operator health on mount
  useEffect(() => {
    checkOperatorHealth();
    const interval = setInterval(checkOperatorHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const checkOperatorHealth = async () => {
    try {
      const response = await fetch(`${GATEWAY_URL}/api/v1/operator/browser/health`);
      if (response.ok) {
        const data = await response.json();
        setOperatorStatus({
          available: true,
          browserAvailable: data.browser_available ?? true,
          activeTasks: data.active_tasks ?? 0,
          lastHealthCheck: new Date().toISOString(),
        });
      } else {
        setOperatorStatus(prev => ({ ...prev, available: false }));
      }
    } catch (error) {
      console.error('Operator health check failed:', error);
      setOperatorStatus(prev => ({ ...prev, available: false }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!url.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch(`${GATEWAY_URL}/api/v1/operator/browser/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          actions: [
            { type: 'navigate', url },
            { type: 'screenshot' },
          ],
        }),
      });

      if (response.ok) {
        const task = await response.json();
        setTasks(prev => [task, ...prev]);
        setSelectedTask(task);
        setUrl('https://');
      } else {
        console.error('Failed to create task');
      }
    } catch (error) {
      console.error('Error creating task:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const refreshTask = async (taskId: string) => {
    try {
      const response = await fetch(`${GATEWAY_URL}/api/v1/operator/browser/tasks/${taskId}`);

      if (response.ok) {
        const updatedTask = await response.json();
        setTasks(prev =>
          prev.map(t => (t.id === taskId ? updatedTask : t))
        );
        if (selectedTask?.id === taskId) {
          setSelectedTask(updatedTask);
        }
      }
    } catch (error) {
      console.error('Error refreshing task:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'running':
        return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'failed':
        return <Warning className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'running':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    }
  };

  return (
    <GlassSurface className="h-full w-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6 text-[var(--accent-primary)]" />
          <div>
            <h2 className="text-lg font-semibold">Operator Browser Control</h2>
            <p className="text-sm text-[var(--text-tertiary)]">
              Browser automation and control
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              getStatusColor(operatorStatus.available ? 'completed' : 'failed')
            )}
          >
            {operatorStatus.available ? (
              <CheckCircle className="w-3 h-3 mr-1" />
            ) : (
              <Warning className="w-3 h-3 mr-1" />
            )}
            {operatorStatus.available ? 'Operator Online' : 'Operator Offline'}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={checkOperatorHealth}
            disabled={!operatorStatus.available}
          >
            <ArrowsClockwise size={16} />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Task Creation & List */}
        <div className="w-96 border-r border-[var(--border-subtle)] flex flex-col">
          {/* Create Task Form */}
          <div className="p-4 border-b border-[var(--border-subtle)] space-y-3">
            <div className="space-y-2">
              <Label htmlFor="url">Target URL</Label>
              <div className="flex gap-2">
                <Input
                  id="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
                />
                <Button
                  onClick={handleCreateTask}
                  disabled={isCreating || !operatorStatus.available}
                  size="icon"
                >
                  {isCreating ? (
                    <ArrowsClockwise className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play size={16} />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Task List */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-tertiary)] text-sm">
                  <Globe className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No browser tasks yet</p>
                  <p className="text-xs mt-1">
                    Enter a URL above to create a task
                  </p>
                </div>
              ) : (
                tasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => {
                      setSelectedTask(task);
                      handleRefreshTask(task.id);
                    }}
                    className={cn(
                      'w-full p-3 rounded-lg text-left transition-colors border',
                      selectedTask?.id === task.id
                        ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/30'
                        : 'bg-[var(--bg-secondary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/30'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate flex-1">
                        {task.url}
                      </span>
                      {getStatusIcon(task.status)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                      <Clock size={12} />
                      {new Date(task.createdAt).toLocaleTimeString()}
                      {task.status === 'completed' && task.completedAt && (
                        <>
                          <span>•</span>
                          <span>
                            {Math.round(
                              (new Date(task.completedAt).getTime() -
                                new Date(task.createdAt).getTime()) /
                                1000
                            )}
                            s
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Task Details */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedTask ? (
            <>
              {/* Task Header */}
              <div className="p-4 border-b border-[var(--border-subtle)]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Task Details</h3>
                  <Badge className={getStatusColor(selectedTask.status)}>
                    {getStatusIcon(selectedTask.status)}
                    <span className="ml-1 capitalize">{selectedTask.status}</span>
                  </Badge>
                </div>
                <div className="text-sm text-[var(--text-secondary)] break-all">
                  {selectedTask.url}
                </div>
                <div className="text-xs text-[var(--text-tertiary)] mt-1">
                  ID: {selectedTask.id}
                </div>
              </div>

              {/* Task Content */}
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {/* Actions */}
                  <GlassCard className="p-4">
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Terminal size={16} />
                      Actions
                    </h4>
                    <div className="space-y-2">
                      {selectedTask.actions.map((action, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-2 rounded bg-[var(--bg-secondary)]"
                        >
                          {action.type === 'navigate' && (
                            <Globe className="w-4 h-4 text-blue-400" />
                          )}
                          {action.type === 'click' && (
                            <Cursor className="w-4 h-4 text-green-400" />
                          )}
                          {action.type === 'type' && (
                            <Keyboard className="w-4 h-4 text-yellow-400" />
                          )}
                          {action.type === 'screenshot' && (
                            <Camera className="w-4 h-4 text-purple-400" />
                          )}
                          {action.type === 'extract' && (
                            <DownloadSimple className="w-4 h-4 text-cyan-400" />
                          )}
                          {action.type === 'wait' && (
                            <Clock className="w-4 h-4 text-gray-400" />
                          )}
                          <span className="text-sm capitalize">
                            {action.type}
                          </span>
                          {action.selector && (
                            <span className="text-xs text-[var(--text-tertiary)] ml-auto">
                              {action.selector}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </GlassCard>

                  {/* Result */}
                  {selectedTask.result && (
                    <GlassCard className="p-4">
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Eye size={16} />
                        Result
                      </h4>
                      <pre className="text-xs bg-[var(--bg-secondary)] p-3 rounded overflow-auto max-h-64">
                        {JSON.stringify(selectedTask.result, null, 2)}
                      </pre>
                    </GlassCard>
                  )}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--text-tertiary)]">
              <div className="text-center">
                <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a task to view details</p>
                <p className="text-xs mt-1">
                  Or create a new task from the left panel
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </GlassSurface>
  );
}

export default OperatorBrowserView;
