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
export interface WatcherOptions {
    pollIntervalMs: number;
    onChange: (changes: FileChange[]) => void;
    onError?: (error: Error) => void;
}
/**
 * Workspace File Watcher for Gizzi
 */
export declare class WorkspaceWatcher {
    private agentId;
    private basePath;
    private fs;
    private options;
    private intervalId;
    private watchedFiles;
    private isWatching;
    constructor(agentId: string, basePath: string, fs: FileSystem, options?: Partial<WatcherOptions>);
    /**
     * Start watching for changes
     */
    start(): Promise<void>;
    /**
     * Stop watching
     */
    stop(): void;
    /**
     * Get current watch status
     */
    getStatus(): {
        isWatching: boolean;
        filesWatched: number;
    };
    /**
     * Force a manual refresh
     */
    refresh(): Promise<FileChange[]>;
    /**
     * Scan workspace for files
     */
    private scanWorkspace;
    /**
     * Check for changes
     */
    private checkForChanges;
}
/**
 * Get or create a watcher for an agent
 */
export declare function getWorkspaceWatcher(agentId: string, basePath: string, fs: FileSystem, options?: Partial<WatcherOptions>): WorkspaceWatcher;
/**
 * Stop all watchers
 */
export declare function stopAllWatchers(): void;
export declare const workspaceWatcher: {
    watchers: Map<string, WorkspaceWatcher>;
    getWatcher: typeof getWorkspaceWatcher;
    stopAll: typeof stopAllWatchers;
};
