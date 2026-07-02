"use client";

import React, { useState } from "react";
import { 
  Lightning, 
  Play, 
  Square, 
  Plus, 
  Trash,
  ListChecks,
  Circle
} from '@phosphor-icons/react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatCard, EmptyState } from "../components/RailsSharedUI";
import type { Agent } from "@/lib/agents";

export function GlobalControlCenter({ agents, activeRuns, queue, allRuns, onSelectAgent }: any) {
  const orchestrators = agents.filter((a: Agent) => a.type === 'orchestrator');
  
  if (agents.length === 0) {
    return (
      <EmptyState 
        message="No Agents Yet" 
        description="Create your first agent to start using the Rails System."
        icon={Lightning}
        action={
          <Button onClick={() => window.location.href = '/agent?create=true'}>
            <Plus className="size-4  mr-2" />
            Create First Agent
          </Button>
        }
      />
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Active Runs" value={activeRuns.length} icon={Lightning} color="green" />
        <StatCard title="Queued" value={queue.length} icon={ListChecks} color="blue" />
        <StatCard title="Total Agents" value={agents.length} icon={Lightning} color="purple" />
        <StatCard title="Total Runs" value={allRuns.length} icon={ListChecks} color="gray" />
      </div>
      
      {orchestrators.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Orchestrators</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {orchestrators.map((orch: Agent) => (
                <Badge 
                  key={orch.id} 
                  variant="secondary" 
                  className="cursor-pointer px-3 py-1 hover:bg-muted"
                  onClick={() => onSelectAgent(orch.id)}
                >
                  <Lightning className="size-3  mr-1" />
                  {orch.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Active Executions</CardTitle></CardHeader>
        <CardContent>
          {activeRuns.length === 0 ? (
            <EmptyState message="No active runs" icon={Circle} />
          ) : (
            <div className="space-y-2">
              {activeRuns.map((run: any) => (
                <div 
                  key={run.id} 
                  className="p-3 rounded-lg border border-solid border-muted hover:bg-muted/50 cursor-pointer transition-colors" 
                  onClick={() => onSelectAgent(run.agentId)}
                >
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-medium text-sm truncate">{run.input}</span>
                    <Badge variant="outline" className="ml-auto font-mono text-[10px]">
                      {new Date(run.startedAt).toLocaleTimeString()}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function AgentControlTab({ 
  agent, 
  runs, 
  queue, 
  activeRunId, 
  activeRunOutput, 
  onBack, 
  onStartRun, 
  onCancelRun, 
  onEnqueue, 
  onDequeue 
}: any) {
  const [executionInput, setExecutionInput] = useState("");
  const [newQueueItem, setNewQueueItem] = useState("");
  const activeRun = runs.find((r: any) => r.id === activeRunId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={onBack}>← Back</Button>
        <Badge variant={agent.status === 'running' ? 'default' : 'secondary'}>{agent.status}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Lightning size={16} /> Execution</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!activeRun || activeRun.status !== 'running' ? (
              <>
                <label htmlFor="execution-input" className="sr-only">Task description</label>
                <Textarea 
                  id="execution-input"
                  value={executionInput} 
                  onChange={e => setExecutionInput(e.target.value)} 
                  placeholder={`Task for ${agent.name}...`} 
                  className="min-h-[100px] text-sm" 
                />
                <Button 
                  onClick={() => onStartRun(agent.id, executionInput).then(() => setExecutionInput(""))} 
                  disabled={!executionInput.trim()} 
                  className="w-full font-bold"
                >
                  <Play className="size-4  mr-2" weight="fill" /> Start Execution
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-lg border border-solid border-blue-500/20 bg-blue-500/5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-blue-500 mb-1">Current Task</div>
                  <div className="text-sm">{activeRun.input}</div>
                </div>
                <Button variant="destructive" onClick={() => onCancelRun(agent.id, activeRun.id)} className="w-full font-bold">
                  <Square className="size-4  mr-1" weight="fill" /> Stop Execution
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks size={16} /> 
              Queue ({queue.filter((q: any) => q.agentId === agent.id).length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <label htmlFor="queue-item-input" className="sr-only">Add to queue</label>
              <Input 
                id="queue-item-input"
                value={newQueueItem} 
                onChange={e => setNewQueueItem(e.target.value)} 
                placeholder="Add to queue…" 
                className="text-sm"
                onKeyDown={e => { if (e.key === 'Enter' && newQueueItem.trim()) { onEnqueue(newQueueItem, 0, agent.id); setNewQueueItem(""); } }} 
              />
              <Button size="icon" disabled={!newQueueItem.trim()} onClick={() => { onEnqueue(newQueueItem, 0, agent.id); setNewQueueItem(""); }}>
                <Plus size={16} weight="bold" />
              </Button>
            </div>
            <ScrollArea className="h-[200px] border border-solid rounded-lg bg-black/5 p-2">
              <div className="space-y-1">
                {queue.filter((q: any) => q.agentId === agent.id).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">Queue is empty</p>
                ) : (
                  queue.filter((q: any) => q.agentId === agent.id).map((item: any) => (
                    <div key={item.id} className="flex items-center gap-2 p-2 rounded bg-background border border-solid border-muted shadow-sm">
                      <span className="text-xs flex-1 truncate">{item.content || item.task}</span>
                      <button type="button" 
                        onClick={() => onDequeue(item.id)}
                        className="p-1 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded transition-colors border-none bg-transparent cursor-pointer"
                      >
                        <Trash size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none bg-black/40 shadow-inner">
        <CardHeader><CardTitle className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Live Execution Trace</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px] w-full rounded-lg border border-solid border-white/5 bg-[#0a0a0a] p-4">
            <pre className="text-[12px] font-mono whitespace-pre-wrap text-zinc-300 leading-relaxed">
              {activeRunOutput || "// No active execution output stream."}
              {activeRun && activeRun.status === 'running' && <span className="inline-block w-1.5 h-4 bg-blue-500 ml-1 animate-pulse align-middle" />}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
