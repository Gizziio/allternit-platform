/**
 * @fileoverview Allternit File Sync System - Main Orchestrator
 *
 * Bidirectional file synchronization between host and VM with support for
 * multiple sync modes: VirtioFS (macOS), 9P (Linux), rsync, and inotify/polling.
 *
 * Features:
 * - Directory mapping with configurable direction (bidirectional, host-to-vm, vm-to-host)
 * - Automatic file watching with debouncing
 * - Conflict resolution with multiple strategies
 * - Checksum-based change detection
 * - Parallel transfers with concurrency control
 * - Delta sync for large files
 *
 * @module sync
 */

import { EventEmitter } from "node:events";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createHash } from "node:crypto";
import type { Stats } from "node:fs";
import type { ProtocolClient } from "../protocol/client.js";
import { FileWatcher, type FileEvent, type WatchOptions } from "./watcher.js";
import {
  TransferQueue,
  type TransferTask,
  type TransferResult,
} from "./transfer.js";
import {
  ConflictResolver,
  ConflictStrategy,
  type Conflict,
  type Resolution,
} from "./conflict.js";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Direction of file synchronization
 */
export type SyncDirection = "bidirectional" | "host-to-vm" | "vm-to-host";

/**
 * Sync mode determining the underlying transport mechanism
 */
export type SyncMode = "virtiofs" | "9p" | "rsync" | "polling";

/**
 * Directory mapping configuration for synchronization
 */
export interface SyncMapping {
  /** Absolute path on the host machine */
  hostPath: string;
  /** Absolute path in the VM */
  vmPath: string;
  /** Direction of synchronization */
  direction: SyncDirection;
  /** Patterns to exclude from sync (e.g., ["node_modules", ".git"]) */
  exclude?: string[];
  /** Whether to watch for changes automatically */
  watch?: boolean;
  /** Sync mode override for this mapping */
  mode?: SyncMode;
  /** File size threshold for delta sync in bytes (default: 1MB) */
  deltaThreshold?: number;
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  /** Number of files transferred */
  filesTransferred: number;
  /** Number of files deleted */
  filesDeleted: number;
  /** Number of conflicts detected and resolved */
  conflictsResolved: number;
  /** Number of errors encountered */
  errors: number;
  /** Total bytes transferred */
  bytesTransferred: number;
  /** Duration of sync operation in milliseconds */
  duration: number;
  /** Detailed results per file */
  fileResults: FileSyncResult[];
}

/**
 * Result for a single file sync operation
 */
export interface FileSyncResult {
  /** File path (relative to mapping root) */
  path: string;
  /** Operation performed */
  operation: "upload" | "download" | "delete" | "conflict" | "skip" | "error";
  /** Source side */
  source?: "host" | "vm";
  /** Target side */
  target?: "host" | "vm";
  /** File size in bytes */
  size: number;
  /** Error message if operation failed */
  error?: string;
  /** Resolution strategy used for conflicts */
  resolution?: ConflictStrategy;
}

/**
 * File metadata for comparison
 */
export interface FileMetadata {
  /** Relative path from sync root */
  relativePath: string;
  /** File size in bytes */
  size: number;
  /** Last modification time */
  mtime: Date;
  /** SHA256 checksum */
  checksum: string;
  /** Whether this is a directory */
  isDirectory: boolean;
}

/**
 * Configuration options for FileSync
 */
export interface FileSyncOptions {
  /** Protocol client for VM communication */
  protocolClient: ProtocolClient;
  /** Default conflict resolution strategy */
  strategy?: ConflictStrategy;
  /** Maximum concurrent transfers (default: 3) */
  concurrentTransfers?: number;
  /** Enable compression for transfers (default: true) */
  compression?: boolean;
  /** File size threshold for delta sync in bytes (default: 1MB) */
  deltaThreshold?: number;
  /** Default sync mode */
  defaultMode?: SyncMode;
  /** Polling interval in milliseconds (default: 5000) */
  pollingInterval?: number;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Callback for user prompts on conflicts */
  onConflict?: (conflict: Conflict) => Promise<Resolution>;
}

/**
 * Active sync mapping state
 */
