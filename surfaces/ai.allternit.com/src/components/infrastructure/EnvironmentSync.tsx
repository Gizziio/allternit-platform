/**
 * Environment Sync Component
 * 
 * Synchronize files between local and remote environments:
 * - Two-way sync
 * - Selective sync (include/exclude patterns)
 * - Auto-sync on change
 * - Conflict resolution
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  UploadSimple,
  DownloadSimple,
  ArrowsLeftRight,
  Folder,
  File,
  Check,
  X,
  CircleNotch,
  GearSix,
  Clock,
  Warning,
  ArrowsClockwise,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Environment } from '@/api/infrastructure';

export interface SyncConfig {
  direction: 'up' | 'down' | 'bidirectional';
  autoSync: boolean;
  autoSyncInterval: number; // minutes
  excludePatterns: string[];
  includePatterns: string[];
  deleteExtraneous: boolean;
  preservePermissions: boolean;
  conflictStrategy: 'local-wins' | 'remote-wins' | 'newest-wins' | 'manual';
}

export interface EnvironmentSyncProps {
  environment: Environment;
  onSync: (config: SyncConfig) => Promise<void>;
  className?: string;
}

interface SyncFile {
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified: Date;
  status: 'synced' | 'pending' | 'conflict' | 'error';
  direction?: 'up' | 'down';
}

export function EnvironmentSync({
  environment,
  onSync,
  className,
}: EnvironmentSyncProps) {
  const [config, setConfig] = useState<SyncConfig>({
    direction: 'bidirectional',
    autoSync: false,
    autoSyncInterval: 5,
    excludePatterns: ['node_modules', '.git', '*.log', '.env'],
    includePatterns: [],
    deleteExtraneous: false,
    preservePermissions: true,
    conflictStrategy: 'newest-wins',
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const [newPattern, setNewPattern] = useState('');
  const [patternType, setPatternType] = useState<'include' | 'exclude'>('exclude');
  const [syncHistory, setSyncHistory] = useState<Array<{ date: Date; status: string; files: number }>>([
    { date: new Date(Date.now() - 3600000), status: 'success', files: 45 },
    { date: new Date(Date.now() - 86400000), status: 'success', files: 12 },
  ]);
  const [pendingFiles] = useState<SyncFile[]>([
    { path: 'src/components/new-feature.tsx', type: 'file', size: 3456, modified: new Date(), status: 'pending', direction: 'up' },
    { path: 'package.json', type: 'file', size: 2890, modified: new Date(), status: 'conflict', direction: 'up' },
    { path: 'README.md', type: 'file', size: 1234, modified: new Date(), status: 'pending', direction: 'down' },
  ]);

  const startSync = async () => {
    setIsSyncing(true);
    setProgress(0);

    // Simulate sync progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 5;
      });
    }, 300);

    try {
      await onSync(config);
      setTimeout(() => {
        setIsSyncing(false);
        setSyncHistory(prev => [{
          date: new Date(),
          status: 'success',
          files: pendingFiles.filter(f => f.status === 'pending').length
        }, ...prev].slice(0, 10));
      }, 3000);
    } catch (err) {
      setIsSyncing(false);
    }
  };

  const addPattern = () => {
    if (!newPattern.trim()) return;
    if (patternType === 'exclude') {
      setConfig(prev => ({
        ...prev,
        excludePatterns: [...prev.excludePatterns, newPattern.trim()]
      }));
    } else {
      setConfig(prev => ({
        ...prev,
        includePatterns: [...prev.includePatterns, newPattern.trim()]
      }));
    }
    setNewPattern('');
  };

  const removePattern = (pattern: string, type: 'include' | 'exclude') => {
    if (type === 'exclude') {
      setConfig(prev => ({
        ...prev,
        excludePatterns: prev.excludePatterns.filter(p => p !== pattern)
      }));
    } else {
      setConfig(prev => ({
        ...prev,
        includePatterns: prev.includePatterns.filter(p => p !== pattern)
      }));
    }
  };

  const formatBytes = (bytes?: number): string => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDirectionIcon = (direction?: 'up' | 'down') => {
    if (direction === 'up') return <UploadSimple className="w-4 h-4 text-blue-500" />;
    if (direction === 'down') return <DownloadSimple className="w-4 h-4 text-green-500" />;
    return <ArrowsLeftRight className="w-4 h-4 text-muted-foreground" />;
  };

  const getStatusIcon = (status: SyncFile['status']) => {
    switch (status) {
      case 'synced':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'conflict':
        return <Warning className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <X className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <ArrowsLeftRight size={16} />
            File Sync
          </h3>
          <p className="text-xs text-muted-foreground">
            Synchronize files with {environment.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowConfig(true)}>
            <GearSix className="w-4 h-4 mr-2" />
            Config
          </Button>
        </div>
      </div>

      {/* Sync Direction Selector */}
      <div className="grid grid-cols-3 gap-2">
        {(['up', 'down', 'bidirectional'] as const).map((dir) => (
          <button
            key={dir}
            onClick={() => setConfig(prev => ({ ...prev, direction: dir }))}
            className={cn(
              "flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors",
              config.direction === dir
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
          >
            {dir === 'up' && <UploadSimple size={20} />}
            {dir === 'down' && <DownloadSimple size={20} />}
            {dir === 'bidirectional' && <ArrowsLeftRight size={20} />}
            <span className="text-xs font-medium capitalize">
              {dir === 'up' && 'Upload →'}
              {dir === 'down' && '← Download'}
              {dir === 'bidirectional' && 'Both Ways'}
            </span>
          </button>
        ))}
      </div>

      {/* Pending Files */}
      {pendingFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Pending Changes</h4>
            <Badge variant="secondary">{pendingFiles.length} files</Badge>
          </div>
          <ScrollArea className="h-[150px] rounded-lg border">
            <div className="p-2 space-y-1">
              {pendingFiles.map((file) => (
                <div
                  key={file.path}
                  className="flex items-center gap-3 p-2 rounded hover:bg-muted/50"
                >
                  {getDirectionIcon(file.direction)}
                  {file.type === 'directory' ? (
                    <Folder className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <File className="w-4 h-4 text-muted-foreground" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{file.path}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(file.size)} • {file.modified.toLocaleTimeString()}
                    </p>
                  </div>
                  {getStatusIcon(file.status)}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Sync History */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Recent Syncs</h4>
        <div className="space-y-1">
          {syncHistory.slice(0, 3).map((sync, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>{sync.date.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={sync.status === 'success' ? 'default' : 'destructive'}
                  className="text-[10px]"
                >
                  {sync.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {sync.files} files
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sync Button */}
      <Button
        onClick={startSync}
        disabled={isSyncing}
        className="w-full gap-2"
      >
        {isSyncing ? (
          <>
            <CircleNotch className="w-4 h-4 animate-spin" />
            Syncing... {progress}%
          </>
        ) : (
          <>
            {config.direction === 'up' && <UploadSimple size={16} />}
            {config.direction === 'down' && <DownloadSimple size={16} />}
            {config.direction === 'bidirectional' && <ArrowsLeftRight size={16} />}
            Sync {pendingFiles.length} Files
          </>
        )}
      </Button>

      {/* Configuration Dialog */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sync Configuration</DialogTitle>
            <DialogDescription>
              Configure how files are synchronized with {environment.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Auto Sync */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Auto Sync</label>
                <p className="text-xs text-muted-foreground">
                  Automatically sync on file changes
                </p>
              </div>
              <Switch
                checked={config.autoSync}
                onCheckedChange={(v) => setConfig(prev => ({ ...prev, autoSync: v }))}
              />
            </div>

            {config.autoSync && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Sync Interval</label>
                <select
                  value={config.autoSyncInterval}
                  onChange={(e) => setConfig(prev => ({ ...prev, autoSyncInterval: parseInt(e.target.value) }))}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value={1}>Every minute</option>
                  <option value={5}>Every 5 minutes</option>
                  <option value={15}>Every 15 minutes</option>
                  <option value={30}>Every 30 minutes</option>
                  <option value={60}>Every hour</option>
                </select>
              </div>
            )}

            {/* Conflict Resolution */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Conflict Resolution</label>
              <select
                value={config.conflictStrategy}
                onChange={(e) => setConfig(prev => ({ ...prev, conflictStrategy: e.target.value as any }))}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="newest-wins">Newest file wins</option>
                <option value="local-wins">Local file wins</option>
                <option value="remote-wins">Remote file wins</option>
                <option value="manual">Manual resolution</option>
              </select>
            </div>

            {/* Exclude Patterns */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Exclude Patterns</label>
              <div className="flex gap-2">
                <Input
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && patternType === 'exclude' && addPattern()}
                  placeholder="e.g., node_modules"
                />
                <Button
                  size="sm"
                  variant={patternType === 'exclude' ? 'default' : 'outline'}
                  onClick={() => setPatternType('exclude')}
                >
                  Exclude
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {config.excludePatterns.map((pattern) => (
                  <Badge
                    key={pattern}
                    variant="secondary"
                    className="text-xs cursor-pointer gap-1"
                    onClick={() => removePattern(pattern, 'exclude')}
                  >
                    {pattern}
                    <X size={12} />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={config.deleteExtraneous}
                  onCheckedChange={(v) => setConfig(prev => ({ ...prev, deleteExtraneous: v as boolean }))}
                />
                Delete extraneous files on destination
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={config.preservePermissions}
                  onCheckedChange={(v) => setConfig(prev => ({ ...prev, preservePermissions: v as boolean }))}
                />
                Preserve file permissions
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfig(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowConfig(false)}>
              <Check className="w-4 h-4 mr-2" />
              Save Config
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
