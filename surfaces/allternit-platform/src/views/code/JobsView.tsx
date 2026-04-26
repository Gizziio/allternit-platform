"use client";

import React, { useState, useCallback } from 'react';

// Helper to safely parse JSON
function safeJSONParse<T>(text: string | null, defaultValue: T): T {
  if (!text) return defaultValue;
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    console.error('[JobsView] JSON parse error:', error);
    return defaultValue;
  }
}
interface Job {
  job_id: string;
  status: string;
  job_spec: string | null;
  node_id?: string;
  priority: number;
  created_at: string;
}

interface JobStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
}

interface CreateJobData {
  name: string;
  wih: {
    handler: string;
    version: string;
    task: {
      type: string;
      command: string;
      working_dir: string | null;
    };
    tools: unknown[];
  };
  resources: {
    cpu_cores: number;
    memory_gb: number;
    disk_gb: number;
    gpu: boolean;
  };
  priority: number;
  timeout_secs: number;
  node_id: string | null;
}

const useJobs = () => ({
  jobs: [] as Job[],
  stats: null as JobStats | null,
  loading: false,
  error: null as string | null,
  refresh: () => {},
  createJob: async (_data: CreateJobData) => ({ job_id: '' } as Job),
  cancelJob: async (_id: string) => {},
});

const useJob = (_id: string) => ({ job: null as Job | null, loading: false });
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Play,
  Square,
  ArrowsClockwise,
  Clock,
  CheckCircle,
  XCircle,
  Warning,
} from '@phosphor-icons/react';
import { useToast } from '@/hooks/use-toast';

export function JobsView() {
  const { jobs, stats, loading, error, refresh, createJob, cancelJob } = useJobs();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { addToast } = useToast();

  const handleRefresh = useCallback(() => {
    refresh();
    addToast({
      title: 'Refreshing',
      description: 'Job queue updated',
      type: 'info',
    });
  }, [refresh, addToast]);

  const getStatusIcon = (status: string): React.ReactNode => {
    switch (status) {
      case 'running':
        return <Play className="h-4 w-4 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'scheduled':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'cancelled':
        return <Warning className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock size={16} />;
    }
  };

  const getStatusBadgeVariant = (status: string): BadgeProps['variant'] => {
    switch (status) {
      case 'running':
        return 'default';
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'scheduled':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (loading && jobs.length === 0) {
    return (
      <div className="container mx-auto p-6 h-full flex items-center justify-center">
        <div className="text-center">
          <ArrowsClockwise className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading job queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Job Queue</h2>
          <p className="text-muted-foreground">
            Manage and monitor background jobs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <ArrowsClockwise className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Job
              </Button>
            </DialogTrigger>
            <CreateJobDialog onClose={() => setShowCreateDialog(false)} />
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-5 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Running</CardTitle>
              <Play className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.running}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.failed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
              <Warning className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.cancelled}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Jobs Table */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>Jobs</CardTitle>
          <CardDescription>
            {error ? (
              <span className="text-red-500">Error: {error}</span>
            ) : (
              `${jobs.length} jobs in queue`
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Job ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Node</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job: Job) => (
                <TableRow key={job.job_id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(job.status)}
                      <Badge variant={getStatusBadgeVariant(job.status)}>
                        {job.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{job.job_id}</TableCell>
                  <TableCell>
                    {safeJSONParse<{ name?: string }>(job.job_spec, { name: 'Unnamed Job' }).name || 'Unnamed Job'}
                  </TableCell>
                  <TableCell>{job.node_id || '-'}</TableCell>
                  <TableCell>{job.priority}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(job.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {job.status === 'running' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelJob(job.job_id)}
                      >
                        <Square size={16} />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {jobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No jobs in queue</p>
                    <p className="text-sm text-muted-foreground">
                      Create a new job to get started
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// Create Job Dialog Component
function CreateJobDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [nodeId, setNodeId] = useState('auto');
  const [priority, setPriority] = useState(0);
  const [loading, setLoading] = useState(false);
  const { createJob } = useJobs();
  const { addToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await createJob({
        name,
        wih: {
          handler: 'shell',
          version: '1.0',
          task: {
            type: 'shell',
            command,
            working_dir: null,
          },
          tools: [],
        },
        resources: {
          cpu_cores: 1,
          memory_gb: 1,
          disk_gb: 10,
          gpu: false,
        },
        priority,
        timeout_secs: 3600,
        node_id: nodeId === 'auto' ? null : nodeId,
      });

      if (result) {
        addToast({
          title: 'Job Created',
          description: `Job ${result.job_id} has been queued`,
          type: 'success',
        });
        onClose();
      }
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to create job',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Create New Job</DialogTitle>
          <DialogDescription>
            Submit a new job to the queue. Jobs are executed on available nodes.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Job Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Job"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="command">Shell Command</Label>
            <Textarea
              id="command"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="echo 'Hello World'"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="node">Target Node</Label>
            <Select value={nodeId} onValueChange={setNodeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select node" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (Best Available)</SelectItem>
                {/* Would populate from useNodes() hook */}
                <SelectItem value="node-1">node-1</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="priority">Priority</Label>
            <Input
              id="priority"
              type="number"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value))}
              min={0}
              max={100}
            />
            <p className="text-xs text-muted-foreground">
              Higher priority jobs are executed first
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Job'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export default JobsView;
