"use client";

import React, { useState } from "react";
import { useDakStore } from "../dak.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ClipboardList, Play, CheckCircle, Clock, AlertTriangle, 
  User, Lock, Unlock, Archive, RefreshCw, Plus, Filter,
  ArrowRight, FileText
} from "lucide-react";
import type { WihInfo } from "../dak.types";

export function WIHManagerPanel() {
  const { 
    wihs, 
    myWihs,
    selectedWihId,
    isLoading,
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
            placeholder="Filter by DAG ID..."
            value={filterDagId}
            onChange={(e) => setFilterDagId(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Agent ID"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="w-40"
          />
          <Button variant="outline" size="icon" onClick={() => fetchWihs(filterDagId || undefined)}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="open" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-4">
          <TabsTrigger value="open">
            <Clock className="w-4 h-4 mr-2" /> 
            Open ({openWihs.length})
          </TabsTrigger>
          <TabsTrigger value="my">
            <User className="w-4 h-4 mr-2" /> 
            My Work ({myWihs.length})
          </TabsTrigger>
          <TabsTrigger value="signed">
            <Lock className="w-4 h-4 mr-2" /> 
            Signed ({signedWihs.length})
          </TabsTrigger>
          <TabsTrigger value="closed">
            <Archive className="w-4 h-4 mr-2" /> 
            History ({closedWihs.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="open" className="flex-1 p-4 m-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
            {/* WIH List */}
            <Card className="lg:col-span-2 flex flex-col">
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Available Work Items</span>
                  <Badge variant="secondary">{openWihs.length} ready</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {openWihs.length === 0 ? (
                      <EmptyState icon={ClipboardList} message="No open work items" />
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
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                {selectedWih ? (
                  <WIHDetails wih={selectedWih} />
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
    open: <Clock className="w-4 h-4 text-blue-500" />,
    signed: <Lock className="w-4 h-4 text-yellow-500" />,
    closed: <CheckCircle className="w-4 h-4 text-green-500" />,
    archived: <Archive className="w-4 h-4 text-gray-500" />,
  };
  
  return (
    <div 
      className={`p-3 rounded-lg border cursor-pointer transition-all ${
        isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        {statusIcons[wih.status]}
        <span className="font-medium text-sm truncate flex-1">{wih.title || wih.nodeId}</span>
        <Badge variant="outline" className="text-xs">{wih.status}</Badge>
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        {wih.dagId} / {wih.nodeId}
      </div>
      {showActions && wih.status === "open" && wih.ready && (
        <div className="mt-2 flex gap-2">
          <Button size="sm" className="w-full" onClick={(e) => { e.stopPropagation(); onPickup?.(); }}>
            <Play className="w-3 h-3 mr-1" /> Pick Up
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
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <Play className="w-4 h-4 text-blue-500" />
        <span className="font-medium">{wih.title || wih.nodeId}</span>
        <Badge variant="default" className="ml-auto">Active</Badge>
      </div>
      <div className="text-xs text-muted-foreground mb-3">
        {wih.dagId} / {wih.nodeId}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="default" className="flex-1" onClick={onComplete}>
          <CheckCircle className="w-3 h-3 mr-1" /> Complete
        </Button>
        <Button size="sm" variant="destructive" className="flex-1" onClick={onFail}>
          <AlertTriangle className="w-3 h-3 mr-1" /> Fail
        </Button>
      </div>
    </Card>
  );
}

function WIHDetails({ wih }: { wih: WihInfo }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">WIH ID</label>
        <p className="text-sm font-mono text-muted-foreground">{wih.wihId}</p>
      </div>
      <div>
        <label className="text-sm font-medium">Node</label>
        <p className="text-sm text-muted-foreground">{wih.nodeId}</p>
      </div>
      <div>
        <label className="text-sm font-medium">DAG</label>
        <p className="text-sm text-muted-foreground">{wih.dagId}</p>
      </div>
      <div>
        <label className="text-sm font-medium">Status</label>
        <div className="mt-1">
          <Badge variant={
            wih.status === "open" ? "default" :
            wih.status === "signed" ? "secondary" :
            wih.status === "closed" ? "outline" : "secondary"
          }>
            {wih.status}
          </Badge>
        </div>
      </div>
      {wih.ready !== undefined && (
        <div>
          <label className="text-sm font-medium">Ready</label>
          <p className="text-sm text-muted-foreground">{wih.ready ? "Yes" : "No"}</p>
        </div>
      )}
      {wih.blockedBy && wih.blockedBy.length > 0 && (
        <div>
          <label className="text-sm font-medium">Blocked By</label>
          <div className="flex flex-wrap gap-1 mt-1">
            {wih.blockedBy.map((id) => (
              <Badge key={id} variant="outline" className="text-xs">{id}</Badge>
            ))}
          </div>
        </div>
      )}
      <div>
        <label className="text-sm font-medium">Created</label>
        <p className="text-sm text-muted-foreground">{new Date(wih.createdAt).toLocaleString()}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
      <Icon className="w-8 h-8 mb-2 opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
