"use client";

import React, { useState } from "react";
import { useDakStore } from "../dak.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GitBranch,
  Plus,
  Play,
  Square,
  CheckCircle,
  Clock,
  Warning,
  CircleNotch,
  PencilSimple,
  ListDashes,
  ArrowRight,
} from '@phosphor-icons/react';
import type { DagDefinition, DagNode } from "../dak.types";

export function DagPlanningPanel() {
  const { 
    dags, 
    activeExecutions, 
    selectedDagId,
    isLoading,
    createDagPlan,
    executeDag,
    cancelDag,
    selectDag 
  } = useDakStore();
  
  const [planInput, setPlanInput] = useState("");
  const [dagIdInput, setDagIdInput] = useState("");
  
  const selectedDag = dags.find((d) => d.dagId === selectedDagId);
  const selectedExecution = activeExecutions.find((e) => e.dagId === selectedDagId);
  
  const handleCreatePlan = async () => {
    if (!planInput.trim()) return;
    try {
      const dagId = await createDagPlan({
        text: planInput,
        dagId: dagIdInput || undefined,
      });
      setPlanInput("");
      setDagIdInput("");
      selectDag(dagId);
    } catch (err) {
      // Error handled in store
    }
  };
  
  const handleExecute = async () => {
    if (!selectedDagId) return;
    await executeDag(selectedDagId);
  };
  
  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="plans" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-4">
          <TabsTrigger value="plans">
            <ListDashes className="w-4 h-4 mr-2" /> Plans
          </TabsTrigger>
          <TabsTrigger value="create">
            <Plus className="w-4 h-4 mr-2" /> Create
          </TabsTrigger>
          <TabsTrigger value="visualize">
            <GitBranch className="w-4 h-4 mr-2" /> Visualize
          </TabsTrigger>
        </TabsList>
        
        {/* Plans List */}
        <TabsContent value="plans" className="flex-1 p-4 m-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
            {/* DAG List */}
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-base">Saved Plans</CardTitle>
                <CardDescription>{dags.length} DAG definitions</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {dags.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No DAG plans yet</p>
                        <p className="text-sm">Create your first plan</p>
                      </div>
                    ) : (
                      dags.map((dag) => (
                        <DagListItem 
                          key={dag.dagId} 
                          dag={dag} 
                          isSelected={dag.dagId === selectedDagId}
                          onClick={() => selectDag(dag.dagId)}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            
            {/* Active Executions */}
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-base">Active Executions</CardTitle>
                <CardDescription>{activeExecutions.length} running</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {activeExecutions.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No active executions</p>
                      </div>
                    ) : (
                      activeExecutions.map((exec) => (
                        <ExecutionListItem 
                          key={exec.runId} 
                          execution={exec}
                          onCancel={() => cancelDag(exec.runId)}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Create Plan */}
        <TabsContent value="create" className="flex-1 p-4 m-0">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Create New DAG Plan</CardTitle>
              <CardDescription>
                Describe what you want to accomplish in natural language
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">DAG ID (optional)</label>
                <Input 
                  value={dagIdInput}
                  onChange={(e) => setDagIdInput(e.target.value)}
                  placeholder="e.g., dag_build_feature_x"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Task Description</label>
                <Textarea 
                  value={planInput}
                  onChange={(e) => setPlanInput(e.target.value)}
                  placeholder="Build a new authentication system with login, signup, and password reset features..."
                  rows={6}
                />
              </div>
              <Button 
                onClick={handleCreatePlan} 
                disabled={!planInput.trim() || isLoading}
                className="w-full"
              >
                {isLoading ? <CircleNotch className="w-4 h-4 mr-2 animate-spin" /> : <GitBranch className="w-4 h-4 mr-2" />}
                Generate DAG Plan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Visualize */}
        <TabsContent value="visualize" className="flex-1 p-4 m-0">
          {selectedDag ? (
            <DagVisualizer dag={selectedDag} execution={selectedExecution} />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <GitBranch className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Select a DAG plan to visualize</p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Selected DAG Actions */}
      {selectedDag && (
        <div className="border-t p-4 bg-muted/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{selectedDag.dagId}</div>
              <div className="text-sm text-muted-foreground">
                {selectedDag.nodes?.length || 0} nodes • {selectedDag.edges?.length || 0} edges
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <PencilSimple className="w-4 h-4 mr-1" /> Edit
              </Button>
              <Button 
                size="sm" 
                onClick={handleExecute}
                disabled={isLoading || selectedExecution?.status === "running"}
              >
                <Play className="w-4 h-4 mr-1" /> Execute
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DagListItem({ dag, isSelected, onClick }: { dag: DagDefinition; isSelected: boolean; onClick: () => void }) {
  return (
    <div 
      className={`p-3 rounded-lg cursor-pointer border transition-all ${
        isSelected 
          ? 'bg-primary/10 border-primary' 
          : 'hover:bg-muted border-transparent'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-primary" />
        <span className="font-medium text-sm truncate flex-1">{dag.dagId}</span>
        <Badge variant="outline" className="text-xs">{dag.version}</Badge>
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        {dag.metadata?.title || "No title"} • {dag.nodes?.length || 0} nodes
      </div>
    </div>
  );
}

function ExecutionListItem({ execution, onCancel }: { execution: any; onCancel: () => void }) {
  const progress = execution.progress || 0;
  const isRunning = execution.status === "running";
  
  return (
    <div className="p-3 rounded-lg border">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isRunning ? (
            <CircleNotch className="w-4 h-4 animate-spin text-blue-500" />
          ) : execution.status === "completed" ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <Warning className="w-4 h-4 text-red-500" />
          )}
          <span className="font-medium text-sm font-mono">{execution.runId.slice(0, 12)}...</span>
        </div>
        <Badge variant={isRunning ? "default" : execution.status === "completed" ? "secondary" : "destructive"}>
          {execution.status}
        </Badge>
      </div>
      
      <div className="h-2 rounded-full bg-muted overflow-hidden mb-2">
        <div 
          className={`h-full rounded-full ${isRunning ? 'bg-blue-500' : progress === 100 ? 'bg-green-500' : 'bg-red-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {execution.completedNodes.length} / {execution.completedNodes.length + execution.failedNodes.length + execution.blockedNodes.length} nodes
        </span>
        {isRunning && (
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={onCancel}>
            <Square className="w-3 h-3 mr-1" /> Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

function DagVisualizer({ dag, execution }: { dag: DagDefinition; execution?: any }) {
  const nodes = dag.nodes || [];
  const edges = dag.edges || [];
  
  // Build adjacency list
  const children: Record<string, string[]> = {};
  edges.forEach((edge) => {
    if (!children[edge.from]) children[edge.from] = [];
    children[edge.from].push(edge.to);
  });
  
  // Find roots
  const allTargets = new Set(edges.map((e) => e.to));
  const roots = nodes.filter((n) => !allTargets.has(n.id));
  
  return (
    <div className="h-full flex gap-4">
      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <CardTitle className="text-base">{dag.dagId}</CardTitle>
          <CardDescription>{dag.metadata?.description || "No description"}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {roots.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">No root nodes</div>
              ) : (
                roots.map((root) => (
                  <NodeTree key={root.id} node={root} nodes={nodes} children={children} execution={execution} depth={0} />
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
      
      <Card className="w-80">
        <CardHeader>
          <CardTitle className="text-base">DAG Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Version</label>
            <p className="text-sm text-muted-foreground">{dag.version}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Created</label>
            <p className="text-sm text-muted-foreground">{dag.createdAt}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Nodes</label>
            <p className="text-sm text-muted-foreground">{nodes.length}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Edges</label>
            <p className="text-sm text-muted-foreground">{edges.length}</p>
          </div>
          {execution && (
            <>
              <div className="border-t pt-4">
                <label className="text-sm font-medium">Execution Status</label>
                <Badge className="mt-1">{execution.status}</Badge>
              </div>
              <div>
                <label className="text-sm font-medium">Progress</label>
                <p className="text-sm text-muted-foreground">{execution.progress}%</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NodeTree({ node, nodes, children, execution, depth }: { 
  node: DagNode; 
  nodes: DagNode[]; 
  children: Record<string, string[]>;
  execution?: any;
  depth: number;
}) {
  const nodeChildren = children[node.id] || [];
  const status = node.status || "pending";
  
  return (
    <div className="space-y-2" style={{ marginLeft: depth * 24 }}>
      <div className="flex items-center gap-2 p-2 rounded border hover:bg-muted/50">
        {status === "running" && <CircleNotch className="w-4 h-4 animate-spin text-blue-500" />}
        {status === "completed" && <CheckCircle className="w-4 h-4 text-green-500" />}
        {status === "failed" && <Warning className="w-4 h-4 text-red-500" />}
        {status === "pending" && <Clock className="w-4 h-4 text-muted-foreground" />}
        {status === "blocked" && <Warning className="w-4 h-4 text-yellow-500" />}
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{node.id}</div>
          <div className="text-xs text-muted-foreground">{node.type}</div>
        </div>
        
        {node.leaseId && <Badge variant="outline" className="text-xs">Lease</Badge>}
      </div>
      
      {nodeChildren.map((childId) => {
        const child = nodes.find((n) => n.id === childId);
        if (!child) return null;
        return (
          <div key={childId} className="flex items-start gap-2">
            <ArrowRight className="w-4 h-4 mt-3 text-muted-foreground" />
            <NodeTree node={child} nodes={nodes} children={children} execution={execution} depth={0} />
          </div>
        );
      })}
    </div>
  );
}
