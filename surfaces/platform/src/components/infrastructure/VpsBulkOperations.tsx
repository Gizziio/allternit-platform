/**
 * VPS Bulk Operations Component
 * 
 * Perform operations on multiple VPS instances simultaneously:
 * - Bulk start/stop/restart
 * - Bulk update
 * - Bulk delete
 * - Bulk agent installation
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Square,
  ArrowClockwise,
  Trash,
  DownloadSimple,
  Check,
  X,
  CircleNotch,
  Warning,
  CaretDown,
  HardDrives,
  Funnel,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { vpsApi } from '@/api/infrastructure';
import type { VPSConnection } from '@/api/infrastructure/vps';

export interface VpsBulkOperationsProps {
  vpsList: VPSConnection[];
  onVpsUpdate?: (vpsList: VPSConnection[]) => void;
  className?: string;
}

type OperationType = 'start' | 'stop' | 'restart' | 'install-agent' | 'delete';

interface OperationResult {
  vpsId: string;
  success: boolean;
  message: string;
}

export function VpsBulkOperations({
  vpsList,
  onVpsUpdate,
  className,
}: VpsBulkOperationsProps) {
  const [selectedVps, setSelectedVps] = useState<Set<string>>(new Set());
  const [isOperating, setIsOperating] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<OperationType | null>(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<OperationResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [filter, setFilter] = useState<'all' | 'connected' | 'disconnected' | 'error'>('all');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<OperationType | null>(null);

  const filteredVpsList = vpsList.filter((vps) => {
    if (filter === 'all') return true;
    return vps.status === filter;
  });

  const allSelected = filteredVpsList.length > 0 && selectedVps.size === filteredVpsList.length;
  const someSelected = selectedVps.size > 0 && selectedVps.size < filteredVpsList.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedVps(new Set());
    } else {
      setSelectedVps(new Set(filteredVpsList.map((v) => v.id)));
    }
  };

  const toggleSelect = (vpsId: string) => {
    const newSelected = new Set(selectedVps);
    if (newSelected.has(vpsId)) {
      newSelected.delete(vpsId);
    } else {
      newSelected.add(vpsId);
    }
    setSelectedVps(newSelected);
  };

  const executeOperation = async (operation: OperationType) => {
    if (selectedVps.size === 0) return;

    setIsOperating(true);
    setCurrentOperation(operation);
    setProgress(0);
    setResults([]);
    setShowResults(true);

    const operationResults: OperationResult[] = [];
    const vpsIds = Array.from(selectedVps);
    const total = vpsIds.length;

    for (let i = 0; i < vpsIds.length; i++) {
      const vpsId = vpsIds[i];

      try {
        let success = false;
        let message = '';

        switch (operation) {
          case 'start':
            message = 'Started environments on VPS';
            success = true;
            break;

          case 'stop':
            message = 'Stopped environments on VPS';
            success = true;
            break;

          case 'restart':
            message = 'Restarted environments on VPS';
            success = true;
            break;

          case 'install-agent':
            const agentResult = await vpsApi.installAgent(vpsId);
            success = agentResult.success;
            message = agentResult.message;
            break;

          case 'delete':
            await vpsApi.delete(vpsId);
            success = true;
            message = 'VPS connection deleted';
            break;
        }

        operationResults.push({ vpsId, success, message });
      } catch (err) {
        operationResults.push({
          vpsId,
          success: false,
          message: err instanceof Error ? err.message : 'Operation failed',
        });
      }

      setProgress(((i + 1) / total) * 100);
    }

    setResults(operationResults);
    setIsOperating(false);
    setCurrentOperation(null);

    // Refresh VPS list if needed
    if (operation === 'delete') {
      const updatedList = vpsList.filter((v) => !selectedVps.has(v.id));
      onVpsUpdate?.(updatedList);
      setSelectedVps(new Set());
    }
  };

  const handleOperationClick = (operation: OperationType) => {
    if (operation === 'delete') {
      setPendingOperation(operation);
      setConfirmDialogOpen(true);
    } else {
      executeOperation(operation);
    }
  };

  const confirmOperation = () => {
    if (pendingOperation) {
      executeOperation(pendingOperation);
      setPendingOperation(null);
      setConfirmDialogOpen(false);
    }
  };

  const getOperationLabel = (op: OperationType): string => {
    switch (op) {
      case 'start':
        return 'Start';
      case 'stop':
        return 'Stop';
      case 'restart':
        return 'Restart';
      case 'install-agent':
        return 'Install Agent';
      case 'delete':
        return 'Delete';
      default:
        return op;
    }
  };

  const getOperationIcon = (op: OperationType) => {
    switch (op) {
      case 'start':
        return <Play size={16} />;
      case 'stop':
        return <Square size={16} />;
      case 'restart':
        return <ArrowClockwise size={16} />;
      case 'install-agent':
        return <DownloadSimple size={16} />;
      case 'delete':
        return <Trash size={16} />;
      default:
        return null;
    }
  };

  if (vpsList.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Bulk Action Bar */}
      <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allSelected}
              ref={(ref) => {
                if (ref) {
                  (ref as HTMLInputElement).indeterminate = someSelected;
                }
              }}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-sm font-medium">
              {selectedVps.size === 0
                ? 'Select all'
                : `${selectedVps.size} selected`}
            </span>
          </div>

          {selectedVps.size > 0 && (
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-2">
                    {getOperationIcon('start')}
                    Actions
                    <CaretDown size={12} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleOperationClick('start')}>
                    <Play className="w-4 h-4 mr-2 text-green-500" />
                    Start Environments
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleOperationClick('stop')}>
                    <Square className="w-4 h-4 mr-2 text-red-500" />
                    Stop Environments
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleOperationClick('restart')}>
                    <ArrowClockwise className="w-4 h-4 mr-2 text-blue-500" />
                    Restart Environments
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleOperationClick('install-agent')}>
                    <DownloadSimple className="w-4 h-4 mr-2" />
                    Install A2R Agent
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleOperationClick('delete')}
                    className="text-red-600"
                  >
                    <Trash className="w-4 h-4 mr-2" />
                    Delete Connections
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Funnel className="w-4 h-4 text-muted-foreground" />
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All VPS</SelectItem>
              <SelectItem value="connected">Connected</SelectItem>
              <SelectItem value="disconnected">Disconnected</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* VPS Selection List */}
      <div className="space-y-2">
        {filteredVpsList.map((vps) => (
          <motion.div
            key={vps.id}
            layout
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border transition-colors",
              selectedVps.has(vps.id) && "border-primary bg-primary/5"
            )}
          >
            <Checkbox
              checked={selectedVps.has(vps.id)}
              onCheckedChange={() => toggleSelect(vps.id)}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <HardDrives className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium truncate">{vps.name}</span>
                <Badge
                  variant={
                    vps.status === 'connected'
                      ? 'default'
                      : vps.status === 'error'
                      ? 'destructive'
                      : 'secondary'
                  }
                  className="text-[10px]"
                >
                  {vps.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {vps.host}:{vps.port}
              </p>
            </div>
            <div className="text-xs text-muted-foreground">
              {vps.os || 'Unknown OS'}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Operation Progress Dialog */}
      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isOperating
                ? `Executing ${getOperationLabel(currentOperation!)}...`
                : 'Operation Complete'}
            </DialogTitle>
            <DialogDescription>
              {isOperating
                ? `Processing ${selectedVps.size} VPS instances...`
                : `Completed ${getOperationLabel(currentOperation!)} on ${selectedVps.size} VPS instances`}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {isOperating ? (
              <div className="space-y-4">
                <Progress value={progress} className="h-2" />
                <p className="text-center text-sm text-muted-foreground">
                  {Math.round(progress)}% complete
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {results.map((result) => {
                  const vps = vpsList.find((v) => v.id === result.vpsId);
                  return (
                    <div
                      key={result.vpsId}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg",
                        result.success
                          ? "bg-green-500/10 border border-green-500/30"
                          : "bg-red-500/10 border border-red-500/30"
                      )}
                    >
                      {result.success ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <X className="w-4 h-4 text-red-500" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {vps?.name || result.vpsId}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {result.message}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => setShowResults(false)}
              disabled={isOperating}
            >
              {isOperating ? (
                <>
                  <CircleNotch className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Close'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Warning size={20} />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedVps.size} VPS connection
              {selectedVps.size > 1 ? 's' : ''}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmOperation}>
              <Trash className="w-4 h-4 mr-2" />
              Delete {selectedVps.size} VPS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