interface ActiveMapping {
  /** Configuration */
  config: SyncMapping;
  /** File watcher instance */
  watcher?: FileWatcher;
  /** Whether initial sync has completed */
  initialSyncComplete: boolean;
  /** Last known file state (checksums) */
  fileState: Map<string, FileMetadata>;
  /** Polling timer for non-watch modes */
  pollTimer?: NodeJS.Timeout;
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Error codes for sync operations
 */
export enum SyncErrorCode {
  INVALID_MAPPING = "INVALID_MAPPING",
  PATH_NOT_FOUND = "PATH_NOT_FOUND",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  TRANSFER_FAILED = "TRANSFER_FAILED",
  CONFLICT_UNRESOLVED = "CONFLICT_UNRESOLVED",
  WATCHER_ERROR = "WATCHER_ERROR",
  VM_ERROR = "VM_ERROR",
}

/**
 * Error thrown by the sync system
 */
export class SyncError extends Error {
  constructor(
    public readonly code: SyncErrorCode,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "SyncError";
    Error.captureStackTrace?.(this, SyncError);
  }
}

// ============================================================================
// Main FileSync Class
// ============================================================================

/**
 * Main file synchronization orchestrator.
 *
 * Manages directory mappings, file watchers, and transfer operations between
 * host and VM. Supports bidirectional sync with configurable conflict resolution.
 *
 * @example
 * ```typescript
 * const sync = new FileSync({
 *   protocolClient: vmClient,
 *   strategy: ConflictStrategy.NEWEST_WINS,
 * });
 *
 * await sync.addMapping({
 *   hostPath: "/Users/alice/myproject",
 *   vmPath: "/workspace/myproject",
 *   direction: "bidirectional",
 *   exclude: ["node_modules", ".git"],
 *   watch: true,
 * });
 *
 * await sync.startWatching();
 * ```
 */
export class FileSync extends EventEmitter {
  private mappings: Map<string, ActiveMapping> = new Map();
  private transferQueue: TransferQueue;
  private conflictResolver: ConflictResolver;
  private options: Required<FileSyncOptions>;
  private isWatching = false;

  /**
   * Create a new FileSync instance
   * @param options - Configuration options
   */
  constructor(options: FileSyncOptions) {
    super();
    this.options = {
      strategy: ConflictStrategy.NEWEST_WINS,
      concurrentTransfers: 3,
      compression: true,
      deltaThreshold: 1024 * 1024, // 1MB
      defaultMode: "polling",
      pollingInterval: 5000,
      verbose: false,
      onConflict: async (conflict) => {
        // Default: use configured strategy
        return this.conflictResolver.resolveWithStrategy(
          conflict,
          this.options.strategy
        );
      },
      ...options,
    };

    this.transferQueue = new TransferQueue({
      protocolClient: this.options.protocolClient,
      concurrent: this.options.concurrentTransfers,
      compression: this.options.compression,
      deltaThreshold: this.options.deltaThreshold,
      verbose: this.options.verbose,
    });

    this.conflictResolver = new ConflictResolver();

    // Forward transfer queue events
    this.transferQueue.on("transfer:complete", (result) => {
      this.emit("transfer:complete", result);
    });

    this.transferQueue.on("transfer:error", (error) => {
      this.emit("transfer:error", error);
    });
  }

  /**
   * Log verbose message if enabled
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.options.verbose) {
      console.log(`[FileSync] ${message}`, ...args);
    }
  }

  /**
   * Add a new directory mapping for synchronization
   *
   * Validates paths, performs initial sync, and sets up file watcher if enabled.
   *
   * @param mapping - Directory mapping configuration
   * @throws {SyncError} If mapping is invalid or paths don't exist
   */
  async addMapping(mapping: SyncMapping): Promise<void> {
    // Validate mapping
    this.validateMapping(mapping);

    // Ensure host path exists
    try {
      await fs.access(mapping.hostPath);
    } catch {
      throw new SyncError(
        SyncErrorCode.PATH_NOT_FOUND,
        `Host path does not exist: ${mapping.hostPath}`
      );
    }

    // Create mapping ID
    const mappingId = this.getMappingId(mapping);

    // Check for existing mapping
    if (this.mappings.has(mappingId)) {
      throw new SyncError(
        SyncErrorCode.INVALID_MAPPING,
        `Mapping already exists: ${mapping.hostPath} -> ${mapping.vmPath}`
      );
    }

    // Initialize active mapping
    const activeMapping: ActiveMapping = {
      config: mapping,
      initialSyncComplete: false,
      fileState: new Map(),
    };

    // Set up watcher if enabled
    if (mapping.watch) {
      await this.setupWatcher(activeMapping);
    }

    this.mappings.set(mappingId, activeMapping);

    this.log(
      `Added mapping: ${mapping.hostPath} -> ${mapping.vmPath} (${mapping.direction})`
    );
    this.emit("mapping:added", { mappingId, mapping });

    // Perform initial sync
    await this.syncOnce(mapping);
    activeMapping.initialSyncComplete = true;
  }

