/**
 * Agent Workspace File Watcher
 * 
 * Monitors agent workspace files for changes and triggers context refresh.
 * Uses polling for cross-platform compatibility.
 */

import { agentWorkspaceFS, AgentWorkspace } from './agent-workspace-files';

export interface FileWatcherOptions {
  // Polling interval in milliseconds
  pollIntervalMs: number;
  // Callback when files change
  onChange: (changes: FileChange[]) => void;
  // Callback when errors occur
  onError?: (error: Error) => void;
  // File patterns to watch (glob patterns)
  patterns?: string[];
}

export interface FileChange {
  path: string;
  type: 'created' | 'modified' | 'deleted';
  previousModTime?: Date;
  currentModTime?: Date;
}

interface WatchedFile {
  path: string;
  lastModified: Date;
  size: number;
}

/**
 * Workspace File Watcher
 * 
 * Watches an agent's workspace directory for changes.
 */
export class WorkspaceFileWatcher {
  private agentId: string;
  private options: FileWatcherOptions;
  private intervalId: NodeJS.Timeout | null = null;
  private watchedFiles = new Map<string, WatchedFile>();
  private isWatching = false;
  private lastWorkspace: AgentWorkspace | null = null;

  constructor(agentId: string, options: Partial<FileWatcherOptions> = {}) {
    this.agentId = agentId;
    this.options = {
      pollIntervalMs: 5000, // Default 5 seconds
      onChange: () => {},
      ...options,
    };
  }

  /**
   * Start watching for changes
   */
  async start(): Promise<void> {
    if (this.isWatching) {
      console.log(`[WorkspaceWatcher] Already watching ${this.agentId}`);
      return;
    }

    // Initial scan
    try {
      await this.scanWorkspace();
    } catch (error) {
      console.error(`[WorkspaceWatcher] Initial scan failed:`, error);
      this.options.onError?.(error as Error);
      return;
    }

    // Start polling
    this.isWatching = true;
    this.intervalId = setInterval(() => {
      this.checkForChanges().catch((error) => {
        console.error(`[WorkspaceWatcher] Check failed:`, error);
        this.options.onError?.(error);
      });
    }, this.options.pollIntervalMs);

    console.log(`[WorkspaceWatcher] Started watching ${this.agentId} (${this.options.pollIntervalMs}ms interval)`);
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isWatching = false;
    console.log(`[WorkspaceWatcher] Stopped watching ${this.agentId}`);
  }

  /**
   * Get current watch status
   */
  getStatus(): {
    isWatching: boolean;
    filesWatched: number;
    lastScan?: Date;
  } {
    return {
      isWatching: this.isWatching,
      filesWatched: this.watchedFiles.size,
    };
  }

  /**
   * Force a manual refresh
   */
  async refresh(): Promise<FileChange[]> {
    return this.checkForChanges();
  }

  /**
   * Initial workspace scan
   */
  private async scanWorkspace(): Promise<void> {
    const workspace = await agentWorkspaceFS.loadWorkspace(this.agentId);
    
    if (!workspace) {
      throw new Error(`Workspace not found for agent ${this.agentId}`);
    }

    this.lastWorkspace = workspace;
    this.watchedFiles.clear();

    for (const file of workspace.files) {
      this.watchedFiles.set(file.path, {
        path: file.path,
        lastModified: file.lastModified,
        size: file.content.length,
      });
    }
  }

  /**
   * Check for changes
   */
  private async checkForChanges(): Promise<FileChange[]> {
    // Invalidate cache to force reload
    agentWorkspaceFS.invalidateCache(this.agentId);
    
    const workspace = await agentWorkspaceFS.loadWorkspace(this.agentId);
    
    if (!workspace) {
      // Workspace was deleted
      if (this.lastWorkspace) {
        const changes: FileChange[] = Array.from(this.watchedFiles.values()).map(f => ({
          path: f.path,
          type: 'deleted',
          previousModTime: f.lastModified,
        }));
        
        this.watchedFiles.clear();
        this.lastWorkspace = null;
        this.options.onChange(changes);
        return changes;
      }
      return [];
    }

    const changes: FileChange[] = [];
    const currentFiles = new Map<string, WatchedFile>();

    // Check each file in workspace
    for (const file of workspace.files) {
      const previousFile = this.watchedFiles.get(file.path);
      currentFiles.set(file.path, {
        path: file.path,
        lastModified: file.lastModified,
        size: file.content.length,
      });

      if (!previousFile) {
        // New file
        changes.push({
          path: file.path,
          type: 'created',
          currentModTime: file.lastModified,
        });
      } else if (file.lastModified.getTime() !== previousFile.lastModified.getTime()) {
        // Modified file
        changes.push({
          path: file.path,
          type: 'modified',
          previousModTime: previousFile.lastModified,
          currentModTime: file.lastModified,
        });
      }
    }

    // Check for deleted files
    for (const [path, file] of this.watchedFiles) {
      if (!currentFiles.has(path)) {
        changes.push({
          path,
          type: 'deleted',
          previousModTime: file.lastModified,
        });
      }
    }

    // Update state
    this.watchedFiles = currentFiles;
    this.lastWorkspace = workspace;

    // Notify if changes detected
    if (changes.length > 0) {
      console.log(`[WorkspaceWatcher] Detected ${changes.length} changes in ${this.agentId}:`,
        changes.map(c => `${c.type}:${c.path}`).join(', '));
      this.options.onChange(changes);
    }

    return changes;
  }
}

