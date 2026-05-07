"use client";

import { useEffect, useState } from "react";
import { useDakStore } from "../runner/dak.store";
import { DagPlanningPanel } from "../runner/components/DagPlanningPanel";
import { WIHManagerPanel } from "../runner/components/WIHManagerPanel";
import { LeaseMonitorPanel } from "../runner/components/LeaseMonitorPanel";
import { ContextPackBrowser } from "../runner/components/ContextPackBrowser";
import { ReceiptQueryPanel } from "../runner/components/ReceiptQueryPanel";
import { TemplateLibraryPanel } from "../runner/components/TemplateLibraryPanel";
import { SnapshotManagerPanel } from "../runner/components/SnapshotManagerPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Play,
  GitBranch,
  ClipboardText,
  Key,
  Package,
  Receipt,
  FileCode,
  Database,
  Pulse as Activity,
  ArrowsClockwise,
  Robot,
  Warning,
} from '@phosphor-icons/react';

// Simple Execute Panel for basic tool execution
function ExecutePanel() {
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  
  const handleExecute = async () => {
    if (!command.trim()) return;
    setIsRunning(true);
    setOutput((prev) => [...prev, `> ${command}`]);
    
    // Simulate execution
    await new Promise((r) => setTimeout(r, 1000));
    setOutput((prev) => [...prev, `Executed: ${command}`, ""]);
    setCommand("");
    setIsRunning(false);
  };
  
  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex-1 bg-muted rounded-lg p-4 font-mono text-sm overflow-auto mb-4">
        {output.length === 0 ? (
          <span className="text-muted-foreground">Ready to execute tools...</span>
        ) : (
          output.map((line, i) => <div key={i}>{line}</div>)
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleExecute()}
          placeholder="Enter command..."
          className="flex-1 px-4 py-2 rounded-lg border bg-background"
          disabled={isRunning}
        />
        <Button onClick={handleExecute} disabled={isRunning || !command.trim()}>
          {isRunning ? <ArrowsClockwise className="w-4 h-4 animate-spin" /> : <Play size={16} />}
        </Button>
      </div>
    </div>
  );
}

