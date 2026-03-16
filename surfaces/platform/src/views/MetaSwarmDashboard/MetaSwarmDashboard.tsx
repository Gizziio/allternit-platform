/**
 * Meta-Swarm Dashboard
 * 
 * Main dashboard component integrating all meta-swarm visualizations:
 * - Agent Status Panel
 * - Progress Visualization
 * - Cost Tracker
 * - File Conflict Panel
 * - Knowledge Panel
 * 
 * Provides real-time monitoring of all three swarm modes:
 * - SwarmAgentic (Auto-Architect)
 * - Claude Swarm (Parallel Execution)
 * - ClosedLoop (5-Step Methodology)
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Cpu,
  GitBranch,
  DollarSign,
  FileLock,
  BookOpen,
  Play,
  Plus,
  RefreshCw,
  Activity,
} from 'lucide-react';

import { AgentStatusPanel } from './components/AgentStatusPanel';
import { ProgressPanel } from './components/ProgressPanel';
import { CostTracker } from './components/CostTracker';
import { FileConflictPanel } from './components/FileConflictPanel';
import { KnowledgePanel } from './components/KnowledgePanel';

import type { Task, Session, RoutingDecision } from './types';
import { metaSwarmClient } from './api';

export function MetaSwarmDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeMode, setActiveMode] = useState<string>('all');

  useEffect(() => {
    // Fetch initial data
    Promise.all([
      metaSwarmClient.getTasks(),
      metaSwarmClient.getSessions(),
    ]).then(([tasksData, sessionsData]) => {
      setTasks(tasksData);
      setSessions(sessionsData);
    });

    // Set up polling for updates
    const interval = setInterval(() => {
      metaSwarmClient.getTasks().then(setTasks);
      metaSwarmClient.getSessions().then(setSessions);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleSubmitTask = async () => {
    if (!newTaskDescription.trim()) return;

    setSubmitting(true);
    try {
      const task = await metaSwarmClient.submitTask(newTaskDescription);
      setTasks((prev) => [...prev, task]);
      setNewTaskDescription('');
    } catch (err) {
      console.error('Failed to submit task:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const activeTasks = tasks.filter((t) => t.status === 'in_progress');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const failedTasks = tasks.filter((t) => t.status === 'failed');

  const activeSessions = sessions.filter((s) => !s.completed_at);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Activity className="h-8 w-8 text-blue-500" />
              Meta-Swarm Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Multi-agent orchestration with SwarmAgentic, Claude Swarm, and ClosedLoop
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              <Cpu className="h-3 w-3 mr-1" />
              {activeSessions.length} Active Sessions
            </Badge>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600">{activeTasks.length}</div>
              <p className="text-xs text-muted-foreground">Running Tasks</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{completedTasks.length}</div>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">{failedTasks.length}</div>
              <p className="text-xs text-muted-foreground">Failed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{tasks.length}</div>
              <p className="text-xs text-muted-foreground">Total Tasks</p>
            </CardContent>
          </Card>
        </div>

        {/* Submit New Task */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <Input
                placeholder="Describe your task (e.g., 'Refactor auth module to use JWT')..."
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitTask()}
                className="flex-1"
              />
              <Button
                onClick={handleSubmitTask}
                disabled={submitting || !newTaskDescription.trim()}
              >
                {submitting ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Execute
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mode Selection Tabs */}
      <Tabs value={activeMode} onValueChange={setActiveMode} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All Views</TabsTrigger>
          <TabsTrigger value="agents">
            <Cpu className="h-4 w-4 mr-2" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="progress">
            <GitBranch className="h-4 w-4 mr-2" />
            Progress
          </TabsTrigger>
          <TabsTrigger value="costs">
            <DollarSign className="h-4 w-4 mr-2" />
            Costs
          </TabsTrigger>
          <TabsTrigger value="knowledge">
            <BookOpen className="h-4 w-4 mr-2" />
            Knowledge
          </TabsTrigger>
        </TabsList>

        {/* All Views - Grid Layout */}
        <TabsContent value="all" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <AgentStatusPanel />
            <ProgressPanel />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <CostTracker />
            <FileConflictPanel />
          </div>
          <KnowledgePanel />
        </TabsContent>

        {/* Agents View */}
        <TabsContent value="agents" className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <AgentStatusPanel className="col-span-2" />
            <Card>
              <CardHeader>
                <CardTitle>Agent Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>SwarmAgentic</span>
                    <Badge>Auto-Architect</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Claude Swarm</span>
                    <Badge variant="secondary">Parallel</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>ClosedLoop</span>
                    <Badge variant="outline">5-Step</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Progress View */}
        <TabsContent value="progress" className="space-y-4">
          <ProgressPanel />
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sessions.slice(0, 5).map((session) => (
                    <div
                      key={session.id.id}
                      className="flex items-center justify-between p-2 rounded bg-muted"
                    >
                      <div>
                        <div className="font-medium">{session.mode || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">
                          {session.current_phase || 'No phase'}
                        </div>
                      </div>
                      <Badge
                        variant={
                          session.status === 'completed'
                            ? 'default'
                            : session.status === 'failed'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {session.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Execution Modes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                    <span className="flex-1">SwarmAgentic (Discovery)</span>
                    <Badge variant="secondary">PSO</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground pl-5">
                    Auto-discovers optimal agent architectures
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="flex-1">Claude Swarm (Execution)</span>
                    <Badge variant="secondary">Parallel</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground pl-5">
                    Parallel execution with dependency graphs
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="flex-1">ClosedLoop (Production)</span>
                    <Badge variant="secondary">5-Step</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground pl-5">
                    Brainstorm → Plan → Work → Review → Compound
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Costs View */}
        <TabsContent value="costs" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <CostTracker />
            <FileConflictPanel />
          </div>
        </TabsContent>

        {/* Knowledge View */}
        <TabsContent value="knowledge" className="space-y-4">
          <KnowledgePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
