"use client";

import React, { useState } from "react";
import { useDakStore } from "../dak.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Package,
  DownloadSimple,
  FileText,
  GitBranch,
  Key,
  Hash,
  MagnifyingGlass,
  Calendar,
  ArrowsClockwise,
  CaretRight,
  Receipt,
} from '@phosphor-icons/react';
import type { ContextPack } from "../dak.types";

export function ContextPackBrowser() {
  const { 
    contextPacks, 
    selectedContextPackId,
    isLoading,
    fetchContextPacks,
    selectContextPack 
  } = useDakStore();
  
  const [filterDagId, setFilterDagId] = useState("");
  const [filterNodeId, setFilterNodeId] = useState("");
  
  const filteredPacks = contextPacks.filter((pack) => {
    if (filterDagId && !pack.inputs.dagId.includes(filterDagId)) return false;
    if (filterNodeId && !pack.inputs.nodeId.includes(filterNodeId)) return false;
    return true;
  });
  
  const selectedPack = contextPacks.find((p) => p.contextPackId === selectedContextPackId);
  
  return (
    <div className="h-full flex flex-col">
      {/* Filters */}
      <div className="p-4 border-b flex items-center gap-4">
        <div className="flex-1 flex gap-2">
          <div className="flex-1 relative">
            <GitBranch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter by DAG ID..."
              value={filterDagId}
              onChange={(e) => setFilterDagId(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex-1 relative">
            <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter by Node ID..."
              value={filterNodeId}
              onChange={(e) => setFilterNodeId(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Button variant="outline" onClick={() => fetchContextPacks()}>
          <ArrowsClockwise className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 overflow-hidden">
        {/* Pack List */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Package size={16} /> Context Packs
              </span>
              <Badge variant="secondary">{filteredPacks.length} sealed</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredPacks.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No context packs found</p>
                  </div>
                ) : (
                  filteredPacks.map((pack) => (
                    <PackListItem
                      key={pack.contextPackId}
                      pack={pack}
                      isSelected={pack.contextPackId === selectedContextPackId}
                      onClick={() => selectContextPack(pack.contextPackId)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        
        {/* Pack Details */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">Pack Details</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {selectedPack ? (
              <PackDetails pack={selectedPack} />
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select a context pack to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PackListItem({ 
  pack, 
  isSelected, 
  onClick 
}: { 
  pack: ContextPack; 
  isSelected: boolean; 
  onClick: () => void;
}) {
  return (
    <div 
      className={`p-3 rounded-lg border cursor-pointer transition-all ${
        isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <Package className="w-4 h-4 text-primary" />
        <span className="font-mono text-sm truncate flex-1">{pack.contextPackId.slice(0, 20)}...</span>
        <Badge variant="outline" className="text-xs">v{pack.version}</Badge>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <GitBranch size={12} />
        <span className="truncate">{pack.inputs.dagId}</span>
        <CaretRight size={12} />
        <Hash size={12} />
        <span className="truncate">{pack.inputs.nodeId}</span>
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Receipt size={12} />
          {pack.inputs.receiptRefs?.length || 0} receipts
        </span>
        <span className="flex items-center gap-1">
          <Calendar size={12} />
          {new Date(pack.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

function PackDetails({ pack }: { pack: ContextPack }) {
  const [showRaw, setShowRaw] = useState(false);
  
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Context Pack ID</label>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-sm font-mono text-muted-foreground break-all flex-1">{pack.contextPackId}</p>
          <Button size="icon" variant="ghost" title="Copy ID">
            <FileText size={16} />
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Version</label>
          <p className="text-sm text-muted-foreground">{pack.version}</p>
        </div>
        <div>
          <label className="text-sm font-medium">Created</label>
          <p className="text-sm text-muted-foreground">{new Date(pack.createdAt).toLocaleString()}</p>
        </div>
      </div>
      
      <div>
        <label className="text-sm font-medium">Correlation ID</label>
        <p className="text-sm font-mono text-muted-foreground">{pack.correlationId}</p>
      </div>
      
      <div className="border-t pt-4">
        <h4 className="font-medium mb-3">Inputs</h4>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground">WIH ID</label>
            <p className="text-sm font-mono">{pack.inputs.wihId}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm text-muted-foreground">DAG ID</label>
              <p className="text-sm">{pack.inputs.dagId}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Node ID</label>
              <p className="text-sm font-mono">{pack.inputs.nodeId}</p>
            </div>
          </div>
          
          {pack.inputs.wihContent && (
            <div>
              <label className="text-sm text-muted-foreground">WIH Content</label>
              <p className="text-sm bg-muted p-2 rounded mt-1">{pack.inputs.wihContent}</p>
            </div>
          )}
          
          <div>
            <label className="text-sm text-muted-foreground">Receipt References</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {pack.inputs.receiptRefs?.map((ref) => (
                <Badge key={ref} variant="outline" className="text-xs font-mono">{ref.slice(0, 12)}...</Badge>
              )) || <span className="text-sm text-muted-foreground">None</span>}
            </div>
          </div>
          
          {pack.inputs.policyBundleId && (
            <div>
              <label className="text-sm text-muted-foreground">Policy Bundle</label>
              <p className="text-sm font-mono">{pack.inputs.policyBundleId}</p>
            </div>
          )}
          
          {pack.inputs.toolRegistryVersion && (
            <div>
              <label className="text-sm text-muted-foreground">Tool Registry Version</label>
              <p className="text-sm">{pack.inputs.toolRegistryVersion}</p>
            </div>
          )}
          
          {pack.inputs.leaseInfo && (
            <div>
              <label className="text-sm text-muted-foreground">Lease Info</label>
              <div className="text-sm bg-muted p-2 rounded mt-1 space-y-1">
                <p className="font-mono">{pack.inputs.leaseInfo.leaseId}</p>
                <p className="text-xs text-muted-foreground">
                  Expires: {new Date(pack.inputs.leaseInfo.expiresAt).toLocaleString()}
                </p>
                <div className="flex flex-wrap gap-1">
                  {pack.inputs.leaseInfo.keys.map((key) => (
                    <Badge key={key} variant="secondary" className="text-xs">{key}</Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {pack.inputs.planHashes && Object.keys(pack.inputs.planHashes).length > 0 && (
        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">Plan Artifacts</h4>
          <div className="space-y-2">
            {Object.entries(pack.inputs.planHashes).map(([name, hash]) => (
              <div key={name} className="flex items-center justify-between p-2 bg-muted rounded">
                <span className="text-sm">{name}</span>
                <span className="text-xs font-mono text-muted-foreground">{hash.slice(0, 16)}...</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="border-t pt-4 flex gap-2">
        <Button className="flex-1">
          <DownloadSimple className="w-4 h-4 mr-2" /> Download Pack
        </Button>
        <Button variant="outline" onClick={() => setShowRaw(!showRaw)}>
          {showRaw ? "Hide" : "View"} Raw
        </Button>
      </div>
      
      {showRaw && (
        <div className="border rounded-lg p-3 bg-muted">
          <pre className="text-xs overflow-auto">{JSON.stringify(pack, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
