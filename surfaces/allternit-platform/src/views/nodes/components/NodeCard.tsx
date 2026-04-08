"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  HardDrives,
  Cpu,
  HardDrive,
  DotsThreeVertical,
  Trash,
  Terminal,
  Pulse as Activity,
  CheckCircle,
  XCircle,
  Clock,
  Warning,
} from '@phosphor-icons/react';
import type { NodeRecord, NodeStatus } from '../types';
import { statusColors, statusLabels } from '../types';

interface NodeCardProps {
  node: NodeRecord;
  isConnected: boolean;
  onDelete: (nodeId: string) => void;
  onTerminal: (nodeId: string) => void;
}

const statusIcons: Record<NodeStatus, React.ReactNode> = {
  online: <CheckCircle className="h-4 w-4 text-green-500" />,
  offline: <XCircle className="h-4 w-4 text-gray-400" />,
  busy: <Activity className="h-4 w-4 text-yellow-500" />,
  maintenance: <Clock className="h-4 w-4 text-blue-500" />,
  error: <Warning className="h-4 w-4 text-red-500" />,
};

export function NodeCard({ node, isConnected, onDelete, onTerminal }: NodeCardProps) {
  const formatMemory = (gb: number) => {
    if (gb >= 1024) {
      return `${(gb / 1024).toFixed(1)} TB`;
    }
    return `${gb} GB`;
  };

  const formatDisk = (gb: number) => {
    if (gb >= 1024) {
      return `${(gb / 1024).toFixed(1)} TB`;
    }
    return `${gb} GB`;
  };

  const formatLastSeen = (date?: string) => {
    if (!date) return 'Never';
    const lastSeen = new Date(date);
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastSeen.getTime()) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <Card className="relative overflow-hidden">
      {/* Status indicator bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusColors[node.status as NodeStatus]}`} />
      
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <HardDrives className="h-8 w-8 text-muted-foreground" />
              {/* Connection indicator */}
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                  isConnected ? 'bg-green-500' : 'bg-gray-400'
                }`}
              />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{node.hostname}</CardTitle>
              <CardDescription className="text-xs">{node.id}</CardDescription>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={isConnected ? "default" : "secondary"} className="text-xs">
              {statusIcons[node.status as NodeStatus]}
              <span className="ml-1">{statusLabels[node.status as NodeStatus]}</span>
            </Badge>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" size={32}>
                  <DotsThreeVertical size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onTerminal(node.id)} disabled={!isConnected}>
                  <Terminal className="mr-2 h-4 w-4" />
                  Open Terminal
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete(node.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Remove Node
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{node.cpu_cores} cores</span>
          </div>
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{formatMemory(node.memory_gb)}</span>
          </div>
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{formatDisk(node.disk_gb)}</span>
          </div>
        </div>
        
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {node.os} / {node.arch}
          </Badge>
          {node.docker_available && (
            <Badge variant="outline" className="text-xs bg-blue-50">
              Docker
            </Badge>
          )}
          {node.gpu_available && (
            <Badge variant="outline" className="text-xs bg-purple-50">
              GPU
            </Badge>
          )}
        </div>
        
        <div className="mt-3 text-xs text-muted-foreground">
          Last seen: {formatLastSeen(node.last_seen_at)} • Version: {node.version}
        </div>
      </CardContent>
    </Card>
  );
}
