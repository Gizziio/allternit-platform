/**
 * Gizzi Workspace File Watcher
 * 
 * Monitors agent workspace files for changes and triggers context refresh.
 */

import type { FileSystem } from '../workspace/loader';

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

export interface WatcherOptions {
  pollIntervalMs: number;
  onChange: (changes: FileChange[]) => void;
  onError?: (error: Error) => void;
}

/**
 * Workspace File Watcher for Gizzi
 */
export class WorkspaceWatcher {
  private agentId: string;
  private basePath: string;
  private fs: FileSystem;
  private options: WatcherOptions;
  private intervalId: NodeJS.Timeout | null = null;
  private watchedFiles = new Map<string, WatchedFile>();
  private isWatching = false;

  constructor(
    agentId: string,
    basePath: string,
    fs: FileSystem,
    options: Partial<WatcherOptions> = {}
  ) {
    this.agentId = agentId;
    this.basePath = basePath;
    this.fs = fs;
    this.options = {
      pollIntervalMs: 5000,
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
   * Scan workspace for files
   */
  private async scanWorkspace(): Promise<void> {
    this.watchedFiles.clear();

    const entries = await this.fs.listDirectory(this.basePath);

    for (const entry of entries) {
      if (entry.type === 'file') {
        const filePath = `${this.basePath}/${entry.name}`;
        try {
          const content = await this.fs.readFile(filePath);
          this.watchedFiles.set(entry.name, {
            path: entry.name,
            lastModified: new Date(), // We don't have actual mtime from FileSystem interface
            size: content.length,
          });
        } catch {
          // Skip files we can't read
        }
      }
    }
  }

  /**
   * Check for changes
   */
  private async checkForChanges(): Promise<FileChange[]> {
    const changes: FileChange[] = [];
    const currentFiles = new Map<string, WatchedFile>();

    try {
      const entries = await this.fs.listDirectory(this.basePath);

      for (const entry of entries) {
        if (entry.type !== 'file') continue;

        const filePath = `${this.basePath}/${entry.name}`;
        
        try {
          const content = await this.fs.readFile(filePath);
          const previousFile = this.watchedFiles.get(entry.name);
          
          currentFiles.set(entry.name, {
            path: entry.name,
            lastModified: new Date(),
            size: content.length,
          });

          if (!previousFile) {
            // New file
            changes.push({
              path: entry.name,
              type: 'created',
              currentModTime: new Date(),
            });
          } else if (content.length !== previousFile.size) {
            // Modified file (using size as proxy for modification)
            changes.push({
              path: entry.name,
              type: 'modified',
              previousModTime: previousFile.lastModified,
              currentModTime: new Date(),
            });
          }
        } catch {
          // Skip files we can't read
        }
      }

      // Check for deleted files
      for (const [name, file] of this.watchedFiles) {
        if (!currentFiles.has(name)) {
          changes.push({
            path: name,
            type: 'deleted',
            previousModTime: file.lastModified,
          });
        }
      }

      // Update state
      this.watchedFiles = currentFiles;

      // Notify if changes detected
      if (changes.length > 0) {
        console.log(`[WorkspaceWatcher] Detected ${changes.length} changes in ${this.agentId}:`,
          changes.map(c => `${c.type}:${c.path}`).join(', '));
        this.options.onChange(changes);
      }
    } catch (error) {
      console.error(`[WorkspaceWatcher] Failed to check for changes:`, error);
      this.options.onError?.(error as Error);
    }

    return changes;
  }
}

// Global watcher registry
const watchers = new Map<string, WorkspaceWatcher>();

/**
 * Get or create a watcher for an agent
 */
export function getWorkspaceWatcher(
  agentId: string,
  basePath: string,
  fs: FileSystem,
  options?: Partial<WatcherOptions>
): WorkspaceWatcher {
  if (!watchers.has(agentId)) {
    watchers.set(agentId, new WorkspaceWatcher(agentId, basePath, fs, options));
  }
  return watchers.get(agentId)!;
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

// Export singleton for global access
export const workspaceWatcher = {
  watchers,
  getWatcher: getWorkspaceWatcher,
  stopAll: stopAllWatchers,
};
