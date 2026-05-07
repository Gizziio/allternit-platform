"use client";

import React, { useState } from "react";
import { useDakStore } from "../dak.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Database,
  MagnifyingGlass,
  Trash,
  ArrowsClockwise,
  HardDrive,
  Pulse as Activity,
  Play,
  Percent,
} from '@phosphor-icons/react';
import type { ToolSnapshot } from "../dak.types";

export function SnapshotManagerPanel() {
  const {
    snapshots,
    snapshotStats,
    fetchSnapshots,
    clearSnapshot,
    clearAllSnapshots
  } = useDakStore();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  
  const filteredSnapshots = snapshots.filter((snap) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      snap.toolName.toLowerCase().includes(query) ||
      snap.snapshotId.toLowerCase().includes(query)
    );
  });
  
  const handleClearAll = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    await clearAllSnapshots();
    setConfirmClear(false);
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* Stats */}
      {snapshotStats && (
        <div className="p-4 border-b">
          <div className="grid grid-cols-4 gap-4">
            <StatCard 
              title="Total Snapshots" 
              value={snapshotStats.totalSnapshots} 
              icon={Database} 
            />
            <StatCard 
              title="Cache Size" 
              value={formatBytes(snapshotStats.totalSize)} 
              icon={HardDrive} 
            />
            <StatCard 
              title="Hit Rate" 
              value={`${(snapshotStats.hitRate * 100).toFixed(1)}%`} 
              icon={Percent} 
            />
            <StatCard 
              title="Total Hits" 
              value={snapshots.reduce((sum, s) => sum + s.hitCount, 0)} 
              icon={Activity} 
            />
          </div>
        </div>
      )}
      
      {/* Actions */}
      <div className="p-4 border-b flex items-center gap-4">
        <div className="flex-1 relative">
          <MagnifyingGlass className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search snapshots by tool name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={fetchSnapshots}>
          <ArrowsClockwise className="w-4 h-4 mr-2" /> Refresh
        </Button>
        <Button 
          variant={confirmClear ? "destructive" : "outline"} 
          onClick={handleClearAll}
        >
          <Trash className="w-4 h-4 mr-2" />
          {confirmClear ? "Confirm Clear All" : "Clear All"}
        </Button>
      </div>
      
      {/* Snapshots List */}
      <div className="flex-1 p-4 overflow-hidden">
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Database size={16} /> Tool Snapshots
              </span>
              <Badge variant="secondary">{filteredSnapshots.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-2">
                {filteredSnapshots.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No snapshots found</p>
                    <p className="text-sm">Snapshots are created automatically when tools are executed</p>
                  </div>
                ) : (
                  filteredSnapshots.map((snapshot) => (
                    <SnapshotListItem
                      key={snapshot.snapshotId}
                      snapshot={snapshot}
                      onDelete={() => clearSnapshot(snapshot.snapshotId)}
                    />
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

function StatCard({ title, value, icon: Icon }: { title: string; value: string | number; icon: any }) {
  return (
    <div className="p-3 rounded-lg bg-muted">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
    </div>
  );
}

function SnapshotListItem({ 
  snapshot, 
  onDelete 
}: { 
  snapshot: ToolSnapshot; 
  onDelete: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  
  return (
    <div className="border rounded-lg overflow-hidden">
      <div 
        className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Play className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{snapshot.toolName}</span>
              <Badge variant="outline" className="text-xs">{snapshot.hitCount} hits</Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono truncate">
              {snapshot.snapshotId}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              {new Date(snapshot.timestamp).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
      
      {showDetails && (
        <div className="border-t p-4 bg-muted/30">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Snapshot ID</label>
              <p className="text-sm font-mono text-muted-foreground break-all">{snapshot.snapshotId}</p>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Tool</label>
                <p className="text-sm font-medium">{snapshot.toolName}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Created</label>
                <p className="text-sm">{new Date(snapshot.timestamp).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Hit Count</label>
                <p className="text-sm font-medium">{snapshot.hitCount}</p>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium">Request</label>
              <div className="mt-1 p-2 bg-muted rounded">
                <pre className="text-xs overflow-auto">{JSON.stringify(snapshot.request, null, 2)}</pre>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium">Response</label>
              <div className="mt-1 p-2 bg-muted rounded">
                <pre className="text-xs overflow-auto">{JSON.stringify(snapshot.response, null, 2)}</pre>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="destructive" onClick={onDelete}>
                <Trash className="w-4 h-4 mr-2" /> Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
