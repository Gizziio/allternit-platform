"use client";

import React, { useState, useSyncExternalStore } from "react";
import { useDakStore } from "../dak.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ClipboardText,
  Play,
  CheckCircle,
  Clock,
  Warning,
  User,
  Lock,
  Archive,
  ArrowsClockwise,
  FileText,
} from '@phosphor-icons/react';
import type { WihInfo } from "../dak.types";
import { cn } from "@/lib/utils";

export function WIHManagerPanel() {
  const isClient = useSyncExternalStore(() => () => {}, () => true, () => false);
  const {
    wihs,
    myWihs,
    selectedWihId,
    fetchWihs,
    pickupWih,
    closeWih,
    selectWih
  } = useDakStore();
  
  const [filterDagId, setFilterDagId] = useState("");
  const [agentId, setAgentId] = useState("builder:local");
  
  const selectedWih = wihs.find((w) => w.wihId === selectedWihId);
  
  const openWihs = wihs.filter((w) => w.status === "open");
  const signedWihs = wihs.filter((w) => w.status === "signed");
  const closedWihs = wihs.filter((w) => w.status === "closed");
  
  const handlePickup = async (wih: WihInfo) => {
    try {
      await pickupWih({
        dagId: wih.dagId,
        nodeId: wih.nodeId,
        agentId,
      });
    } catch (err) {
      // Error handled in store
    }
  };
  
  const handleClose = async (wih: WihInfo, status: "completed" | "failed") => {
    try {
      await closeWih({
        wihId: wih.wihId,
        status,
        evidence: [`Executed by ${agentId}`],
      });
    } catch (err) {
      // Error handled in store
    }
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* Header with filters */}
      <div className="p-4 border-b flex items-center gap-4">
        <div className="flex-1">
          <Input
            id="filter-dag-id"
            placeholder="Filter by DAG ID…"
            value={filterDagId}
            onChange={(e) => setFilterDagId(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Input
            id="agent-id"
            placeholder="Agent ID"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="w-40"
          />
          <Button variant="outline" size="icon" onClick={() => fetchWihs(filterDagId || undefined)} aria-label="Refresh WIH list">
            <ArrowsClockwise size={16} />
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="open" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-4">
          <TabsTrigger value="open">
            <Clock className="size-4 mr-2" /> 
            Open ({openWihs.length})
          </TabsTrigger>
          <TabsTrigger value="my">
            <User className="size-4 mr-2" /> 
            My Work ({myWihs.length})
          </TabsTrigger>
          <TabsTrigger value="signed">
            <Lock className="size-4 mr-2" /> 
            Signed ({signedWihs.length})
          </TabsTrigger>
          <TabsTrigger value="closed">
            <Archive className="size-4 mr-2" /> 
            History ({closedWihs.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="open" className="flex-1 p-4 m-0 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
            {/* WIH List */}
            <Card className="lg:col-span-2 flex flex-col overflow-hidden">
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Available Work Items</span>
                  <Badge variant="secondary">{openWihs.length} ready</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full px-4 pb-4">
                  <div className="space-y-2">
                    {openWihs.length === 0 ? (
                      <EmptyState icon={ClipboardText} message="No open work items" />
                    ) : (
                      openWihs.map((wih) => (
                        <WIHListItem
                          key={wih.wihId}
                          wih={wih}
                          isSelected={wih.wihId === selectedWihId}
                          onClick={() => selectWih(wih.wihId)}
                          onPickup={() => handlePickup(wih)}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            
            {/* WIH Details */}
            <Card className="flex flex-col overflow-hidden">
              <CardHeader>
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                {selectedWih ? (
                  <WIHDetails wih={selectedWih} isClient={isClient} />
                ) : (
                  <EmptyState icon={FileText} message="Select a WIH to view details" />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="my" className="flex-1 p-4 m-0">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-base">Work Assigned to You</CardTitle>
              <CardDescription>Active work items picked up by {agentId}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {myWihs.length === 0 ? (
                    <EmptyState icon={User} message="No work items assigned to you" />
                  ) : (
                    myWihs.map((wih) => (
                      <WIHActiveItem
                        key={wih.wihId}
                        wih={wih}
                        onComplete={() => handleClose(wih, "completed")}
                        onFail={() => handleClose(wih, "failed")}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="signed" className="flex-1 p-4 m-0">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-base">Signed Work Items</CardTitle>
              <CardDescription>Locked work items awaiting execution</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {signedWihs.length === 0 ? (
                    <EmptyState icon={Lock} message="No signed work items" />
                  ) : (
                    signedWihs.map((wih) => (
                      <WIHListItem
                        key={wih.wihId}
                        wih={wih}
                        isSelected={false}
                        onClick={() => {}}
                        showActions={false}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="closed" className="flex-1 p-4 m-0">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-base">Work History</CardTitle>
              <CardDescription>Completed and archived work items</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {closedWihs.length === 0 ? (
                    <EmptyState icon={Archive} message="No closed work items" />
                  ) : (
                    closedWihs.map((wih) => (
                      <WIHListItem
                        key={wih.wihId}
                        wih={wih}
                        isSelected={false}
                        onClick={() => {}}
                        showActions={false}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WIHListItem({ 
  wih, 
  isSelected, 
  onClick, 
  onPickup,
  showActions = true 
}: { 
  wih: WihInfo; 
  isSelected: boolean; 
  onClick: () => void;
  onPickup?: () => void;
  showActions?: boolean;
}) {
  const statusIcons = {
    open: <Clock className="size-4 text-blue-500" />,
    signed: <Lock className="size-4 text-yellow-500" />,
    closed: <CheckCircle className="size-4 text-green-500" />,
    archived: <Archive className="size-4 text-zinc-500" />,
  };
  
  return (
    <div 
      role="button"
      tabIndex={0}
      className={cn(
        "p-3 rounded-lg border border-solid transition-all cursor-pointer outline-none focus:ring-1 focus:ring-[var(--accent-primary)]",
        isSelected ? 'bg-primary/10 border-primary shadow-sm' : 'hover:bg-muted border-transparent'
      )}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
    >
      <div className="flex items-center gap-2">
        {statusIcons[wih.status]}
        <span className="font-medium text-sm truncate flex-1">{wih.title || wih.nodeId}</span>
        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider">{wih.status}</Badge>
      </div>
      <div className="text-[12px] text-muted-foreground mt-1 font-mono">
        {wih.dagId} / {wih.nodeId}
      </div>
      {showActions && wih.status === "open" && wih.ready && (
        <div className="mt-2 flex gap-2">
          <Button size="sm" className="w-full text-[12px] font-bold h-8" onClick={(e) => { e.stopPropagation(); onPickup?.(); }}>
            <Play className="size-3 mr-1" weight="fill" /> Pick Up
          </Button>
        </div>
      )}
    </div>
  );
}

function WIHActiveItem({ 
  wih, 
  onComplete, 
  onFail 
}: { 
  wih: WihInfo; 
  onComplete: () => void;
  onFail: () => void;
}) {
  return (
    <Card className="p-4 bg-muted/20">
      <div className="flex items-center gap-2 mb-2">
        <Play className="size-4 text-blue-500" weight="fill" />
        <span className="font-bold text-sm">{wih.title || wih.nodeId}</span>
        <Badge variant="default" className="ml-auto text-[10px] uppercase">Active</Badge>
      </div>
      <div className="text-[12px] text-muted-foreground mb-3 font-mono">
        {wih.dagId} / {wih.nodeId}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="default" className="flex-1 text-[12px] font-bold" onClick={onComplete}>
          <CheckCircle className="size-3 mr-1" weight="bold" /> Complete
        </Button>
        <Button size="sm" variant="destructive" className="flex-1 text-[12px] font-bold" onClick={onFail}>
          <Warning className="size-3 mr-1" weight="bold" /> Fail
        </Button>
      </div>
    </Card>
  );
}

function WIHDetails({ wih, isClient }: { wih: WihInfo; isClient: boolean }) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground" htmlFor="detail-id">WIH ID</label>
        <p id="detail-id" className="text-[13px] font-mono text-[var(--text-primary)] break-all">{wih.wihId}</p>
      </div>
      <div className="space-y-1.5">
        <label className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground" htmlFor="detail-node">Node</label>
        <p id="detail-node" className="text-[13px] text-[var(--text-primary)]">{wih.nodeId}</p>
      </div>
      <div className="space-y-1.5">
        <label className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground" htmlFor="detail-dag">DAG</label>
        <p id="detail-dag" className="text-[13px] text-[var(--text-primary)]">{wih.dagId}</p>
      </div>
      <div className="space-y-1.5">
        <label className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">Status</label>
        <div className="mt-1">
          <Badge variant={
            wih.status === "open" ? "default" :
            wih.status === "signed" ? "secondary" :
            wih.status === "closed" ? "outline" : "secondary"
          } className="text-[11px] font-bold uppercase">
            {wih.status}
          </Badge>
        </div>
      </div>
      {wih.ready !== undefined && (
        <div className="space-y-1.5">
          <label className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">Ready</label>
          <div className="flex items-center gap-1.5 mt-1">
             <div className={cn("size-2 rounded-full", wih.ready ? "bg-green-500" : "bg-zinc-600")} />
             <span className="text-[13px] font-medium">{wih.ready ? "Processable" : "Blocked"}</span>
          </div>
        </div>
      )}
      {wih.blockedBy && wih.blockedBy.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">Blocked By</label>
          <div className="flex flex-wrap gap-1 mt-1">
            {wih.blockedBy.map((id) => (
              <Badge key={id} variant="outline" className="text-[10px] font-mono">{id.slice(0, 8)}…</Badge>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        <label className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground" htmlFor="detail-created">Created</label>
        <p id="detail-created" className="text-[13px] text-[var(--text-primary)] tabular-nums">
          {isClient ? new Date(wih.createdAt).toLocaleString() : '—'}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
      <Icon className="size-8 opacity-30" />
      <p className="text-sm italic">{message}</p>
    </div>
  );
}