  /**
   * Remove a directory mapping
   *
   * Stops any active watchers and cleans up resources.
   *
   * @param hostPath - Host path of the mapping to remove
   * @param vmPath - VM path of the mapping to remove
   * @returns True if mapping was found and removed
   */
  async removeMapping(hostPath: string, vmPath: string): Promise<boolean> {
    const mappingId = this.getMappingId({ hostPath, vmPath });
    const mapping = this.mappings.get(mappingId);

    if (!mapping) {
      return false;
    }

    // Stop watcher
    if (mapping.watcher) {
      await mapping.watcher.stop();
    }

    // Stop polling
    if (mapping.pollTimer) {
      clearInterval(mapping.pollTimer);
    }

    this.mappings.delete(mappingId);
    this.emit("mapping:removed", { mappingId, hostPath, vmPath });

    return true;
  }

  /**
   * Perform a one-time sync for a mapping
   *
   * Compares files between host and VM, transfers changes, and resolves conflicts.
   *
   * @param mapping - Directory mapping to sync (or registered mapping paths)
   * @returns Sync operation result
   */
  async syncOnce(
    mapping: SyncMapping | { hostPath: string; vmPath: string }
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const fullMapping = this.resolveMapping(mapping);
    const mappingId = this.getMappingId(fullMapping);
    const activeMapping = this.mappings.get(mappingId);

    this.log(`Starting sync: ${fullMapping.hostPath} -> ${fullMapping.vmPath}`);
    this.emit("sync:start", { mappingId, mapping: fullMapping });

    const result: SyncResult = {
      filesTransferred: 0,
      filesDeleted: 0,
      conflictsResolved: 0,
      errors: 0,
      bytesTransferred: 0,
      duration: 0,
      fileResults: [],
    };

    try {
      // Scan host files
      const hostFiles = await this.scanHostDirectory(fullMapping.hostPath, fullMapping.exclude);

      // Scan VM files
      const vmFiles = await this.scanVMDirectory(fullMapping.vmPath, fullMapping.exclude);

      // Compare and determine actions
      const actions = this.compareFiles(hostFiles, vmFiles, fullMapping.direction);

      // Execute transfers
      const transferResults = await this.executeTransfers(actions, fullMapping);

      // Aggregate results
      for (const fileResult of transferResults) {
        result.fileResults.push(fileResult);

        switch (fileResult.operation) {
          case "upload":
          case "download":
            result.filesTransferred++;
            result.bytesTransferred += fileResult.size;
            break;
          case "delete":
            result.filesDeleted++;
            break;
          case "conflict":
            result.conflictsResolved++;
            break;
          case "error":
            result.errors++;
            break;
        }
      }

      // Update file state cache
      if (activeMapping) {
        this.updateFileState(activeMapping, hostFiles, vmFiles);
      }

      result.duration = Date.now() - startTime;

      this.log(
        `Sync complete: ${result.filesTransferred} transferred, ${result.conflictsResolved} conflicts resolved, ${result.errors} errors`
      );
      this.emit("sync:complete", { mappingId, result });

      return result;
    } catch (error) {
      const syncError =
        error instanceof SyncError
          ? error
          : new SyncError(
              SyncErrorCode.TRANSFER_FAILED,
              `Sync failed: ${(error as Error).message}`,
              error as Error
            );

      this.emit("sync:error", { mappingId, error: syncError });
      throw syncError;
    }
  }

  /**
   * Force a full resync using rsync-style algorithm
   *
   * Ignores cached state and performs complete comparison and transfer.
   *
   * @param mapping - Directory mapping to resync
   */
  async forceResync(mapping: SyncMapping): Promise<void> {
    const mappingId = this.getMappingId(mapping);
    const activeMapping = this.mappings.get(mappingId);

    if (activeMapping) {
      // Clear file state cache to force full comparison
      activeMapping.fileState.clear();
    }

    this.log(`Force resync: ${mapping.hostPath} -> ${mapping.vmPath}`);
    this.emit("sync:force", { mappingId, mapping });

    await this.syncOnce(mapping);
  }

  /**
   * Start watching all mappings for changes
   *
   * Enables automatic synchronization when files change.
   */
  async startWatching(): Promise<void> {
    if (this.isWatching) {
      return;
    }

    this.isWatching = true;

    for (const [mappingId, activeMapping] of this.mappings) {
      if (activeMapping.config.watch) {
        await this.setupWatcher(activeMapping);
      }
    }

    this.log("Started watching all mappings");
    this.emit("watch:start");
  }

