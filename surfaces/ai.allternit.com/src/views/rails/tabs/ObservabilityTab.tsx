"use client";

import React from "react";
import { 
  Eye, 
  CircleNotch, 
  CheckCircle,
  Robot,
  Lightning
} from '@phosphor-icons/react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "../components/RailsSharedUI";

export function GlobalObservabilityCenter({ agents, runs, onSelectAgent }: any) {
  if (agents.length === 0) {
    return (
      <EmptyState 
        message="No Agents" 
        description="Create an agent to start monitoring executions."
        icon={Eye}
      />
    );
  }
  
  return (
    <div className="space-y-4">
      {agents.map((agent: any) => (
        <Card key={agent.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onSelectAgent(agent.id)}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-muted flex items-center justify-center">
                <Robot size={18} />
              </div>
              <span className="font-semibold">{agent.name}</span>
            </div>
            <Badge variant="secondary">{(runs[agent.id] || []).length} runs</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function AgentObservabilityCenter({ agent, runs, traces, onBack }: any) {
  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" onClick={onBack}>← Back</Button>
      
      <div className="grid grid-cols-2 gap-4 h-[600px]">
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="shrink-0 border-b border-solid bg-muted/20">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye size={16} /> Runs ({runs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full p-4">
              <div className="space-y-2">
                {runs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-12 italic">No execution history</p>
                ) : (
                  runs.map((run: any) => (
                    <div key={run.id} className="p-3 rounded-lg border border-solid border-muted bg-background shadow-sm">
                      <div className="flex items-center gap-3">
                        {run.status === 'running' && <CircleNotch className="size-4  animate-spin text-blue-500" />}
                        {run.status === 'completed' && <CheckCircle className="size-4  text-green-500" weight="fill" />}
                        {run.status === 'failed' && <div className="size-3  rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{run.input}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(run.startedAt).toLocaleString()}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[9px] uppercase">{run.status}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="shrink-0 border-b border-solid bg-muted/20">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightning size={16} /> Activity Trace
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full p-4">
              <div className="space-y-2">
                {(!traces || traces.length === 0) ? (
                  <EmptyState message="No trace data available" icon={Eye} />
                ) : (
                  traces.map((entry: any) => (
                    <div key={entry.id || entry.title + entry.timestamp} className="p-2.5 rounded-lg border border-solid border-white/5 bg-black/20 text-sm animate-in fade-in slide-in-from-right-2 duration-300">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[9px] font-mono tracking-tighter uppercase px-1.5 h-4 bg-muted/50">{entry.kind}</Badge>
                        <span className="text-[10px] text-muted-foreground font-mono ml-auto">
                          {new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-zinc-300 leading-relaxed">{entry.title}</div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
