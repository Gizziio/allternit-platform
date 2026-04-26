/**
 * Agent Status Panel
 * 
 * Displays real-time status of all agents in the swarm
 * - Shows agent roles, status, and current tasks
 * - Displays agent statistics (tasks completed, success rate, costs)
 * - Color-coded status indicators
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Cpu,
  CheckCircle,
  XCircle,
  Clock,
  Pause,
  CurrencyDollar,
  TrendUp,
} from '@phosphor-icons/react';
import type { Agent, AgentStatus } from '../types';
import { metaSwarmClient } from '../api';

interface AgentStatusPanelProps {
  className?: string;
}

const statusConfig: Record<AgentStatus, { color: string; icon: React.ReactNode; label: string }> = {
  idle: { color: 'bg-gray-400', icon: <Pause size={12} />, label: 'Idle' },
  working: { color: 'bg-blue-500', icon: <Cpu className="h-3 w-3 animate-pulse" />, label: 'Working' },
  waiting: { color: 'bg-yellow-500', icon: <Clock size={12} />, label: 'Waiting' },
  completed: { color: 'bg-green-500', icon: <CheckCircle size={12} />, label: 'Completed' },
  failed: { color: 'bg-red-500', icon: <XCircle size={12} />, label: 'Failed' },
};

export function AgentStatusPanel({ className }: AgentStatusPanelProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch initial agents
    metaSwarmClient.getAgents().then((data) => {
      setAgents(data);
      setLoading(false);
    });

    // Subscribe to real-time updates
    const handleUpdate = (updatedAgents: Agent[]) => {
      setAgents(updatedAgents);
    };

    metaSwarmClient.onAgentStatusUpdate(handleUpdate);

    return () => {
      metaSwarmClient.removeHandler('agent_status', handleUpdate);
    };
  }, []);

  const activeAgents = agents.filter((a) => a.status === 'working').length;
  const idleAgents = agents.filter((a) => a.status === 'idle').length;
  const failedAgents = agents.filter((a) => a.status === 'failed').length;

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu size={20} />
            Agent Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu size={20} />
              Agent Status
            </div>
            <div className="flex gap-2 text-sm font-normal">
              <Badge variant="secondary">
                {activeAgents} Active
              </Badge>
              <Badge variant="outline">
                {idleAgents} Idle
              </Badge>
              {failedAgents > 0 && (
                <Badge variant="destructive">
                  {failedAgents} Failed
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {agents.map((agent) => {
              const status = statusConfig[agent.status];
              return (
                <Tooltip key={agent.id.id}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer">
                      <Avatar style={{ width: 40, height: 40 }}>
                        <AvatarFallback className={status.color}>
                          {agent.role.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {agent.role.name}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {status.icon}
                            <span className="ml-1">{status.label}</span>
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {agent.role.model}
                        </div>
                      </div>

                      <div className="text-right text-sm">
                        <div className="flex items-center gap-1 text-green-600">
                          <TrendUp size={12} />
                          <span>{(agent.stats.success_rate * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <CurrencyDollar size={12} />
                          <span>${agent.stats.total_cost.estimated_usd.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="w-64">
                    <div className="space-y-2">
                      <p className="font-medium">{agent.role.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {agent.role.description}
                      </p>
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span>Tasks Completed:</span>
                          <span className="font-medium">{agent.stats.tasks_completed}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tasks Failed:</span>
                          <span className="font-medium">{agent.stats.tasks_failed}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Success Rate:</span>
                          <span className="font-medium">{(agent.stats.success_rate * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Cost:</span>
                          <span className="font-medium">${agent.stats.total_cost.estimated_usd.toFixed(2)}</span>
                        </div>
                      </div>
                      {agent.capabilities.length > 0 && (
                        <div className="pt-1">
                          <p className="text-xs text-muted-foreground mb-1">Capabilities:</p>
                          <div className="flex flex-wrap gap-1">
                            {agent.capabilities.map((cap) => (
                              <Badge key={cap} variant="outline" className="text-xs">
                                {cap}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