// Global watcher registry
const watchers = new Map<string, WorkspaceFileWatcher>();

/**
 * Get or create a watcher for an agent
 */
export function getWorkspaceWatcher(
  agentId: string,
  options?: Partial<FileWatcherOptions>
): WorkspaceFileWatcher {
  if (!watchers.has(agentId)) {
    watchers.set(agentId, new WorkspaceFileWatcher(agentId, options));
  }
  return watchers.get(agentId)!;
}

/**
 * Start watching all agent workspaces
 */
export async function startAllWatchers(
  agentIds: string[],
  options?: Partial<FileWatcherOptions>
): Promise<void> {
  for (const agentId of agentIds) {
    const watcher = getWorkspaceWatcher(agentId, options);
    await watcher.start();
  }
}

/**
 * Stop all watchers
 */
export function stopAllWatchers(): void {
  for (const [agentId, watcher] of watchers) {
    watcher.stop();
  }
  watchers.clear();
}

/**
 * React hook for workspace watching
 */
export function useWorkspaceWatcher(
  agentId: string | null,
  options?: Partial<FileWatcherOptions>
): {
  isWatching: boolean;
  filesWatched: number;
  lastChanges: FileChange[];
  refresh: () => Promise<FileChange[]>;
  start: () => Promise<void>;
  stop: () => void;
} {
  const [isWatching, setIsWatching] = React.useState(false);
  const [filesWatched, setFilesWatched] = React.useState(0);
  const [lastChanges, setLastChanges] = React.useState<FileChange[]>([]);

  // Import React
  const { useState, useEffect, useCallback } = React;

  useEffect(() => {
    if (!agentId) return;

    const watcher = getWorkspaceWatcher(agentId, {
      ...options,
      onChange: (changes) => {
        setLastChanges(changes);
        options?.onChange?.(changes);
      },
    });

    watcher.start().then(() => {
      setIsWatching(true);
      setFilesWatched(watcher.getStatus().filesWatched);
    });

    return () => {
      watcher.stop();
      setIsWatching(false);
    };
  }, [agentId]);

  const refresh = useCallback(async () => {
    if (!agentId) return [];
    const watcher = getWorkspaceWatcher(agentId);
    const changes = await watcher.refresh();
    setFilesWatched(watcher.getStatus().filesWatched);
    return changes;
  }, [agentId]);

  const start = useCallback(async () => {
    if (!agentId) return;
    const watcher = getWorkspaceWatcher(agentId, options);
    await watcher.start();
    setIsWatching(true);
    setFilesWatched(watcher.getStatus().filesWatched);
  }, [agentId]);

  const stop = useCallback(() => {
    if (!agentId) return;
    const watcher = getWorkspaceWatcher(agentId);
    watcher.stop();
    setIsWatching(false);
  }, [agentId]);

  return {
    isWatching,
    filesWatched,
    lastChanges,
    refresh,
    start,
    stop,
  };
}

// Auto-refresh integration for session stores
import { ModeSession } from './mode-session-store';

export interface AutoRefreshConfig {
  // Debounce time in ms
  debounceMs: number;
  // Callback when context should be refreshed
  onRefreshNeeded: (session: ModeSession, changes: FileChange[]) => void;
}

/**
 * Setup auto-refresh for a session
 */
export function setupSessionAutoRefresh(
  session: ModeSession,
  config: Partial<AutoRefreshConfig> = {}
): () => void {
  if (!session.metadata.agentId) {
    return () => {}; // No cleanup needed
  }

  const fullConfig: AutoRefreshConfig = {
    debounceMs: 1000,
    onRefreshNeeded: () => {},
    ...config,
  };

  let debounceTimer: NodeJS.Timeout | null = null;

  const watcher = getWorkspaceWatcher(session.metadata.agentId, {
    pollIntervalMs: 5000,
    onChange: (changes) => {
      // Debounce rapid changes
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        console.log(`[AutoRefresh] Workspace changed for session ${session.id}, refreshing context`);
        fullConfig.onRefreshNeeded(session, changes);
      }, fullConfig.debounceMs);
    },
  });

  watcher.start();

  // Return cleanup function
  return () => {
    watcher.stop();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  };
}

// Need to import React at the end to avoid circular issues
import React from 'react';
