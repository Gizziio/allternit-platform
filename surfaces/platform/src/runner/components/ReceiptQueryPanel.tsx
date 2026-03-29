"use client";

import React, { useState } from "react";
import { useDakStore } from "../dak.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Receipt,
  MagnifyingGlass,
  Funnel,
  Calendar,
  GitBranch,
  Hash,
  ArrowsClockwise,
  FileCode,
  CaretDown,
  CaretUp,
  DownloadSimple,
  CheckCircle,
  XCircle,
  Warning,
} from '@phosphor-icons/react';
import type { Receipt, ReceiptKind } from "../dak.types";

const RECEIPT_KINDS: { value: ReceiptKind; label: string; color: string }[] = [
  { value: "tool_call_post", label: "Tool Call", color: "blue" },
  { value: "validator_report", label: "Validation", color: "green" },
  { value: "build_report", label: "Build", color: "purple" },
  { value: "gate_decision", label: "Gate", color: "yellow" },
  { value: "session_start", label: "Session", color: "gray" },
  { value: "dag_load", label: "DAG Load", color: "gray" },
  { value: "node_entry", label: "Node Entry", color: "gray" },
  { value: "context_pack_sealed", label: "Context Pack", color: "cyan" },
];

export function ReceiptQueryPanel() {
  const { 
    receipts, 
    isLoading,
    fetchReceipts 
  } = useDakStore();
  
  const [filterDagId, setFilterDagId] = useState("");
  const [filterNodeId, setFilterNodeId] = useState("");
  const [filterWihId, setFilterWihId] = useState("");
  const [selectedKinds, setSelectedKinds] = useState<ReceiptKind[]>([]);
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);
  
  const filteredReceipts = receipts.filter((receipt) => {
    if (filterDagId && !receipt.dagId.includes(filterDagId)) return false;
    if (filterNodeId && !receipt.nodeId.includes(filterNodeId)) return false;
    if (filterWihId && !receipt.wihId.includes(filterWihId)) return false;
    if (selectedKinds.length > 0 && !selectedKinds.includes(receipt.kind)) return false;
    return true;
  });
  
  const toggleKind = (kind: ReceiptKind) => {
    setSelectedKinds((prev) =>
      prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]
    );
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* Filters */}
      <div className="p-4 border-b space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Filter by DAG ID..."
              value={filterDagId}
              onChange={(e) => setFilterDagId(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Input
              placeholder="Filter by Node ID..."
              value={filterNodeId}
              onChange={(e) => setFilterNodeId(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Input
              placeholder="Filter by WIH ID..."
              value={filterWihId}
              onChange={(e) => setFilterWihId(e.target.value)}
            />
          </div>
        </div>
        
        {/* Kind Filters */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground mr-2">Types:</span>
          {RECEIPT_KINDS.map((kind) => (
            <Badge
              key={kind.value}
              variant={selectedKinds.includes(kind.value) ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => toggleKind(kind.value)}
            >
              {kind.label}
            </Badge>
          ))}
          {selectedKinds.length > 0 && (
            <Button variant="ghost" size="sm" className="h-5 text-xs" onClick={() => setSelectedKinds([])}>
              Clear
            </Button>
          )}
        </div>
        
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {filteredReceipts.length} receipts found
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchReceipts()}>
            <ArrowsClockwise className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>
      
      {/* Receipts List */}
      <div className="flex-1 p-4 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-2">
            {filteredReceipts.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <ReceiptIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No receipts found</p>
                <p className="text-sm">Adjust filters or fetch receipts</p>
              </div>
            ) : (
              filteredReceipts.map((receipt) => (
                <ReceiptListItem
                  key={receipt.receiptId}
                  receipt={receipt}
                  isExpanded={receipt.receiptId === expandedReceiptId}
                  onToggle={() => setExpandedReceiptId(
                    receipt.receiptId === expandedReceiptId ? null : receipt.receiptId
                  )}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function ReceiptListItem({ 
  receipt, 
  isExpanded, 
  onToggle 
}: { 
  receipt: Receipt; 
  isExpanded: boolean; 
  onToggle: () => void;
}) {
  const kindConfig = RECEIPT_KINDS.find((k) => k.value === receipt.kind) || {
    label: receipt.kind,
    color: "gray",
  };
  
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    green: "bg-green-500/10 text-green-500 border-green-500/20",
    purple: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    yellow: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    gray: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    cyan: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  };
  
  return (
    <div className="border rounded-lg overflow-hidden">
      <div 
        className={`p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
          isExpanded ? 'bg-muted' : ''
        }`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <ReceiptIcon className={`w-4 h-4 ${colorClasses[kindConfig.color].split(' ')[1]}`} />
          <Badge variant="outline" className={`text-xs ${colorClasses[kindConfig.color]}`}>
            {kindConfig.label}
          </Badge>
          <span className="font-mono text-sm truncate flex-1">{receipt.receiptId.slice(0, 20)}...</span>
          {isExpanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <GitBranch size={12} />
            {receipt.dagId}
          </span>
          <span className="flex items-center gap-1">
            <Hash size={12} />
            {receipt.nodeId}
          </span>
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {new Date(receipt.timestamp).toLocaleString()}
          </span>
        </div>
      </div>
      
      {isExpanded && (
        <div className="border-t p-4 bg-muted/30">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Receipt ID</label>
              <p className="text-sm font-mono text-muted-foreground">{receipt.receiptId}</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Run ID</label>
                <p className="text-sm font-mono">{receipt.runId}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">WIH ID</label>
                <p className="text-sm font-mono">{receipt.wihId}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Timestamp</label>
                <p className="text-sm">{new Date(receipt.timestamp).toLocaleString()}</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Payload</label>
              <div className="mt-1 p-3 bg-muted rounded-lg">
                <pre className="text-xs overflow-auto">{JSON.stringify(receipt.payload, null, 2)}</pre>
              </div>
            </div>
            {receipt.signature && (
              <div>
                <label className="text-sm font-medium">Signature</label>
                <p className="text-xs font-mono text-muted-foreground break-all">{receipt.signature}</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline">
                <DownloadSimple className="w-4 h-4 mr-2" /> Export
              </Button>
              <Button size="sm" variant="outline">
                <FileCode className="w-4 h-4 mr-2" /> Copy JSON
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
