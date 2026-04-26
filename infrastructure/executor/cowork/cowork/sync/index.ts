/**
 * @fileoverview Allternit File Sync System - Main Exports
 *
 * Bidirectional file synchronization system for host↔VM communication.
 *
 * This module provides a complete file synchronization solution with support for
 * multiple sync modes, automatic conflict resolution, and high-performance
 * file watching.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { FileSync, ConflictStrategy } from "./sync/index.js";
 * import { ProtocolClient } from "./protocol/client.js";
 *
 * const protocolClient = new ProtocolClient(connection);
 *
 * const sync = new FileSync({
 *   protocolClient,
 *   strategy: ConflictStrategy.NEWEST_WINS,
 *   concurrentTransfers: 3,
 *   compression: true,
 * });
 *
 * // Add a directory mapping
 * await sync.addMapping({
 *   hostPath: "/Users/alice/myproject",
 *   vmPath: "/workspace/myproject",
 *   direction: "bidirectional",
 *   exclude: ["node_modules", ".git", "dist"],
 *   watch: true,
 * });
 *
 * // Start watching for changes
 * await sync.startWatching();
 *
 * // Listen for sync events
 * sync.on("sync:complete", (result) => {
 *   console.log(`Synced ${result.result.filesTransferred} files`);
 * });
 * ```
 *
 * ## Architecture
 *
 * The sync system consists of four main components:
 *
 * 1. **FileSync** (`sync.ts`) - Main orchestrator that manages mappings,
 *    coordinates transfers, and handles sync lifecycle.
 *
 * 2. **FileWatcher** (`watcher.ts`) - File system watcher with debouncing
 *    and batching. Supports native fs.watch and polling modes.
 *
 * 3. **TransferQueue** (`transfer.ts`) - Manages file transfers with
 *    concurrency control, compression, and delta sync for large files.
 *
 * 4. **ConflictResolver** (`conflict.ts`) - Detects and resolves conflicts
 *    using multiple strategies (host-wins, newest-wins, rename, etc.).
 *
 * ## Sync Modes
 *
 * - **VirtioFS** (macOS) - High-performance shared filesystem
 * - **9P** (Linux) - Plan 9 filesystem protocol
 * - **rsync** - Fallback for initial sync
 * - **Polling** - Cross-platform fallback using periodic scanning
 *
 * ## Conflict Resolution Strategies
 *
 * - `host-wins` - Always use host version
 * - `vm-wins` - Always use VM version
 * - `newest-wins` - Use file with most recent modification time
 * - `largest-wins` - Use larger file
 * - `rename` - Keep both versions with conflict markers
 * - `prompt` - Prompt user for resolution
 *
 * @module sync
 */

// ============================================================================
// Main Sync Orchestrator
// ============================================================================

export {
  /** Main file synchronization class */
  FileSync,
  /** Sync error class */
  SyncError,
  /** Sync error codes */
  SyncErrorCode,
  /** Conflict resolution strategies */
  ConflictStrategy,
} from "./sync.js";

export type {
  /** Sync direction type */
  SyncDirection,
  /** Sync mode type */
  SyncMode,
  /** Directory mapping configuration */
  SyncMapping,
  /** Sync operation result */
  SyncResult,
  /** Single file sync result */
  FileSyncResult,
  /** File metadata for comparison */
  FileMetadata,
  /** FileSync configuration options */
  FileSyncOptions,
} from "./sync.js";

// ============================================================================
// File Watcher
// ============================================================================

export {
  /** File system watcher with debouncing */
  FileWatcher,
  /** File watcher error class */
  WatcherError,
  /** Watcher error codes */
  WatcherErrorCode,
  /** Watcher state enum */
  WatcherState,
} from "./watcher.js";

export type {
  /** Type of file system event */
  FileEventType,
  /** File system event */
  FileEvent,
  /** Watch configuration options */
  WatchOptions,
} from "./watcher.js";

// ============================================================================
// Transfer Queue
// ============================================================================

export {
  /** File transfer queue with concurrency control */
  TransferQueue,
  /** Transfer error class */
  TransferError,
  /** Transfer error codes */
  TransferErrorCode,
} from "./transfer.js";

export type {
  /** Sync side (host or VM) */
  SyncSide,
  /** Transfer task configuration */
  TransferTask,
  /** Internal transfer operation */
  TransferOperation,
  /** Transfer result */
  TransferResult,
  /** Transfer queue configuration options */
  TransferQueueOptions,
} from "./transfer.js";

// ============================================================================
// Conflict Resolution
// ============================================================================

export {
  /** Conflict resolver for bidirectional sync */
  ConflictResolver,
  /** Conflict error class */
  ConflictError,
  /** Conflict error codes */
  ConflictErrorCode,
  /** Check if two versions conflict */
  versionsConflict,
  /** Format conflict for display */
  formatConflict,
} from "./conflict.js";

export type {
  /** Resolution action type */
  ResolutionAction,
  /** Conflict information */
  Conflict,
  /** Conflict resolution result */
  Resolution,
  /** Conflict resolver configuration options */
  ConflictResolverOptions,
} from "./conflict.js";

// ============================================================================
// Re-export for convenience
// ============================================================================

/**
 * Default export - FileSync class
 */
export { FileSync as default } from "./sync.js";