// Status Bar Component
function StatusBar() {
  const { railsConnected, activeExecutions, leases, pendingGateChecks } = useDakStore();
  
  const activeRuns = activeExecutions.filter((e) => e.status === "running").length;
  const activeLeases = leases.filter((l) => l.status === "active").length;
  const pendingGates = pendingGateChecks.length;
  
  return (
    <div className="h-10 border-t bg-muted/50 flex items-center px-4 gap-6 text-xs">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${railsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-muted-foreground">Rails</span>
        <span className={railsConnected ? 'text-green-500' : 'text-red-500'}>
          {railsConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      
      {activeRuns > 0 && (
        <div className="flex items-center gap-2">
          <Activity className="w-3 h-3 text-blue-500" />
          <span className="text-muted-foreground">Active Runs</span>
          <Badge variant="default" className="text-xs">{activeRuns}</Badge>
        </div>
      )}
      
      {activeLeases > 0 && (
        <div className="flex items-center gap-2">
          <Key className="w-3 h-3 text-yellow-500" />
          <span className="text-muted-foreground">Leases</span>
          <Badge variant="secondary" className="text-xs">{activeLeases}</Badge>
        </div>
      )}
      
      {pendingGates > 0 && (
        <div className="flex items-center gap-2">
          <Warning className="w-3 h-3 text-orange-500" />
          <span className="text-muted-foreground">Pending Gates</span>
          <Badge variant="destructive" className="text-xs">{pendingGates}</Badge>
        </div>
      )}
      
      <div className="flex-1" />
      
      <div className="text-muted-foreground">
        DAK Runner v1.1.0
      </div>
    </div>
  );
}

export function RunnerView() {
  const { 
    activeTab, 
    setActiveTab, 
    checkHealth,
    railsConnected,
    activeExecutions,
    leases,
    pendingGateChecks 
  } = useDakStore();
  
  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);
  
  const activeRuns = activeExecutions.filter((e) => e.status === "running").length;
  const activeLeases = leases.filter((l) => l.status === "active").length;
  const pendingGates = pendingGateChecks.length;
  
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="h-14 border-b flex items-center px-4 gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Robot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold">DAK Runner</h1>
            <p className="text-xs text-muted-foreground">Deterministic Agent Kernel</p>
          </div>
        </div>
        
        <div className="flex-1" />
        
        {/* Quick Stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
            <div className={`w-2 h-2 rounded-full ${railsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs">Rails {railsConnected ? 'OK' : 'Down'}</span>
          </div>
          
          {activeRuns > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10">
              <Activity className="w-3 h-3 text-blue-500" />
              <span className="text-xs text-blue-500">{activeRuns} Running</span>
            </div>
          )}
          
          {activeLeases > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10">
              <Key className="w-3 h-3 text-yellow-500" />
              <span className="text-xs text-yellow-500">{activeLeases} Leases</span>
            </div>
          )}
          
          {pendingGates > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10">
              <Warning className="w-3 h-3 text-red-500" />
              <span className="text-xs text-red-500">{pendingGates} Gates</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-4 flex-wrap h-auto gap-1 justify-start">
          <TabsTrigger value="execute" className="gap-2">
            <Play size={16} /> Execute
          </TabsTrigger>
          
          <TabsTrigger value="dags" className="gap-2">
            <GitBranch size={16} /> 
            DAG Plans
            {activeRuns > 0 && <Badge variant="default" className="ml-1 text-[10px]">{activeRuns}</Badge>}
          </TabsTrigger>
          
          <TabsTrigger value="wihs" className="gap-2">
            <ClipboardText size={16} /> 
            Work Items
          </TabsTrigger>
          
          <TabsTrigger value="leases" className="gap-2">
            <Key size={16} /> 
            Leases
            {activeLeases > 0 && <Badge variant="secondary" className="ml-1 text-[10px]">{activeLeases}</Badge>}
          </TabsTrigger>
          
          <TabsTrigger value="context" className="gap-2">
            <Package size={16} /> 
            Context Packs
          </TabsTrigger>
          
          <TabsTrigger value="receipts" className="gap-2">
            <Receipt size={16} /> 
            Receipts
          </TabsTrigger>
          
          <TabsTrigger value="templates" className="gap-2">
            <FileCode size={16} /> 
            Templates
          </TabsTrigger>
          
          <TabsTrigger value="snapshots" className="gap-2">
            <Database size={16} /> 
            Snapshots
          </TabsTrigger>
        </TabsList>
        
        <div className="flex-1 overflow-hidden">
          <TabsContent value="execute" className="h-full m-0 p-0">
            <ExecutePanel />
          </TabsContent>
          
          <TabsContent value="dags" className="h-full m-0 p-0">
            <DagPlanningPanel />
          </TabsContent>
          
          <TabsContent value="wihs" className="h-full m-0 p-0">
            <WIHManagerPanel />
          </TabsContent>
          
          <TabsContent value="leases" className="h-full m-0 p-0">
            <LeaseMonitorPanel />
          </TabsContent>
          
          <TabsContent value="context" className="h-full m-0 p-0">
            <ContextPackBrowser />
          </TabsContent>
          
          <TabsContent value="receipts" className="h-full m-0 p-0">
            <ReceiptQueryPanel />
          </TabsContent>
          
          <TabsContent value="templates" className="h-full m-0 p-0">
            <TemplateLibraryPanel />
          </TabsContent>
          
          <TabsContent value="snapshots" className="h-full m-0 p-0">
            <SnapshotManagerPanel />
          </TabsContent>
        </div>
      </Tabs>
      
      {/* Status Bar */}
      <StatusBar />
    </div>
  );
}

export default RunnerView;