  /**
   * Stop watching all mappings
   */
  async stopWatching(): Promise<void> {
    if (!this.isWatching) {
      return;
    }

    for (const activeMapping of this.mappings.values()) {
      if (activeMapping.watcher) {
        await activeMapping.watcher.stop();
        activeMapping.watcher = undefined;
      }

      if (activeMapping.pollTimer) {
        clearInterval(activeMapping.pollTimer);
        activeMapping.pollTimer = undefined;
      }
    }

    this.isWatching = false;
    this.log("Stopped watching all mappings");
    this.emit("watch:stop");
  }

  /**
   * Get all registered mappings
   */
  getMappings(): SyncMapping[] {
    return Array.from(this.mappings.values()).map((m) => m.config);
  }

  /**
   * Check if a mapping exists
   */
  hasMapping(hostPath: string, vmPath: string): boolean {
    const mappingId = this.getMappingId({ hostPath, vmPath });
    return this.mappings.has(mappingId);
  }

  /**
   * Close the sync system and clean up resources
   */
  async close(): Promise<void> {
    await this.stopWatching();
    await this.transferQueue.close();
    this.removeAllListeners();
    this.log("FileSync closed");
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Validate a mapping configuration
   */
  private validateMapping(mapping: SyncMapping): void {
    if (!mapping.hostPath || !path.isAbsolute(mapping.hostPath)) {
      throw new SyncError(
        SyncErrorCode.INVALID_MAPPING,
        `Host path must be an absolute path: ${mapping.hostPath}`
      );
    }

    if (!mapping.vmPath || !mapping.vmPath.startsWith("/")) {
      throw new SyncError(
        SyncErrorCode.INVALID_MAPPING,
        `VM path must be an absolute path: ${mapping.vmPath}`
      );
    }

    if (!mapping.direction) {
      throw new SyncError(
        SyncErrorCode.INVALID_MAPPING,
        "Sync direction is required"
      );
    }

    const validDirections: SyncDirection[] = [
      "bidirectional",
      "host-to-vm",
      "vm-to-host",
    ];
    if (!validDirections.includes(mapping.direction)) {
      throw new SyncError(
        SyncErrorCode.INVALID_MAPPING,
        `Invalid direction: ${mapping.direction}`
      );
    }
  }

  /**
   * Generate a unique ID for a mapping
   */
  private getMappingId(mapping: { hostPath: string; vmPath: string }): string {
    const hash = createHash("sha256")
      .update(`${mapping.hostPath}:${mapping.vmPath}`)
      .digest("hex")
      .slice(0, 16);
    return hash;
  }

  /**
   * Resolve a partial mapping to full mapping
   */
  private resolveMapping(
    mapping: SyncMapping | { hostPath: string; vmPath: string }
  ): SyncMapping {
    const mappingId = this.getMappingId(mapping);
    const activeMapping = this.mappings.get(mappingId);

    if (activeMapping) {
      return activeMapping.config;
    }

    if (!("direction" in mapping)) {
      throw new SyncError(
        SyncErrorCode.INVALID_MAPPING,
        "Mapping not found and incomplete mapping provided"
      );
    }

    return mapping;
  }

  /**
   * Set up file watcher for a mapping
   */
  private async setupWatcher(activeMapping: ActiveMapping): Promise<void> {
    const mode = activeMapping.config.mode ?? this.options.defaultMode;

    if (mode === "polling") {
      // Set up polling-based watching
      activeMapping.pollTimer = setInterval(async () => {
        if (activeMapping.initialSyncComplete) {
          try {
            await this.syncOnce(activeMapping.config);
          } catch (error) {
            this.emit("sync:error", { mapping: activeMapping.config, error });
          }
        }
      }, this.options.pollingInterval);
    } else {
      // Set up filesystem watcher
      activeMapping.watcher = new FileWatcher({
        debounceMs: 100,
        exclude: activeMapping.config.exclude,
      });

      activeMapping.watcher.onChange(async (events) => {
        if (!activeMapping.initialSyncComplete) {
          return;
        }

        this.log(`Detected ${events.length} changes, triggering sync`);
        this.emit("watch:change", {
          mapping: activeMapping.config,
          events,
        });

        try {
          await this.syncOnce(activeMapping.config);
        } catch (error) {
          this.emit("sync:error", { mapping: activeMapping.config, error });
        }
      });

      await activeMapping.watcher.watch(activeMapping.config.hostPath);
    }
  }

  /**
   * Scan host directory for files
   */
  private async scanHostDirectory(
    rootPath: string,
    exclude: string[] = []
  ): Promise<Map<string, FileMetadata>> {
    const files = new Map<string, FileMetadata>();

    const scanDir = async (dirPath: string): Promise<void> => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(rootPath, fullPath);

        // Check exclusions
        if (this.isExcluded(relativePath, exclude)) {
          continue;
        }

        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile()) {
          try {
            const stats = await fs.stat(fullPath);
            const checksum = await this.computeChecksum(fullPath);

            files.set(relativePath, {
              relativePath,
              size: stats.size,
              mtime: stats.mtime,
              checksum,
              isDirectory: false,
            });
          } catch (error) {
            this.log(`Failed to scan file ${fullPath}: ${error}`);
          }
        }
      }
    };

