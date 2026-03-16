/**
 * File Conflict Panel
 * 
 * Displays file lock status and conflicts:
 * - List of locked files
 * - Which agent holds each lock
 * - Conflict detection visualization
 * - Lock duration and stale lock warnings
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FileLock,
  AlertTriangle,
  Unlock,
  Clock,
  User,
  RefreshCw,
  File,
} from 'lucide-react';
import type { FileLock as FileLockType } from '../types';
import { metaSwarmClient } from '../api';

interface FileConflictPanelProps {
  className?: string;
}

function getLockDuration(lockedAt: string): string {
  const locked = new Date(lockedAt);
  const now = new Date();
  const diffMs = now.getTime() - locked.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffSecs = Math.floor((diffMs % 60000) / 1000);
  
  if (diffMins > 0) {
    return `${diffMins}m ${diffSecs}s`;
  }
  return `${diffSecs}s`;
}

function isStaleLock(lockedAt: string): boolean {
  const locked = new Date(lockedAt);
  const now = new Date();
  const diffMs = now.getTime() - locked.getTime();
  const diffMins = diffMs / 60000;
  return diffMins > 5; // Consider locks stale after 5 minutes
}

export function FileConflictPanel({ className }: FileConflictPanelProps) {
  const [fileLocks, setFileLocks] = useState<FileLockType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFileLocks = async () => {
    try {
      setLoading(true);
      setError(null);
      const locks = await metaSwarmClient.getFileLocks();
      setFileLocks(locks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch file locks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFileLocks();

    // Subscribe to file lock updates
    const handleUpdate = (locks: FileLockType[]) => {
      setFileLocks(locks);
    };

    metaSwarmClient.onFileLocksUpdate(handleUpdate);

    return () => {
      metaSwarmClient.removeHandler('file_locks', handleUpdate);
    };
  }, []);

  // Check for conflicts (multiple agents waiting for same file)
  const potentialConflicts = fileLocks.reduce((acc, lock) => {
    const existing = acc.find((item) => item.file_path === lock.file_path);
    if (existing) {
      existing.agents.push(lock.agent_id.id);
    } else {
      acc.push({
        file_path: lock.file_path,
        agents: [lock.agent_id.id],
      });
    }
    return acc;
  }, [] as Array<{ file_path: string; agents: string[] }>);

  const conflicts = potentialConflicts.filter((c) => c.agents.length > 1);
  const staleLocks = fileLocks.filter((lock) => isStaleLock(lock.locked_at));

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileLock className="h-5 w-5" />
            File Locks
          </div>
          <div className="flex items-center gap-2">
            {conflicts.length > 0 && (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {conflicts.length} Conflicts
              </Badge>
            )}
            {staleLocks.length > 0 && (
              <Badge variant="secondary">
                <Clock className="h-3 w-3 mr-1" />
                {staleLocks.length} Stale
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchFileLocks}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {conflicts.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {conflicts.length} file(s) have contention between agents
            </AlertDescription>
          </Alert>
        )}

        {staleLocks.length > 0 && (
          <Alert className="border-yellow-500 text-yellow-600">
            <Clock className="h-4 w-4" />
            <AlertDescription>
              {staleLocks.length} lock(s) are stale (held &gt; 5 minutes)
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {fileLocks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <File className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No files currently locked</p>
            </div>
          ) : (
            fileLocks.map((lock) => {
              const isStale = isStaleLock(lock.locked_at);
              const hasConflict = conflicts.some((c) =>
                c.file_path === lock.file_path
              );

              return (
                <div
                  key={`${lock.file_path}-${lock.agent_id.id}`}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    hasConflict
                      ? 'border-red-500 bg-red-50'
                      : isStale
                      ? 'border-yellow-500 bg-yellow-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {hasConflict ? (
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    ) : isStale ? (
                      <Clock className="h-5 w-5 text-yellow-500" />
                    ) : (
                      <FileLock className="h-5 w-5 text-blue-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <File className="h-4 w-4 flex-shrink-0" />
                      <span className="font-medium truncate" title={lock.file_path}>
                        {lock.file_path.split('/').pop()}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {lock.file_path}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs">
                      <User className="h-3 w-3" />
                      <span className="font-mono">{lock.agent_id.id.slice(0, 8)}</span>
                      <Clock className="h-3 w-3 ml-2" />
                      <span>{getLockDuration(lock.locked_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasConflict && (
                      <Badge variant="destructive" className="text-xs">
                        Conflict
                      </Badge>
                    )}
                    {isStale && (
                      <Badge variant="secondary" className="text-xs">
                        Stale
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Unlock className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {fileLocks.length > 0 && (
          <div className="text-xs text-muted-foreground text-center">
            {fileLocks.length} file(s) locked by {new Set(fileLocks.map((l) => l.agent_id.id)).size} agent(s)
          </div>
        )}
      </CardContent>
    </Card>
  );
}
