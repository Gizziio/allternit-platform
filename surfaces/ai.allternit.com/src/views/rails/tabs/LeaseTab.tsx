"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Key, 
  CircleNotch, 
  ArrowsClockwise,
  Robot,
  Warning,
  CheckCircle,
  Square
} from '@phosphor-icons/react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, StatCard } from "../components/RailsSharedUI";
import { cn } from "@/lib/utils";

interface ManagedLease {
  leaseId: string;
  wihId: string;
  dagId: string;
  nodeId: string;
  acquiredAt: number;
  expiresAt: number;
  keys: string[];
  renewalCount: number;
  status: 'active' | 'expiring' | 'expired' | 'released';
}

function useLeases() {
  const [leases] = useState<ManagedLease[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const fetchLeases = useCallback(async () => {
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 500));
    setIsLoading(false);
  }, []);
  
  const refreshLease = async (leaseId: string) => {
    console.debug(`Refreshing lease ${leaseId}`);
  };
  
  const releaseLease = async (leaseId: string) => {
    console.debug(`Releasing lease ${leaseId}`);
  };
  
  useEffect(() => {
    fetchLeases();
    const interval = setInterval(fetchLeases, 30000);
    return () => clearInterval(interval);
  }, [fetchLeases]);
  
  return { leases, isLoading, refreshLease, releaseLease };
}

function getLeaseStatus(lease: ManagedLease): { label: string; color: string; icon: any } {
  const now = Date.now();
  const timeRemaining = lease.expiresAt - now;
  
  if (timeRemaining < 0) return { label: 'Expired', color: 'red', icon: Warning };
  if (timeRemaining < 60000) return { label: 'Expiring', color: 'red', icon: Warning };
  return { label: 'Active', color: 'green', icon: CheckCircle };
}

function getLeaseProgress(lease: ManagedLease): number {
  const total = lease.expiresAt - lease.acquiredAt;
  const remaining = lease.expiresAt - Date.now();
  return Math.max(0, Math.min(100, (remaining / total) * 100));
}

function formatDuration(ms: number): string {
  if (ms < 0) return 'Expired';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function GlobalLeaseCenter({ agents, onSelectAgent }: any) {
  const { leases, isLoading } = useLeases();
  const activeCount = leases.filter((l: ManagedLease) => l.status === 'active').length;
  const expiringCount = leases.filter((l: ManagedLease) => l.status === 'expiring').length;
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Active Leases" value={activeCount} icon={Key} color="green" />
        <StatCard title="Expiring Soon" value={expiringCount} icon={Warning} color="red" />
        <StatCard title="Total Agents" value={agents.length} icon={Robot} color="purple" />
        <StatCard title="Renewals" value={leases.reduce((sum: number, l: ManagedLease) => sum + l.renewalCount, 0)} icon={ArrowsClockwise} color="blue" />
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lease Monitoring</CardTitle>
          <CardDescription>Active resource reservations across all agents</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <CircleNotch className="size-6  animate-spin text-primary" />
            </div>
          ) : leases.length === 0 ? (
            <EmptyState message="No active leases" icon={Key} />
          ) : (
            <div className="space-y-2">
              {leases.slice(0, 10).map((lease: ManagedLease) => {
                const status = getLeaseStatus(lease);
                return (
                  <div key={lease.leaseId} className="p-3 rounded-lg border border-solid border-muted hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <status.icon className={`size-4  ${status.color === 'green' ? 'text-green-500' : 'text-red-500'}`} />
                        <span className="font-medium text-sm font-mono">{lease.leaseId.slice(0, 16)}…</span>
                      </div>
                      <Badge variant={status.color === 'green' ? 'default' : 'destructive'}>
                        {status.label}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-muted font-mono">{lease.dagId} / {lease.nodeId}</span>
                      <span>•</span>
                      <span>{formatDuration(lease.expiresAt - Date.now())} remaining</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agents with Leases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {agents.map((agent: any) => (
              <div 
                key={agent.id} 
                className="flex items-center justify-between p-3 rounded-lg border border-solid border-muted hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => onSelectAgent(agent.id)}
              >
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-muted flex items-center justify-center">
                    <Robot size={18} />
                  </div>
                  <span className="font-semibold">{agent.name}</span>
                </div>
                <Badge variant="secondary">{leases.filter((l: ManagedLease) => l.dagId?.includes(agent.id)).length} leases</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AgentLeaseCenter({ agent, onBack }: any) {
  const { leases, isLoading, refreshLease, releaseLease } = useLeases();
  const agentLeases = leases.filter((l: ManagedLease) => l.dagId?.includes(agent.id));
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onBack}>← Back</Button>
        <span className="font-bold text-sm text-primary">{agent.name} — Resource Leases</span>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <CircleNotch className="size-6  animate-spin text-primary" />
        </div>
      ) : agentLeases.length === 0 ? (
        <EmptyState message="No active leases for this agent" icon={Key} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agentLeases.map((lease: ManagedLease) => {
            const status = getLeaseStatus(lease);
            const progress = getLeaseProgress(lease);
            return (
              <Card key={lease.leaseId} className="overflow-hidden border-solid">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-muted-foreground mb-1 uppercase">Lease ID</div>
                      <div className="font-mono text-[13px] font-bold truncate pr-4">{lease.leaseId}</div>
                    </div>
                    <Badge variant={status.color === 'green' ? 'default' : 'destructive'}>
                      {status.label}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      <span>Time Remaining</span>
                      <span className={status.color === 'red' ? 'text-red-500' : ''}>{formatDuration(lease.expiresAt - Date.now())}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden shadow-inner">
                      <div 
                        className={cn(
                          "h-full transition-all duration-500",
                          progress > 50 ? 'bg-green-500' : progress > 20 ? 'bg-yellow-500' : 'bg-red-500'
                        )}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Node Context</div>
                      <div className="text-xs font-mono truncate">{lease.nodeId}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Renewals</div>
                      <div className="text-xs">{lease.renewalCount} times</div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1 font-bold h-9" 
                      onClick={() => refreshLease(lease.leaseId)}
                    >
                      <ArrowsClockwise className="size-3.5  mr-1.5" weight="bold" /> Renew Lease
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1 font-bold h-9 text-red-500 border-red-500/30 hover:bg-red-500/10" 
                      onClick={() => releaseLease(lease.leaseId)}
                    >
                      <Square className="size-3.5  mr-1.5" weight="bold" /> Release
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
