"use client";

import React, { useState } from "react";
import { useDakStore } from "../dak.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Key,
  ArrowsClockwise,
  LockOpen,
  Clock,
  Warning,
  CheckCircle,
  Plus,
  Funnel,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import type { ManagedLease } from "../dak.types";

export function LeaseMonitorPanel() {
  const { 
    leases, 
    selectedLeaseId,
    isLoading,
    fetchLeases,
    renewLease,
    releaseLease,
    selectLease 
  } = useDakStore();
  
  const [filterAgentId, setFilterAgentId] = useState("");
  
  const activeLeases = leases.filter((l) => l.status === "active");
  const expiringLeases = leases.filter((l) => l.status === "expiring");
  const expiredLeases = leases.filter((l) => l.status === "expired");
  
  const filteredLeases = filterAgentId
    ? leases.filter((l) => l.agentId.includes(filterAgentId))
    : leases;
  
  const selectedLease = leases.find((l) => l.leaseId === selectedLeaseId);
  
  return (
    <div className="h-full flex flex-col">
      {/* Stats Row */}
      <div className="p-4 border-b">
        <div className="grid grid-cols-4 gap-4">
          <StatCard 
            title="Active" 
            value={activeLeases.length} 
            icon={Key} 
            color="green" 
          />
          <StatCard 
            title="Expiring Soon" 
            value={expiringLeases.length} 
            icon={Warning} 
            color="yellow" 
          />
          <StatCard 
            title="Expired" 
            value={expiredLeases.length} 
            icon={Clock} 
            color="red" 
          />
          <StatCard 
            title="Total Renewals" 
            value={leases.reduce((sum, l) => sum + l.renewalCount, 0)} 
            icon={ArrowsClockwise} 
            color="blue" 
          />
        </div>
      </div>
      
      {/* Filter */}
      <div className="p-4 border-b flex items-center gap-4">
        <div className="flex-1 relative">
          <MagnifyingGlass className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by agent ID..."
            value={filterAgentId}
            onChange={(e) => setFilterAgentId(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={fetchLeases}>
          <ArrowsClockwise className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 overflow-hidden">
        {/* Lease List */}
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Active Leases</span>
              <Badge variant="secondary">{filteredLeases.length} total</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredLeases.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No active leases</p>
                  </div>
                ) : (
                  filteredLeases.map((lease) => (
                    <LeaseListItem
                      key={lease.leaseId}
                      lease={lease}
                      isSelected={lease.leaseId === selectedLeaseId}
                      onClick={() => selectLease(lease.leaseId)}
                      onRenew={() => renewLease(lease.leaseId)}
                      onRelease={() => releaseLease(lease.leaseId)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        
        {/* Lease Details */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">Lease Details</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {selectedLease ? (
              <LeaseDetails 
                lease={selectedLease}
                onRenew={() => renewLease(selectedLease.leaseId)}
                onRelease={() => releaseLease(selectedLease.leaseId)}
              />
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select a lease to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: { title: string; value: number; icon: any; color: string }) {
  const colorClasses: Record<string, string> = {
    green: "text-green-500 bg-green-500/10",
    yellow: "text-yellow-500 bg-yellow-500/10",
    red: "text-red-500 bg-red-500/10",
    blue: "text-blue-500 bg-blue-500/10",
  };
  
  return (
    <div className="p-3 rounded-lg bg-muted">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function LeaseListItem({ 
  lease, 
  isSelected, 
  onClick, 
  onRenew, 
  onRelease 
}: { 
  lease: ManagedLease; 
  isSelected: boolean; 
  onClick: () => void;
  onRenew: () => void;
  onRelease: () => void;
}) {
  const now = Date.now();
  const timeRemaining = lease.expiresAt - now;
  const isExpiring = timeRemaining < 60000 && timeRemaining > 0;
  const isExpired = timeRemaining <= 0;
  
  const progress = Math.max(0, Math.min(100, (timeRemaining / (lease.expiresAt - lease.acquiredAt)) * 100));
  
  const statusConfig = {
    active: { icon: Key, color: "text-green-500", badge: "default" },
    expiring: { icon: Warning, color: "text-yellow-500", badge: "secondary" },
    expired: { icon: Clock, color: "text-red-500", badge: "destructive" },
    released: { icon: LockOpen, color: "text-gray-500", badge: "outline" },
  };
  
  const config = statusConfig[lease.status];
  const Icon = config.icon;
  
  return (
    <div 
      className={`p-3 rounded-lg border cursor-pointer transition-all ${
        isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${config.color}`} />
        <span className="font-mono text-sm truncate flex-1">{lease.leaseId.slice(0, 16)}...</span>
        <Badge variant={config.badge as any} className="text-xs">{lease.status}</Badge>
      </div>
      
      <div className="mt-2 space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Time Remaining</span>
          <span className={isExpiring ? "text-yellow-500 font-medium" : ""}>
            {formatDuration(timeRemaining)}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div 
            className={`h-full rounded-full ${
              progress > 50 ? 'bg-green-500' : progress > 20 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{lease.dagId}</span>
        <span>•</span>
        <span>{lease.nodeId}</span>
        <span>•</span>
        <span>{lease.renewalCount} renewals</span>
      </div>
      
      {!isExpired && lease.status !== "released" && (
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={(e) => { e.stopPropagation(); onRenew(); }}>
            <ArrowsClockwise className="w-3 h-3 mr-1" /> Renew
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={(e) => { e.stopPropagation(); onRelease(); }}>
            <LockOpen className="w-3 h-3 mr-1" /> Release
          </Button>
        </div>
      )}
    </div>
  );
}

function LeaseDetails({ lease, onRenew, onRelease }: { lease: ManagedLease; onRenew: () => void; onRelease: () => void }) {
  const now = Date.now();
  const timeRemaining = lease.expiresAt - now;
  const progress = Math.max(0, Math.min(100, (timeRemaining / (lease.expiresAt - lease.acquiredAt)) * 100));
  
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Lease ID</label>
        <p className="text-sm font-mono text-muted-foreground break-all">{lease.leaseId}</p>
      </div>
      
      <div>
        <label className="text-sm font-medium">Status</label>
        <div className="mt-1">
          <Badge variant={
            lease.status === "active" ? "default" :
            lease.status === "expiring" ? "secondary" :
            lease.status === "expired" ? "destructive" : "outline"
          }>
            {lease.status}
          </Badge>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium">TTL Progress</span>
          <span className="text-muted-foreground">{formatDuration(timeRemaining)}</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div 
            className={`h-full rounded-full ${
              progress > 50 ? 'bg-green-500' : progress > 20 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Acquired</label>
          <p className="text-xs text-muted-foreground">{new Date(lease.acquiredAt).toLocaleString()}</p>
        </div>
        <div>
          <label className="text-sm font-medium">Expires</label>
          <p className="text-xs text-muted-foreground">{new Date(lease.expiresAt).toLocaleString()}</p>
        </div>
      </div>
      
      <div>
        <label className="text-sm font-medium">DAG / Node</label>
        <p className="text-sm text-muted-foreground">{lease.dagId} / {lease.nodeId}</p>
      </div>
      
      <div>
        <label className="text-sm font-medium">Agent</label>
        <p className="text-sm font-mono text-muted-foreground">{lease.agentId}</p>
      </div>
      
      <div>
        <label className="text-sm font-medium">WIH ID</label>
        <p className="text-sm font-mono text-muted-foreground">{lease.wihId}</p>
      </div>
      
      <div>
        <label className="text-sm font-medium">Renewals</label>
        <p className="text-sm text-muted-foreground">{lease.renewalCount}</p>
      </div>
      
      <div>
        <label className="text-sm font-medium">Keys (Resources)</label>
        <div className="flex flex-wrap gap-1 mt-1">
          {lease.keys.map((key) => (
            <Badge key={key} variant="outline" className="text-xs">{key}</Badge>
          ))}
        </div>
      </div>
      
      {lease.tools && lease.tools.length > 0 && (
        <div>
          <label className="text-sm font-medium">Allowed Tools</label>
          <div className="flex flex-wrap gap-1 mt-1">
            {lease.tools.map((tool) => (
              <Badge key={tool} variant="secondary" className="text-xs">{tool}</Badge>
            ))}
          </div>
        </div>
      )}
      
      {lease.status === "active" && (
        <div className="flex gap-2 pt-4 border-t">
          <Button className="flex-1" onClick={onRenew}>
            <ArrowsClockwise className="w-4 h-4 mr-2" /> Renew
          </Button>
          <Button variant="outline" className="flex-1" onClick={onRelease}>
            <LockOpen className="w-4 h-4 mr-2" /> Release
          </Button>
        </div>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 0) return "Expired";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (minutes > 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m ${seconds}s`;
}
