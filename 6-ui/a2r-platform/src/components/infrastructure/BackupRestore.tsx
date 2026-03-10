/**
 * Backup & Restore Component
 * 
 * Manage environment backups:
 * - Create manual and scheduled backups
 * - Restore from backup points
 * - Backup retention policies
 * - Export/import backups
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Archive,
  RotateCcw,
  Download,
  Upload,
  Plus,
  Trash2,
  Clock,
  Calendar,
  Check,
  X,
  Loader2,
  HardDrive,
  Database,
  Settings,
  MoreVertical,
  AlertTriangle,
  Search,
} from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Environment } from '@/api/infrastructure';

export interface Backup {
  id: string;
  name: string;
  environmentId: string;
  createdAt: Date;
  size: number;
  type: 'manual' | 'scheduled' | 'auto';
  status: 'complete' | 'in-progress' | 'failed' | 'restoring';
  includes: ('files' | 'database' | 'config')[];
  retention: number; // days
}

export interface BackupRestoreProps {
  environment: Environment;
  backups: Backup[];
  onBackupCreate: (config: BackupConfig) => Promise<void>;
  onBackupRestore: (backupId: string) => Promise<void>;
  onBackupDelete: (backupId: string) => Promise<void>;
  onBackupExport: (backupId: string) => void;
  className?: string;
}

export interface BackupConfig {
  name: string;
  includes: ('files' | 'database' | 'config')[];
  compression: 'none' | 'gzip' | 'zstd';
  encrypt: boolean;
}

export function BackupRestore({
  environment,
  backups,
  onBackupCreate,
  onBackupRestore,
  onBackupDelete,
  onBackupExport,
  className,
}: BackupRestoreProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [newBackupConfig, setNewBackupConfig] = useState<BackupConfig>({
    name: '',
    includes: ['files', 'config'],
    compression: 'gzip',
    encrypt: false,
  });

  const filteredBackups = backups.filter((backup) =>
    backup.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    backup.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedBackups = [...filteredBackups].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  const handleCreateBackup = async () => {
    setIsProcessing(true);
    setProgress(0);

    // Simulate progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 500);

    try {
      await onBackupCreate(newBackupConfig);
      setTimeout(() => {
        setIsProcessing(false);
        setShowCreateDialog(false);
        setNewBackupConfig({
          name: '',
          includes: ['files', 'config'],
          compression: 'gzip',
          encrypt: false,
        });
      }, 3000);
    } catch (err) {
      setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup) return;
    
    setIsProcessing(true);
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 5;
      });
    }, 500);

    try {
      await onBackupRestore(selectedBackup.id);
      setTimeout(() => {
        setIsProcessing(false);
        setShowRestoreDialog(false);
        setSelectedBackup(null);
      }, 5000);
    } catch (err) {
      setIsProcessing(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getStatusIcon = (status: Backup['status']) => {
    switch (status) {
      case 'complete':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <X className="w-4 h-4 text-red-500" />;
      case 'in-progress':
      case 'restoring':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      default:
        return null;
    }
  };

  const getTypeIcon = (type: Backup['type']) => {
    switch (type) {
      case 'manual':
        return <Archive className="w-4 h-4" />;
      case 'scheduled':
        return <Calendar className="w-4 h-4" />;
      case 'auto':
        return <Clock className="w-4 h-4" />;
      default:
        return <Archive className="w-4 h-4" />;
    }
  };

  const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
  const completedBackups = backups.filter((b) => b.status === 'complete').length;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Archive className="w-4 h-4" />
            Backups & Restore
          </h3>
          <p className="text-xs text-muted-foreground">
            {completedBackups} backups • {formatBytes(totalSize)} total
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Create Backup
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search backups..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Backup List */}
      <ScrollArea className="h-[300px] rounded-lg border">
        <div className="p-2 space-y-2">
          <AnimatePresence>
            {sortedBackups.map((backup) => (
              <motion.div
                key={backup.id}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:border-primary/50 transition-colors"
              >
                <div className="p-2 rounded-lg bg-muted">
                  {getTypeIcon(backup.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{backup.name}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {backup.type}
                    </Badge>
                    {getStatusIcon(backup.status)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span>{formatBytes(backup.size)}</span>
                    <span>•</span>
                    <span>{formatDate(backup.createdAt)}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      {backup.includes.map((inc) => (
                        <span key={inc} className="capitalize">{inc}</span>
                      )).reduce((prev, curr) => [prev, ', ', curr] as any)}
                    </span>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedBackup(backup);
                        setShowRestoreDialog(true);
                      }}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Restore
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onBackupExport(backup.id)}>
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onBackupDelete(backup.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.div>
            ))}
          </AnimatePresence>
          {sortedBackups.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Archive className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">No backups found</p>
              <p className="text-xs">Create your first backup</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Create Backup Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Backup</DialogTitle>
            <DialogDescription>
              Create a backup of {environment.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Backup Name</label>
              <Input
                value={newBackupConfig.name}
                onChange={(e) =>
                  setNewBackupConfig((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder={`Backup ${new Date().toLocaleDateString()}`}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Include</label>
              <div className="space-y-2">
                {(['files', 'database', 'config'] as const).map((type) => (
                  <label key={type} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={newBackupConfig.includes.includes(type)}
                      onCheckedChange={(checked) => {
                        setNewBackupConfig((prev) => ({
                          ...prev,
                          includes: checked
                            ? [...prev.includes, type]
                            : prev.includes.filter((i) => i !== type),
                        }));
                      }}
                    />
                    <span className="capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Compression</label>
              <select
                value={newBackupConfig.compression}
                onChange={(e) =>
                  setNewBackupConfig((prev) => ({
                    ...prev,
                    compression: e.target.value as any,
                  }))
                }
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="none">None</option>
                <option value="gzip">Gzip (balanced)</option>
                <option value="zstd">Zstd (fast)</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Encrypt Backup</label>
                <p className="text-xs text-muted-foreground">
                  Password-protect backup file
                </p>
              </div>
              <Switch
                checked={newBackupConfig.encrypt}
                onCheckedChange={(v) =>
                  setNewBackupConfig((prev) => ({ ...prev, encrypt: v }))
                }
              />
            </div>

            {isProcessing && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-center text-muted-foreground">
                  Creating backup... {progress}%
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateBackup}
              disabled={isProcessing || !newBackupConfig.name}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4 mr-2" />
                  Create Backup
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Restore Backup
            </DialogTitle>
            <DialogDescription>
              This will replace the current state of {environment.name} with the backup from{' '}
              <strong>{selectedBackup?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 space-y-2">
              <h4 className="font-medium text-sm text-yellow-800">Warning</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Current data will be overwritten</li>
                <li>• Running processes will be interrupted</li>
                <li>• This action cannot be undone</li>
              </ul>
            </div>

            {isProcessing && (
              <div className="mt-4 space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-center text-muted-foreground">
                  Restoring backup... {progress}%
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRestoreDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRestore}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restore Backup
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
