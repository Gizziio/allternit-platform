/**
 * @fileoverview Allternit File Sync System - File System Watcher
 *
 * High-performance file system watcher with debouncing, batching, and
 * cross-platform support. Uses chokidar when available, falls back to
 * native fs.watch with polling.
 *
 * Features:
 * - Debounced change notifications (prevents rapid-fire events)
 * - Batched event processing for efficiency
 * - Exclusion pattern support
 * - Platform-specific optimizations
 * - Graceful degradation on limited platforms
 *
 * @module watcher
 */

import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Type of file system event
 */
export type FileEventType = "create" | "modify" | "delete" | "rename";

/**
 * File system event
 */
export interface FileEvent {
  /** Type of event */
  type: FileEventType;
  /** Absolute path of the file/directory */
  path: string;
  /** Relative path from watch root */
  relativePath: string;
  /** File stats (if available) */
  stats?: fs.Stats;
  /** Previous path for rename events */
  previousPath?: string;
  /** Timestamp of the event */
  timestamp: number;
}

/**
 * Watch options
 */
export interface WatchOptions {
  /** Debounce interval in milliseconds (default: 100) */
  debounceMs?: number;
  /** Batch size for event processing (default: 100) */
  batchSize?: number;
  /** Patterns to exclude from watching */
  exclude?: string[];
  /** Enable recursive watching (default: true) */
  recursive?: boolean;
  /** Polling interval for fallback mode in milliseconds (default: 500) */
  pollingInterval?: number;
  /** Follow symlinks (default: false) */
  followSymlinks?: boolean;
  /** Ignore initial add events (default: true) */
  ignoreInitial?: boolean;
  /** Maximum depth for recursive watching (default: Infinity) */
  depth?: number;
}

/**
 * Watcher state
 */
enum WatcherState {
  IDLE = "idle",
  WATCHING = "watching",
  STOPPING = "stopping",
  STOPPED = "stopped",
  ERROR = "error",
}

/**
 * Internal event queue entry
 */
interface QueuedEvent {
  type: FileEventType;
  path: string;
  stats?: fs.Stats;
  previousPath?: string;
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Error codes for watcher operations
 */
export enum WatcherErrorCode {
  INVALID_PATH = "INVALID_PATH",
  ALREADY_WATCHING = "ALREADY_WATCHING",
  WATCH_FAILED = "WATCH_FAILED",
  PLATFORM_UNSUPPORTED = "PLATFORM_UNSUPPORTED",
  NOT_WATCHING = "NOT_WATCHING",
}

/**
 * Error thrown by the file watcher
 */
export class WatcherError extends Error {
  constructor(
    public readonly code: WatcherErrorCode,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "WatcherError";
    Error.captureStackTrace?.(this, WatcherError);
  }
}

// ============================================================================
// Main FileWatcher Class
// ============================================================================

/**
 * File system watcher with debouncing and batching.
 *
 * Watches directories for changes and emits batched events after debouncing.
 * Supports both native fs.watch and polling-based watching.
 *
 * @example
 * ```typescript
 * const watcher = new FileWatcher({
 *   debounceMs: 100,
 *   exclude: ["node_modules", ".git"],
 * });
 *
 * watcher.onChange((events) => {
 *   console.log(`Detected ${events.length} changes`);
 *   for (const event of events) {
 *     console.log(`${event.type}: ${event.relativePath}`);
 *   }
 * });
 *
 * await watcher.watch("/path/to/watch");
 * ```
 */
export class FileWatcher extends EventEmitter {
  private options: Required<WatchOptions>;
  private state: WatcherState = WatcherState.IDLE;
  private watchPath?: string;
  private nativeWatchers: Map<string, fs.FSWatcher> = new Map();
  private pollTimer?: NodeJS.Timeout;
  private debounceTimer?: NodeJS.Timeout;
  private eventQueue: QueuedEvent[] = [];
  private fileState: Map<string, { mtime: number; size: number }> = new Map();
  private changeCallback?: (events: FileEvent[]) => void;

