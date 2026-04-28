/**
 * Progress Panel
 * 
 * Visualizes swarm execution progress:
 * - Progress bars for overall completion
 * - DAG visualization for task dependencies
 * - Wave visualization for parallel execution
 * - Real-time updates via WebSocket
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  GitBranch,
  Stack,
  CheckCircle,
  Circle,
  XCircle,
  CircleNotch,
  Clock,
} from '@phosphor-icons/react';
import type { Task, ProgressUpdate, Session } from '../types';
import { metaSwarmClient } from '../api';

interface ProgressPanelProps {
  className?: string;
}

interface WaveVisualizationProps {
  waves: Array<{
    waveNumber: number;
    tasks: Array<{
      id: string;
      name: string;
      status: 'pending' | 'in_progress' | 'completed' | 'failed';
    }>;
  }>;
}

function WaveVisualization({ waves }: WaveVisualizationProps) {
  return (
    <div className="space-y-4">
      {waves.map((wave) => (
        <div key={wave.waveNumber} className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Stack className="h-4 w-4 text-blue-500" />
            <span className="font-medium">Wave {wave.waveNumber}</span>
            <Badge variant="secondary" className="ml-auto">
              {wave.tasks.filter((t) => t.status === 'completed').length} / {wave.tasks.length}
            </Badge>
          </div>
          <div className="flex gap-2 flex-wrap">
            {wave.tasks.map((task) => {
              const statusColors = {
                pending: 'bg-gray-200',
                in_progress: 'bg-blue-400 animate-pulse',
                completed: 'bg-green-500',
                failed: 'bg-red-500',
              };
              
              return (
                <div
                  key={task.id}
                  className={`w-8 h-8 rounded-full ${statusColors[task.status]} flex items-center justify-center text-white text-xs font-medium`}
                  title={task.name}
                >
                  {task.name.charAt(0)}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

interface DAGNodeProps {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  x: number;
  y: number;
}

interface DAGEdgeProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

function DAGVisualization({ 
  nodes, 
  edges 
}: { 
  nodes: DAGNodeProps[]; 
  edges: DAGEdgeProps[];
}) {
  return (
    <div className="relative h-96 border rounded-lg overflow-hidden bg-muted/30">
      <svg className="absolute inset-0 w-full h-full">
        {edges.map((edge, i) => (
          <line
            key={i}
            x1={edge.from.x}
            y1={edge.from.y}
            x2={edge.to.x}
            y2={edge.to.y}
            stroke="#94a3b8"
            strokeWidth="2"
            markerEnd="url(#arrowhead)"
          />
        ))}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
          </marker>
        </defs>
      </svg>
      
      {nodes.map((node) => {
        const statusColors = {
          pending: 'bg-gray-300',
          in_progress: 'bg-blue-500 animate-pulse',
          completed: 'bg-green-500',
          failed: 'bg-red-500',
        };
        
        const statusIcons = {
          pending: <Circle size={12} />,
          in_progress: <CircleNotch className="h-3 w-3 animate-spin" />,
          completed: <CheckCircle size={12} />,
          failed: <XCircle size={12} />,
        };
        
        return (
          <div
            key={node.id}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${statusColors[node.status]} text-white px-3 py-2 rounded-lg shadow-md text-sm font-medium flex items-center gap-2`}
            style={{ left: node.x, top: node.y }}
          >
            {statusIcons[node.status]}
            <span className="truncate max-w-[120px]">{node.name}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ProgressPanel({ className }: ProgressPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    // Fetch initial data
    Promise.all([
      metaSwarmClient.getTasks(),
      metaSwarmClient.getSessions(),
    ]).then(([tasksData, sessionsData]) => {
      setTasks(tasksData);
      setSessions(sessionsData);
    });

    // Subscribe to progress updates
    const handleProgress = (update: ProgressUpdate) => {
      setTasks((prev) =>
        prev.map((task) =>
          task.id.id === update.task_id.id
            ? { ...task, progress: update.progress, status: (update.progress as any).completed >= (update.progress as any).total ? 'completed' : 'in_progress' }
            : task
        )
      );
    };

    metaSwarmClient.onProgressUpdate(handleProgress);

    return () => {
      metaSwarmClient.removeHandler('progress', handleProgress);
    };
  }, []);

  const activeTasks = tasks.filter((t) => t.status === 'in_progress');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const failedTasks = tasks.filter((t) => t.status === 'failed');

  // Derive wave visualization from real tasks (group by status order)
  const waves: WaveVisualizationProps['waves'] = React.useMemo(() => {
    const statusOrder = ['completed', 'in_progress', 'pending', 'failed'] as const;
    return statusOrder
      .map((status, i) => ({
        waveNumber: i + 1,
        tasks: tasks
          .filter((t) => t.status === status)
          .map((t) => ({ id: t.id.id, name: t.description, status: t.status as 'pending' | 'in_progress' | 'completed' | 'failed' })),
      }))
      .filter((w) => w.tasks.length > 0);
  }, [tasks]);

  // Derive DAG nodes from real tasks
  const dagNodes: DAGNodeProps[] = React.useMemo(() =>
    tasks.map((t, i) => ({
      id: t.id.id,
      name: t.description,
      status: t.status as 'pending' | 'in_progress' | 'completed' | 'failed',
      x: 100 + i * 200,
      y: 50,
    })),
  [tasks]);

  const dagEdges: DAGEdgeProps[] = React.useMemo(() =>
    dagNodes.slice(0, -1).map((node, i) => ({
      from: { x: node.x + 80, y: node.y },
      to: { x: dagNodes[i + 1].x - 80, y: dagNodes[i + 1].y },
    })),
  [dagNodes]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch size={20} />
            Execution Progress
          </div>
          <div className="flex gap-2 text-sm font-normal">
            <Badge variant="default" className="bg-blue-500">
              {activeTasks.length} Running
            </Badge>
            <Badge variant="default" className="bg-green-500">
              {completedTasks.length} Done
            </Badge>
            {failedTasks.length > 0 && (
              <Badge variant="destructive">
                {failedTasks.length} Failed
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="waves">Waves</TabsTrigger>
            <TabsTrigger value="dag">DAG</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {tasks.map((task) => (
              <div key={task.id.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {task.status === 'in_progress' && (
                      <CircleNotch className="h-4 w-4 animate-spin text-blue-500" />
                    )}
                    {task.status === 'completed' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {task.status === 'failed' && (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    {task.status === 'pending' && (
                      <Clock className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="font-medium truncate max-w-md">
                      {task.description}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {((task.progress as any).completed / (task.progress as any).total * 100).toFixed(0)}%
                  </span>
                </div>
                <Progress value={((task.progress as any).completed / (task.progress as any).total * 100)} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {task.progress.completed} / {task.progress.total} completed
                  </span>
                  <span>${task.cost.estimated_usd.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="waves">
            <WaveVisualization waves={waves} />
          </TabsContent>

          <TabsContent value="dag">
            <DAGVisualization nodes={dagNodes} edges={dagEdges} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
