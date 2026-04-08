"use client";

import { NodeCard } from './NodeCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  HardDrives,
  Plus,
  ArrowsClockwise,
  CircleNotch,
  Warning,
  Pulse as Activity,
  CheckCircle,
  XCircle,
  Cloud,
} from '@phosphor-icons/react';
import type { NodeRecord } from '../types';
import { isNodeConnected } from '../hooks/useNodes';

interface NodeListProps {
  nodes: NodeRecord[];
  connected: string[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onDelete: (nodeId: string) => void;
  onTerminal: (nodeId: string) => void;
  onAddNode: () => void;
  onDeployNew?: () => void;
}

export function NodeList({ 
  nodes, 
  connected, 
  loading, 
  error, 
  onRefresh, 
  onDelete, 
  onTerminal,
  onAddNode,
  onDeployNew,
}: NodeListProps) {
  const onlineCount = nodes.filter(n => isNodeConnected(n.id, connected)).length;
  const offlineCount = nodes.length - onlineCount;

  if (loading && nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <CircleNotch className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && nodes.length === 0) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <Warning size={20} />
            <p>Error loading nodes: {error}</p>
          </div>
          <Button onClick={onRefresh} variant="outline" className="mt-4">
            <ArrowsClockwise className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Nodes</h2>
          <p className="text-muted-foreground">
            Manage your connected compute nodes
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <ArrowsClockwise className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={onAddNode}>
            <Plus className="h-4 w-4 mr-2" />
            Add Node
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      {nodes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Nodes</CardTitle>
              <HardDrives className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{nodes.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Online</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{onlineCount}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Offline</CardTitle>
              <XCircle className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{offlineCount}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
              <Activity className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">-</div>
              <p className="text-xs text-muted-foreground">Coming soon</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Node list */}
      {nodes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <HardDrives className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No nodes connected</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
              Add compute nodes to run agents and workloads. You can deploy new cloud instances or connect existing machines.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              {onDeployNew && (
                <Button variant="outline" onClick={onDeployNew}>
                  <Cloud className="h-4 w-4 mr-2" />
                  Deploy Cloud Instance
                </Button>
              )}
              <Button onClick={onAddNode}>
                <Plus className="h-4 w-4 mr-2" />
                Connect Existing Node
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              isConnected={isNodeConnected(node.id, connected)}
              onDelete={onDelete}
              onTerminal={onTerminal}
            />
          ))}
        </div>
      )}
    </div>
  );
}
