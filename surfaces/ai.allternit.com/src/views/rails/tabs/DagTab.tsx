"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  GitBranch, 
  CircleNotch, 
  CheckCircle,
  Robot,
  Warning,
  Circle,
  Key,
  Graph,
  ArrowCounterClockwise
} from '@phosphor-icons/react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, StatCard } from "../components/RailsSharedUI";

interface DagNode {
  id: string;
  type: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
  leaseId?: string;
  startedAt?: string;
  completedAt?: string;
  outputs?: string[];
}

interface DagInfo {
  dagId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  nodes: DagNode[];
  runId?: string;
}

function useDags() {
  const [dags] = useState<DagInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const fetchDags = useCallback(async () => {
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 500));
    setIsLoading(false);
  }, []);
  
  useEffect(() => {
    fetchDags();
    const interval = setInterval(fetchDags, 30000);
    return () => clearInterval(interval);
  }, [fetchDags]);
  
  return { dags, isLoading };
}

function getNodeStatusIcon(status: string) {
  switch (status) {
    case 'running': return <CircleNotch className="size-4  animate-spin text-blue-500" />;
    case 'completed': return <CheckCircle className="size-4  text-green-500" weight="fill" />;
    case 'failed': return <Warning className="size-4  text-red-500" weight="fill" />;
    case 'blocked': return <Circle className="size-4  text-zinc-400" />;
    default: return <Circle className="size-4  text-muted-foreground" />;
  }
}

function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={`h-2 rounded-full bg-muted overflow-hidden ${className} shadow-inner`}>
      <div 
        className="h-full rounded-full bg-primary transition-all duration-300 shadow-[0_0_8px_var(--accent-primary)]"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function GlobalDagCenter({ agents, onSelectAgent }: any) {
  const { dags, isLoading } = useDags();
  const activeDags = dags.filter((d: DagInfo) => d.status === 'running');
  const completedDags = dags.filter((d: DagInfo) => d.status === 'completed');
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Active DAGs" value={activeDags.length} icon={GitBranch} color="green" />
        <StatCard title="Completed" value={completedDags.length} icon={CheckCircle} color="blue" />
        <StatCard title="Total Nodes" value={dags.reduce((sum: number, d: DagInfo) => sum + d.nodes.length, 0)} icon={Graph} color="purple" />
        <StatCard title="Failed Nodes" value={dags.reduce((sum: number, d: DagInfo) => sum + d.nodes.filter(n => n.status === 'failed').length, 0)} icon={Warning} color="red" />
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><GitBranch size={16} /> Active DAG Executions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <CircleNotch className="size-6  animate-spin text-primary" />
            </div>
          ) : activeDags.length === 0 ? (
            <EmptyState message="No active DAG executions" icon={GitBranch} />
          ) : (
            <div className="space-y-3">
              {activeDags.map((dag: DagInfo) => {
                const completedCount = dag.nodes.filter((n: DagNode) => n.status === 'completed').length;
                return (
                  <div key={dag.dagId} className="p-4 rounded-xl border border-solid border-muted hover:bg-muted/50 transition-all group">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <GitBranch className="size-5  text-primary group-hover:scale-110 transition-transform" />
                        <span className="font-bold text-sm truncate max-w-[200px]">{dag.dagId}</span>
                      </div>
                      <Badge variant="default" className="bg-green-600 text-white animate-pulse">RUNNING</Badge>
                    </div>
                    <Progress value={(completedCount / dag.nodes.length) * 100} />
                    <div className="mt-3 text-xs text-muted-foreground flex justify-between items-center">
                      <span className="font-medium">{completedCount} / {dag.nodes.length} nodes completed</span>
                      <span className="font-mono opacity-60">Run: {dag.runId?.slice(0, 12)}…</span>
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
          <CardTitle className="text-base">Agents with DAGs</CardTitle>
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
                <Badge variant="secondary">{dags.filter((d: DagInfo) => d.dagId?.includes(agent.id)).length} DAGs</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AgentDagCenter({ agent, onBack }: any) {
  const { dags, isLoading } = useDags();
  const agentDags = dags.filter((d: DagInfo) => d.dagId?.includes(agent.id));
  const [selectedDagId, setSelectedDagId] = useState<string | null>(null);
  
  const selectedDag = agentDags.find((d: DagInfo) => d.dagId === selectedDagId);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBack}>← Back</Button>
          <span className="font-bold text-sm text-primary">{agent.name} — Visual DAGs</span>
        </div>
        {selectedDagId && (
          <Button size="sm" variant="ghost" onClick={() => setSelectedDagId(null)}>
            <ArrowCounterClockwise className="size-4  mr-2" /> Back to List
          </Button>
        )}
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <CircleNotch className="size-6  animate-spin text-primary" />
        </div>
      ) : agentDags.length === 0 ? (
        <EmptyState message="No DAGs for this agent" icon={GitBranch} />
      ) : selectedDag ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
          <Card className="bg-black/20 border-solid border-white/5">
            <CardHeader className="border-b border-solid border-white/5 bg-muted/10 px-4 py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold font-mono truncate">{selectedDag.dagId}</CardTitle>
                <Badge variant={selectedDag.status === 'running' ? 'default' : 'secondary'}>{selectedDag.status.toUpperCase()}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                {selectedDag.nodes.map((node: DagNode) => (
                  <div key={node.id} className="flex items-center gap-3 p-3 rounded-xl border border-solid border-muted bg-background/50 group hover:border-primary/30 transition-colors">
                    {getNodeStatusIcon(node.status)}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate group-hover:text-primary transition-colors">{node.id}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{node.type}</div>
                    </div>
                    {node.leaseId && (
                      <Badge variant="outline" className="text-[10px] font-mono border-blue-500/20 text-blue-400 bg-blue-500/5">
                        <Key className="size-3  mr-1" weight="fill" /> {node.leaseId.slice(0, 8)}
                      </Badge>
                    )}
                    <Badge variant={
                      node.status === 'completed' ? 'default' :
                      node.status === 'running' ? 'secondary' :
                      node.status === 'failed' ? 'destructive' : 'outline'
                    } className="text-[10px] h-5 min-w-[70px] justify-center">
                      {node.status.toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agentDags.map((dag: DagInfo) => {
            const completedCount = dag.nodes.filter((n: DagNode) => n.status === 'completed').length;
            return (
              <Card 
                key={dag.dagId} 
                className="cursor-pointer hover:border-primary/40 hover:bg-muted/30 transition-all group"
                onClick={() => setSelectedDagId(dag.dagId)}
              >
                <CardContent className="p-4 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <GitBranch className="size-5 " />
                      </div>
                      <span className="font-bold text-sm truncate max-w-[150px]">{dag.dagId}</span>
                    </div>
                    <Badge variant={
                      dag.status === 'running' ? 'default' :
                      dag.status === 'completed' ? 'secondary' : 'outline'
                    }>
                      {dag.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="mt-auto">
                    <Progress value={(completedCount / dag.nodes.length) * 100} />
                    <div className="mt-3 text-[11px] text-muted-foreground flex justify-between">
                      <span className="font-bold">{completedCount} / {dag.nodes.length} nodes</span>
                      <span className="font-mono">Run: {dag.runId?.slice(0, 8)}...</span>
                    </div>
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