    await scanDir(rootPath);
    return files;
  }

  /**
   * Scan VM directory for files
   */
  private async scanVMDirectory(
    rootPath: string,
    exclude: string[] = []
  ): Promise<Map<string, FileMetadata>> {
    const files = new Map<string, FileMetadata>();

    try {
      // Use protocol client to list files
      const result = await this.options.protocolClient.execute({
        command: `find "${rootPath}" -type f -exec stat -c '%n|%s|%Y' {} + 2>/dev/null || find "${rootPath}" -type f -exec stat -f '%N|%z|%m' {} +`,
        timeout: 60000,
      });

      if (result.exitCode !== 0) {
        // Directory might not exist yet
        return files;
      }

      const lines = Buffer.from(result.stdout, "base64").toString().split("\n");

      for (const line of lines) {
        const parts = line.split("|");
        if (parts.length !== 3) continue;

        const [fullPath, sizeStr, mtimeStr] = parts;
        const relativePath = path.relative(rootPath, fullPath);

        // Check exclusions
        if (this.isExcluded(relativePath, exclude)) {
          continue;
        }

        files.set(relativePath, {
          relativePath,
          size: parseInt(sizeStr, 10) || 0,
          mtime: new Date(parseInt(mtimeStr, 10) * 1000),
          checksum: "", // Will be computed on demand
          isDirectory: false,
        });
      }
    } catch (error) {
      this.log(`Failed to scan VM directory: ${error}`);
    }

    return files;
  }

  /**
   * Compare files between host and VM
   */
  private compareFiles(
    hostFiles: Map<string, FileMetadata>,
    vmFiles: Map<string, FileMetadata>,
    direction: SyncDirection
  ): TransferTask[] {
    const actions: TransferTask[] = [];
    const allPaths = new Set([...hostFiles.keys(), ...vmFiles.keys()]);

    for (const relativePath of allPaths) {
      const hostFile = hostFiles.get(relativePath);
      const vmFile = vmFiles.get(relativePath);

      // Determine action based on direction and file states
      const action = this.determineAction(
        relativePath,
        hostFile,
        vmFile,
        direction
      );

      if (action) {
        actions.push(action);
      }
    }

    return actions;
  }

  /**
   * Determine the action needed for a file
   */
  private determineAction(
    relativePath: string,
    hostFile: FileMetadata | undefined,
    vmFile: FileMetadata | undefined,
    direction: SyncDirection
  ): TransferTask | null {
    // File exists on host only
    if (hostFile && !vmFile) {
      if (direction === "bidirectional" || direction === "host-to-vm") {
        return {
          source: { path: hostFile.relativePath, side: "host" as const },
          target: { path: hostFile.relativePath, side: "vm" as const },
          checksum: hostFile.checksum,
          size: hostFile.size,
        };
      }
      return null;
    }

    // File exists on VM only
    if (!hostFile && vmFile) {
      if (direction === "bidirectional" || direction === "vm-to-host") {
        return {
          source: { path: vmFile.relativePath, side: "vm" as const },
          target: { path: vmFile.relativePath, side: "host" as const },
          checksum: vmFile.checksum,
          size: vmFile.size,
        };
      }
      return null;
    }

    // File exists on both - check for changes
    if (hostFile && vmFile) {
      const hostChanged = hostFile.checksum !== vmFile.checksum;
      const vmChanged = hostChanged; // If checksums differ, both sides "changed" from common ancestor

      if (!hostChanged) {
        return null; // Files are identical
      }

      // Handle based on direction
      if (direction === "host-to-vm") {
        return {
          source: { path: hostFile.relativePath, side: "host" as const },
          target: { path: hostFile.relativePath, side: "vm" as const },
          checksum: hostFile.checksum,
          size: hostFile.size,
        };
      }

      if (direction === "vm-to-host") {
        return {
          source: { path: vmFile.relativePath, side: "vm" as const },
          target: { path: vmFile.relativePath, side: "host" as const },
          checksum: vmFile.checksum,
          size: vmFile.size,
        };
      }

      // Bidirectional - potential conflict
      return {
        source: { path: hostFile.relativePath, side: "host" as const },
        target: { path: hostFile.relativePath, side: "vm" as const },
        checksum: hostFile.checksum,
        size: hostFile.size,
        conflict: {
          path: relativePath,
          hostVersion: hostFile,
          vmVersion: vmFile,
        },
      };
    }

    return null;
  }

  /**
   * Execute transfer tasks
   */
  private async executeTransfers(
    tasks: TransferTask[],
    mapping: SyncMapping
  ): Promise<FileSyncResult[]> {
    const results: FileSyncResult[] = [];

    // Process conflicts first
    const normalTasks: TransferTask[] = [];

    for (const task of tasks) {
      if (task.conflict) {
        // Resolve conflict
        const resolution = await this.options.onConflict(task.conflict);

        if (resolution.action === "skip") {
          results.push({
            path: task.source.path,
            operation: "skip",
            size: 0,
          });
        } else if (resolution.action === "use-host") {
          normalTasks.push({
            source: { path: task.source.path, side: "host" },
            target: { path: task.target.path, side: "vm" },
            checksum: task.checksum,
            size: task.size,
          });
        } else if (resolution.action === "use-vm") {
          normalTasks.push({
            source: { path: task.source.path, side: "vm" },
            target: { path: task.target.path, side: "host" },
            checksum: task.checksum,
            size: task.size,
          });
        }

        results.push({
          path: task.source.path,
          operation: "conflict",
          size: task.size,
          resolution: resolution.strategy,
        });
      } else {
        normalTasks.push(task);
      }
    }

    // Execute transfers in parallel with concurrency limit
    const batchSize = this.options.concurrentTransfers;
    for (let i = 0; i < normalTasks.length; i += batchSize) {
      const batch = normalTasks.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((task) => this.executeTransfer(task, mapping))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Execute a single transfer task
   */
  private async executeTransfer(
    task: TransferTask,
    mapping: SyncMapping
  ): Promise<FileSyncResult> {
    try {
      const hostPath = path.join(mapping.hostPath, task.source.path);
      const vmPath = path.join(mapping.vmPath, task.target.path);

      const result = await this.transferQueue.transfer({
        sourcePath: task.source.side === "host" ? hostPath : vmPath,
        targetPath: task.source.side === "host" ? vmPath : hostPath,
        sourceSide: task.source.side,
        targetSide: task.target.side,
        checksum: task.checksum,
      });

      return {
        path: task.source.path,
        operation: task.source.side === "host" ? "upload" : "download",
        source: task.source.side,
        target: task.target.side,
        size: task.size,
      };
    } catch (error) {
      return {
        path: task.source.path,
        operation: "error",
        size: task.size,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Compute SHA256 checksum of a file
   */
  private async computeChecksum(filePath: string): Promise<string> {
    const hash = createHash("sha256");
    const data = await fs.readFile(filePath);
    hash.update(data);
    return hash.digest("hex");
  }

  /**
   * Check if a path matches exclusion patterns
   */
  private isExcluded(relativePath: string, exclude: string[] = []): boolean {
    for (const pattern of exclude) {
      // Simple string matching for now
      if (relativePath.includes(pattern)) {
        return true;
      }
      // Handle glob patterns
      const regex = new RegExp(pattern.replace(/\*/g, ".*").replace(/\?/g, "."));
      if (regex.test(relativePath)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Update file state cache after sync
   */
  private updateFileState(
    activeMapping: ActiveMapping,
    hostFiles: Map<string, FileMetadata>,
    vmFiles: Map<string, FileMetadata>
  ): void {
    activeMapping.fileState.clear();

    for (const [path, metadata] of hostFiles) {
      activeMapping.fileState.set(`host:${path}`, metadata);
    }

    for (const [path, metadata] of vmFiles) {
      activeMapping.fileState.set(`vm:${path}`, metadata);
    }
  }
}

export { ConflictStrategy };
export type { FileEvent, WatchOptions, TransferTask, TransferResult, Conflict, Resolution };
export default FileSync;
