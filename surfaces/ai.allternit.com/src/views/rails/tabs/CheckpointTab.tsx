"use client";

import React, { useState } from "react";
import { 
  FloppyDisk, 
  ArrowCounterClockwise,
  Robot,
  Plus
} from '@phosphor-icons/react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "../components/RailsSharedUI";
import { cn } from "@/lib/utils";

export function GlobalCheckpointCenter({ agents, checkpoints, onSelectAgent }: any) {
  if (agents.length === 0) {
    return (
      <EmptyState 
        message="No Agents" 
        description="Create an agent to start saving and restoring checkpoints."
        icon={FloppyDisk}
      />
    );
  }
  
  return (
    <div className="space-y-4">
      {agents.map((agent: any) => {
        const count = (checkpoints[agent.id] || []).length;
        return (
          <Card key={agent.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onSelectAgent(agent.id)}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-muted flex items-center justify-center">
                  <Robot size={18} />
                </div>
                <span className="font-semibold">{agent.name}</span>
              </div>
              <Badge variant="secondary">{count} checkpoints</Badge>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function AgentCheckpointCenter({ 
  agent, 
  checkpoints, 
  runs, 
  onCreate, 
  onRestore, 
  onBack 
}: any) {
  const [newLabel, setNewLabel] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");

  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" onClick={onBack}>← Back</Button>
      
      <Card className="bg-[var(--accent-primary)]/5 border-dashed">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FloppyDisk size={16} /> Create Checkpoint</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Select value={selectedRunId} onValueChange={setSelectedRunId}>
              <SelectTrigger className="w-[260px] bg-background"><SelectValue placeholder="Select run to capture" /></SelectTrigger>
              <SelectContent>
                {runs.map((run: any) => (
                  <SelectItem key={run.id} value={run.id}>
                    {new Date(run.startedAt).toLocaleTimeString()} - {run.input?.substring(0, 30)}…
                  </SelectItem>
                ))}
                {runs.length === 0 && <div className="p-2 text-center text-xs text-muted-foreground">No runs available</div>}
              </SelectContent>
            </Select>
            <Input 
              id="checkpoint-label"
              value={newLabel} 
              onChange={e => setNewLabel(e.target.value)} 
              placeholder="Checkpoint label (e.g. Pre-optimization)" 
              className="flex-1 min-w-[200px] bg-background"
              aria-label="Checkpoint label"
            />
            <Button 
              onClick={() => { onCreate(agent.id, selectedRunId, newLabel, {}); setNewLabel(""); }} 
              disabled={!newLabel || !selectedRunId}
              className="font-bold"
            >
              <Plus className="size-4  mr-2" weight="bold" /> Save Checkpoint
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {checkpoints.length === 0 ? (
          <div className="col-span-full py-12 border border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground opacity-50">
            <FloppyDisk size={32} weight="thin" />
            <p className="text-sm mt-2">No saved checkpoints</p>
          </div>
        ) : (
          checkpoints.map((cp: any) => (
            <Card key={cp.id} className={cn("transition-all", cp.restored ? "border-blue-500/50 bg-blue-500/5" : "")}>
              <CardContent className="p-4 flex flex-col h-full">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                      <FloppyDisk size={18} weight="fill" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{cp.label}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(cp.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  {cp.restored && <Badge variant="default" className="text-[9px] h-4">RESTORED</Badge>}
                </div>
                
                <div className="mt-auto pt-4 flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1 font-bold text-xs" 
                    onClick={() => onRestore(agent.id, cp.id)} 
                    disabled={cp.restored}
                  >
                    <ArrowCounterClockwise className="size-3.5  mr-1.5" weight="bold" /> Restore State
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