  /**
   * Create a new FileWatcher instance
   * @param options - Watch configuration options
   */
  constructor(options: WatchOptions = {}) {
    super();
    this.options = {
      debounceMs: 100,
      batchSize: 100,
      exclude: [],
      recursive: true,
      pollingInterval: 500,
      followSymlinks: false,
      ignoreInitial: true,
      depth: Infinity,
      ...options,
    };
  }

  /**
   * Start watching a directory path
   *
   * @param watchPath - Absolute path to watch
   * @throws {WatcherError} If path is invalid or watching fails
   */
  async watch(watchPath: string): Promise<void> {
    if (this.state === WatcherState.WATCHING) {
      throw new WatcherError(
        WatcherErrorCode.ALREADY_WATCHING,
        `Already watching: ${this.watchPath}`
      );
    }

    if (!path.isAbsolute(watchPath)) {
      throw new WatcherError(
        WatcherErrorCode.INVALID_PATH,
        `Path must be absolute: ${watchPath}`
      );
    }

    // Verify path exists
    try {
      const stats = await fs.promises.stat(watchPath);
      if (!stats.isDirectory()) {
        throw new WatcherError(
          WatcherErrorCode.INVALID_PATH,
          `Path is not a directory: ${watchPath}`
        );
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new WatcherError(
          WatcherErrorCode.INVALID_PATH,
          `Path does not exist: ${watchPath}`
        );
      }
      throw new WatcherError(
        WatcherErrorCode.WATCH_FAILED,
        `Failed to access path: ${(error as Error).message}`,
        error as Error
      );
    }

    this.watchPath = watchPath;
    this.state = WatcherState.WATCHING;

    try {
      // Try native watching first
      const nativeSupported = await this.tryNativeWatch(watchPath);

      if (!nativeSupported) {
        // Fall back to polling
        this.startPolling(watchPath);
      }

      // Scan initial state if not ignoring initial
      if (!this.options.ignoreInitial) {
        await this.scanInitialState(watchPath);
      }

      this.emit("ready", { path: watchPath });
    } catch (error) {
      this.state = WatcherState.ERROR;
      throw new WatcherError(
        WatcherErrorCode.WATCH_FAILED,
        `Failed to start watching: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    if (this.state === WatcherState.STOPPED || this.state === WatcherState.IDLE) {
      return;
    }

    this.state = WatcherState.STOPPING;

    // Clear timers
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }

    // Close all native watchers
    const closePromises = Array.from(this.nativeWatchers.values()).map(
      (watcher) =>
        new Promise<void>((resolve) => {
          watcher.close();
          resolve();
        })
    );
    await Promise.all(closePromises);
    this.nativeWatchers.clear();

    // Process any remaining queued events
    if (this.eventQueue.length > 0) {
      this.processEventQueue();
    }

    this.state = WatcherState.STOPPED;
    this.watchPath = undefined;
    this.fileState.clear();

    this.emit("stop");
  }

  /**
   * Register change callback
   *
   * @param callback - Function called with batched file events
   */
  onChange(callback: (events: FileEvent[]) => void): void {
    this.changeCallback = callback;
  }

  /**
   * Get current watcher state
   */
  getState(): WatcherState {
    return this.state;
  }

  /**
   * Check if currently watching
   */
  get isWatching(): boolean {
    return this.state === WatcherState.WATCHING;
  }

  /**
   * Get the path being watched
   */
  get watchedPath(): string | undefined {
    return this.watchPath;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Try to use native fs.watch
   */
  private async tryNativeWatch(watchPath: string): Promise<boolean> {
    // On some platforms, recursive watching is not supported
    const canRecurse = process.platform === "darwin" || process.platform === "win32";

    try {
      if (this.options.recursive && canRecurse) {
        // Use single recursive watcher
        const watcher = fs.watch(
          watchPath,
          { recursive: true },
          (eventType, filename) => {
            if (filename) {
              const fullPath = path.join(watchPath, filename);
              this.handleNativeEvent(
                eventType as "rename" | "change",
                fullPath
              );
            }
          }
        );

        this.nativeWatchers.set(watchPath, watcher);
      } else if (this.options.recursive) {
        // Manual recursion for Linux
        await this.watchRecursively(watchPath, 0);
      } else {
        // Non-recursive watch
        const watcher = fs.watch(watchPath, (eventType, filename) => {
          if (filename) {
            const fullPath = path.join(watchPath, filename);
            this.handleNativeEvent(eventType as "rename" | "change", fullPath);
          }
        });

        this.nativeWatchers.set(watchPath, watcher);
      }

      // Set up error handling for all watchers
      for (const [path, watcher] of this.nativeWatchers) {
        watcher.on("error", (error) => {
          this.emit("error", new WatcherError(
            WatcherErrorCode.WATCH_FAILED,
            `Watcher error for ${path}: ${error.message}`,
            error
          ));
        });

        watcher.on("close", () => {
          this.nativeWatchers.delete(path);
        });
      }

      return true;
    } catch (error) {
      // Clean up any partial watchers
      for (const watcher of this.nativeWatchers.values()) {
        watcher.close();
      }
      this.nativeWatchers.clear();
      return false;
    }
  }

  /**
   * Recursively set up watchers for directories
   */
  private async watchRecursively(
    dirPath: string,
    depth: number
  ): Promise<void> {
    if (depth > this.options.depth) {
      return;
    }

    const relativePath = path.relative(this.watchPath!, dirPath);
    if (this.isExcluded(relativePath)) {
      return;
    }

    try {
      const watcher = fs.watch(dirPath, (eventType, filename) => {
        if (filename) {
          const fullPath = path.join(dirPath, filename);
          this.handleNativeEvent(eventType as "rename" | "change", fullPath);
        }
      });

      this.nativeWatchers.set(dirPath, watcher);

      // Recurse into subdirectories
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subPath = path.join(dirPath, entry.name);
          const subRelative = path.relative(this.watchPath!, subPath);
          if (!this.isExcluded(subRelative)) {
            await this.watchRecursively(subPath, depth + 1);
          }
        }
      }
    } catch (error) {
      // Directory might have been deleted or permission denied
      this.emit("error", {
        path: dirPath,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Handle native fs.watch event
   */
  private handleNativeEvent(
    eventType: "rename" | "change",
    fullPath: string
  ): void {
    const relativePath = path.relative(this.watchPath!, fullPath);

    if (this.isExcluded(relativePath)) {
      return;
    }

    // Determine event type
    let type: FileEventType;

    if (eventType === "rename") {
      // rename event could be create or delete
      // We'll determine this in the debounced handler
      type = "create";
    } else {
      type = "modify";
    }

    this.queueEvent({
      type,
      path: fullPath,
    });
  }

  /**
   * Start polling-based watching
   */
  private startPolling(watchPath: string): void {
    this.pollTimer = setInterval(async () => {
      await this.pollDirectory(watchPath);
    }, this.options.pollingInterval);
  }

  /**
   * Poll a directory for changes
   */
  private async pollDirectory(dirPath: string): Promise<void> {
    const currentState = new Map<string, { mtime: number; size: number }>();
    const changes: QueuedEvent[] = [];

    const scanDir = async (currentPath: string): Promise<void> => {
      const relativePath = path.relative(this.watchPath!, currentPath);
      if (this.isExcluded(relativePath)) {
        return;
      }

      try {
        const entries = await fs.promises.readdir(currentPath, {
          withFileTypes: true,
        });

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          const entryRelativePath = path.relative(this.watchPath!, fullPath);

          if (this.isExcluded(entryRelativePath)) {
            continue;
          }

          if (entry.isDirectory()) {
            if (this.options.recursive) {
              await scanDir(fullPath);
            }
          } else if (entry.isFile()) {
            try {
              const stats = await fs.promises.stat(fullPath);
              const key = entryRelativePath;
              const state = { mtime: stats.mtime.getTime(), size: stats.size };
              currentState.set(key, state);

              const prevState = this.fileState.get(key);
              if (!prevState) {
                // New file
                changes.push({ type: "create", path: fullPath, stats });
              } else if (
                prevState.mtime !== state.mtime ||
                prevState.size !== state.size
              ) {
                // Modified file
                changes.push({ type: "modify", path: fullPath, stats });
              }
            } catch {
              // File might have been deleted
            }
          }
        }
      } catch {
        // Directory might have been deleted
      }
    };

    await scanDir(dirPath);

    // Check for deleted files
    for (const [key, state] of this.fileState) {
      if (!currentState.has(key)) {
        changes.push({
          type: "delete",
          path: path.join(this.watchPath!, key),
        });
      }
    }

    // Update state
    this.fileState = currentState;

    // Queue changes
    for (const change of changes) {
      this.queueEvent(change);
    }
  }

  /**
   * Scan initial file state
   */
  private async scanInitialState(watchPath: string): Promise<void> {
    const scanDir = async (dirPath: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(dirPath, {
          withFileTypes: true,
        });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          const relativePath = path.relative(watchPath, fullPath);

          if (this.isExcluded(relativePath)) {
            continue;
          }

          if (entry.isDirectory()) {
            if (this.options.recursive) {
              await scanDir(fullPath);
            }
          } else if (entry.isFile()) {
            try {
              const stats = await fs.promises.stat(fullPath);
              this.fileState.set(relativePath, {
                mtime: stats.mtime.getTime(),
                size: stats.size,
              });
            } catch {
              // Ignore errors for individual files
            }
          }
        }
      } catch {
        // Directory might not be accessible
      }
    };

    await scanDir(watchPath);
  }

  /**
   * Queue an event for debounced processing
   */
  private queueEvent(event: QueuedEvent): void {
    // Check for duplicate events and update if needed
    const existingIndex = this.eventQueue.findIndex(
      (e) => e.path === event.path && e.type === event.type
    );

    if (existingIndex >= 0) {
      // Update existing event with newer info
      this.eventQueue[existingIndex] = event;
    } else {
      this.eventQueue.push(event);
    }

    // Reset debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processEventQueue();
    }, this.options.debounceMs);
  }

  /**
   * Process queued events
   */
  private async processEventQueue(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    // Take current queue and clear it
    const events = [...this.eventQueue];
    this.eventQueue = [];

    // Determine actual event types (create vs delete for rename events)
    const processedEvents: FileEvent[] = [];

    for (const event of events) {
      let type = event.type;

      // Check if file exists to determine create vs delete
      if (event.type === "create") {
        try {
          await fs.promises.access(event.path);
          type = "create";
        } catch {
          type = "delete";
        }
      }

      // Get stats for create/modify events
      let stats: fs.Stats | undefined;
      if (type === "create" || type === "modify") {
        try {
          stats = await fs.promises.stat(event.path);
        } catch {
          // File might have been deleted
          if (type === "modify") {
            type = "delete";
          }
        }
      }

      processedEvents.push({
        type,
        path: event.path,
        relativePath: path.relative(this.watchPath!, event.path),
        stats,
        timestamp: Date.now(),
      });
    }

    // Batch if needed
    const batchSize = this.options.batchSize;
    for (let i = 0; i < processedEvents.length; i += batchSize) {
      const batch = processedEvents.slice(i, i + batchSize);

      // Call the registered callback
      if (this.changeCallback) {
        try {
          this.changeCallback(batch);
        } catch (error) {
          this.emit("error", {
            message: "Change callback error",
            error,
          });
        }
      }

      // Also emit as event
      this.emit("change", batch);
    }
  }

  /**
   * Check if a path matches exclusion patterns
   */
  private isExcluded(relativePath: string): boolean {
    for (const pattern of this.options.exclude) {
      // Simple string matching
      if (relativePath.includes(pattern)) {
        return true;
      }

      // Glob pattern matching
      const regexPattern = pattern
        .replace(/\*\*/g, "{{GLOBSTAR}}")
        .replace(/\*/g, "[^/]*")
        .replace(/\?/g, "[^/]")
        .replace(/\{\{GLOBSTAR\}\}/g, ".*");

      const regex = new RegExp(regexPattern);
      if (regex.test(relativePath)) {
        return true;
      }
    }
    return false;
  }
}

export { WatcherState };
export default FileWatcher;
