/**
 * @fileoverview Allternit File Sync System - Conflict Resolution
 *
 * Conflict detection and resolution strategies for bidirectional file sync.
 * Provides multiple resolution algorithms including timestamp-based,
 * content-based, and manual resolution.
 *
 * Features:
 * - Multiple resolution strategies (host-wins, vm-wins, newest-wins, rename, prompt)
 * - Automatic conflict detection based on timestamps and checksums
 * - Rename strategy with conflict markers
 * - Extensible for custom resolution strategies
 *
 * @module conflict
 */

import { EventEmitter } from "node:events";
import * as path from "node:path";
import type { FileMetadata } from "./sync.js";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Conflict resolution strategies
 */
export enum ConflictStrategy {
  /** Host version always wins */
  HOST_WINS = "host-wins",
  /** VM version always wins */
  VM_WINS = "vm-wins",
  /** Newest file (by mtime) wins */
  NEWEST_WINS = "newest-wins",
  /** Largest file wins */
  LARGEST_WINS = "largest-wins",
  /** Rename conflict files with version markers */
  RENAME = "rename",
  /** Prompt user for resolution */
  PROMPT = "prompt",
}

/**
 * Resolution action
 */
export type ResolutionAction =
  | "use-host"
  | "use-vm"
  | "use-both"
  | "skip"
  | "rename-host"
  | "rename-vm";

/**
 * Conflict information
 */
export interface Conflict {
  /** Relative path of the conflicting file */
  path: string;
  /** Host version metadata */
  hostVersion: FileMetadata;
  /** VM version metadata */
  vmVersion: FileMetadata;
  /** When the conflict was detected */
  detectedAt?: Date;
  /** Last resolution attempt (if any) */
  lastResolution?: Resolution;
}

/**
 * Conflict resolution result
 */
export interface Resolution {
  /** Action to take */
  action: ResolutionAction;
  /** Strategy used to reach this resolution */
  strategy: ConflictStrategy;
  /** New path for rename actions */
  newPath?: string;
  /** Human-readable explanation */
  explanation?: string;
  /** Timestamp of resolution */
  timestamp: Date;
  /** Whether this resolution should be remembered for similar conflicts */
  remember?: boolean;
}

/**
 * Conflict resolver options
 */
export interface ConflictResolverOptions {
  /** Default strategy to use */
  defaultStrategy?: ConflictStrategy;
  /** Format for conflict file names */
  conflictNameFormat?: string;
  /** Maximum number of conflicts to track */
  maxTrackedConflicts?: number;
  /** Callback for user prompts */
  onPrompt?: (conflict: Conflict) => Promise<Resolution>;
}

/**
 * Conflict history entry
 */
interface ConflictHistory {
  /** Conflict path */
  path: string;
  /** When the conflict was detected */
  detectedAt: Date;
  /** Resolution applied */
  resolution: Resolution;
  /** Whether the conflict is resolved */
  resolved: boolean;
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Error codes for conflict resolution
 */
export enum ConflictErrorCode {
  UNRESOLVED = "UNRESOLVED",
  INVALID_STRATEGY = "INVALID_STRATEGY",
  RENAME_FAILED = "RENAME_FAILED",
  USER_CANCELLED = "USER_CANCELLED",
}

/**
 * Error thrown by conflict resolution
 */
export class ConflictError extends Error {
  constructor(
    public readonly code: ConflictErrorCode,
    message: string,
    public readonly conflict?: Conflict
  ) {
    super(message);
    this.name = "ConflictError";
    Error.captureStackTrace?.(this, ConflictError);
  }
}

// ============================================================================
// Main ConflictResolver Class
// ============================================================================

/**
 * Conflict resolver for file synchronization.
 *
 * Detects and resolves conflicts that occur when the same file is modified
 * on both host and VM between sync operations.
 *
 * @example
 * ```typescript
 * const resolver = new ConflictResolver({
 *   defaultStrategy: ConflictStrategy.NEWEST_WINS,
 * });
 *
 * const conflict: Conflict = {
 *   path: "src/main.ts",
 *   hostVersion: { relativePath: "src/main.ts", size: 1000, mtime: new Date(), ... },
 *   vmVersion: { relativePath: "src/main.ts", size: 1200, mtime: new Date(), ... },
 * };
 *
 * const resolution = await resolver.resolve(conflict);
 * console.log(resolution.action); // "use-host" | "use-vm" | "skip" | ...
 * ```
 */
export class ConflictResolver extends EventEmitter {
  private options: Required<ConflictResolverOptions>;
  private conflictHistory: Map<string, ConflictHistory> = new Map();

  /**
   * Create a new ConflictResolver instance
   * @param options - Resolver configuration options
   */
  constructor(options: ConflictResolverOptions = {}) {
    super();
    this.options = {
      defaultStrategy: ConflictStrategy.NEWEST_WINS,
      conflictNameFormat: "{basename}.conflict-{timestamp}{ext}",
      maxTrackedConflicts: 1000,
      onPrompt: async () => {
        throw new ConflictError(
          ConflictErrorCode.USER_CANCELLED,
          "No prompt handler configured"
        );
      },
      ...options,
    };
  }

  /**
   * Detect conflicts between host and VM file versions
   *
   * @param hostFile - Host version metadata (undefined if doesn't exist)
   * @param vmFile - VM version metadata (undefined if doesn't exist)
   * @param previousState - Previous known state (from sync state cache)
   * @returns Conflict object if conflict detected, null otherwise
   */
  detectConflict(
    hostFile: FileMetadata | undefined,
    vmFile: FileMetadata | undefined,
    previousState?: { hostChecksum?: string; vmChecksum?: string }
  ): Conflict | null {
    // If only one side has the file, it's not a conflict (just a create/delete)
    if (!hostFile || !vmFile) {
      return null;
    }

    // If checksums match, no conflict
    if (hostFile.checksum === vmFile.checksum) {
      return null;
    }

    // If we have previous state, determine if both sides changed
    if (previousState) {
      const hostChanged =
        !previousState.hostChecksum || hostFile.checksum !== previousState.hostChecksum;
      const vmChanged =
        !previousState.vmChecksum || vmFile.checksum !== previousState.vmChecksum;

      // Conflict only if both sides changed
      if (!hostChanged || !vmChanged) {
        return null;
      }
    }

    // Conflict detected
    const conflict: Conflict = {
      path: hostFile.relativePath,
      hostVersion: hostFile,
      vmVersion: vmFile,
      detectedAt: new Date(),
    };

    this.emit("conflict:detected", conflict);
    return conflict;
  }

  /**
   * Resolve a conflict using the specified or default strategy
   *
   * @param conflict - Conflict to resolve
   * @param strategy - Resolution strategy to use (defaults to configured default)
   * @returns Resolution result
   * @throws {ConflictError} If resolution fails
   */
  async resolve(
    conflict: Conflict,
    strategy: ConflictStrategy = this.options.defaultStrategy
  ): Promise<Resolution> {
    this.emit("conflict:resolving", { conflict, strategy });

    let resolution: Resolution;

    switch (strategy) {
      case ConflictStrategy.HOST_WINS:
        resolution = this.resolveHostWins(conflict);
        break;

      case ConflictStrategy.VM_WINS:
        resolution = this.resolveVmWins(conflict);
        break;

      case ConflictStrategy.NEWEST_WINS:
        resolution = this.resolveNewestWins(conflict);
        break;

      case ConflictStrategy.LARGEST_WINS:
        resolution = this.resolveLargestWins(conflict);
        break;

      case ConflictStrategy.RENAME:
        resolution = this.resolveRename(conflict);
        break;

      case ConflictStrategy.PROMPT:
        resolution = await this.resolvePrompt(conflict);
        break;

      default:
        throw new ConflictError(
          ConflictErrorCode.INVALID_STRATEGY,
          `Unknown conflict resolution strategy: ${strategy}`
        );
    }

    // Track resolution
    this.trackResolution(conflict, resolution);

    this.emit("conflict:resolved", { conflict, resolution });
    return resolution;
  }

  /**
   * Resolve with a specific strategy (non-async version for simple strategies)
   *
   * @param conflict - Conflict to resolve
   * @param strategy - Resolution strategy
   * @returns Resolution result
   */
  resolveWithStrategy(
    conflict: Conflict,
    strategy: ConflictStrategy
  ): Resolution {
    switch (strategy) {
      case ConflictStrategy.HOST_WINS:
        return this.resolveHostWins(conflict);

      case ConflictStrategy.VM_WINS:
        return this.resolveVmWins(conflict);

      case ConflictStrategy.NEWEST_WINS:
        return this.resolveNewestWins(conflict);

      case ConflictStrategy.LARGEST_WINS:
        return this.resolveLargestWins(conflict);

      case ConflictStrategy.RENAME:
        return this.resolveRename(conflict);

      default:
        throw new ConflictError(
          ConflictErrorCode.INVALID_STRATEGY,
          `Strategy ${strategy} requires async resolution`
        );
    }
  }

  /**
   * Resolve multiple conflicts in batch
   *
   * @param conflicts - Array of conflicts to resolve
   * @param strategy - Resolution strategy to use
   * @returns Array of resolutions
   */
  async resolveBatch(
    conflicts: Conflict[],
    strategy: ConflictStrategy = this.options.defaultStrategy
  ): Promise<Resolution[]> {
    return Promise.all(conflicts.map((c) => this.resolve(c, strategy)));
  }

  /**
   * Get conflict resolution history
   *
   * @param path - Optional path to filter by
   * @returns Array of conflict history entries
   */
  getHistory(path?: string): ConflictHistory[] {
    const entries = Array.from(this.conflictHistory.values());

    if (path) {
      return entries.filter((e) => e.path === path);
    }

    return entries.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
  }

  /**
   * Clear conflict history
   */
  clearHistory(): void {
    this.conflictHistory.clear();
  }

  /**
   * Check if a conflict has been seen before
   *
   * @param conflict - Conflict to check
   * @returns True if this exact conflict was previously resolved
   */
  wasPreviouslyResolved(conflict: Conflict): boolean {
    const history = this.conflictHistory.get(conflict.path);

    if (!history) {
      return false;
    }

    // Check if both checksums match a previous conflict
    return (
      history.resolution.action !== "skip" &&
      ((history.resolution.action === "use-host" &&
        history.resolution.timestamp > conflict.hostVersion.mtime) ||
        (history.resolution.action === "use-vm" &&
          history.resolution.timestamp > conflict.vmVersion.mtime))
    );
  }

  /**
   * Get suggested resolution based on file types and previous patterns
   *
   * @param conflict - Conflict to analyze
   * @returns Suggested resolution strategy
   */
  suggestStrategy(conflict: Conflict): ConflictStrategy {
    const ext = path.extname(conflict.path).toLowerCase();

    // Build artifacts - prefer VM version (built in VM)
    const buildArtifacts = [
      ".o",
      ".obj",
      ".so",
      ".dll",
      ".exe",
      ".bin",
      ".class",
      ".pyc",
    ];
    if (buildArtifacts.includes(ext)) {
      return ConflictStrategy.VM_WINS;
    }

    // Generated files - prefer newest
    const generatedFiles = [".log", ".tmp", ".cache", ".generated"];
    if (generatedFiles.some((e) => conflict.path.includes(e))) {
      return ConflictStrategy.NEWEST_WINS;
    }

    // Source files - may need manual resolution
    const sourceFiles = [
      ".ts",
      ".js",
      ".tsx",
      ".jsx",
      ".py",
      ".rs",
      ".go",
      ".java",
      ".cpp",
      ".c",
      ".h",
    ];
    if (sourceFiles.includes(ext)) {
      // Check if sizes are very different - might indicate different changes
      const sizeDiff = Math.abs(
        conflict.hostVersion.size - conflict.vmVersion.size
      );
      const sizeRatio =
        Math.max(conflict.hostVersion.size, conflict.vmVersion.size) /
        Math.max(Math.min(conflict.hostVersion.size, conflict.vmVersion.size), 1);

      if (sizeRatio > 2 || sizeDiff > 1000) {
        // Significant differences - suggest rename
        return ConflictStrategy.RENAME;
      }
    }

    return this.options.defaultStrategy;
  }

  // ============================================================================
  // Resolution Strategy Implementations
  // ============================================================================

  /**
   * Host wins strategy
   */
  private resolveHostWins(conflict: Conflict): Resolution {
    return {
      action: "use-host",
      strategy: ConflictStrategy.HOST_WINS,
      explanation: `Using host version of ${conflict.path} (${conflict.hostVersion.size} bytes, modified ${conflict.hostVersion.mtime.toISOString()})`,
      timestamp: new Date(),
    };
  }

  /**
   * VM wins strategy
   */
  private resolveVmWins(conflict: Conflict): Resolution {
    return {
      action: "use-vm",
      strategy: ConflictStrategy.VM_WINS,
      explanation: `Using VM version of ${conflict.path} (${conflict.vmVersion.size} bytes, modified ${conflict.vmVersion.mtime.toISOString()})`,
      timestamp: new Date(),
    };
  }

  /**
   * Newest wins strategy
   */
  private resolveNewestWins(conflict: Conflict): Resolution {
    const hostTime = conflict.hostVersion.mtime.getTime();
    const vmTime = conflict.vmVersion.mtime.getTime();

    if (hostTime > vmTime) {
      return {
        action: "use-host",
        strategy: ConflictStrategy.NEWEST_WINS,
        explanation: `Host version is newer (${new Date(hostTime).toISOString()} vs ${new Date(vmTime).toISOString()})`,
        timestamp: new Date(),
      };
    } else if (vmTime > hostTime) {
      return {
        action: "use-vm",
        strategy: ConflictStrategy.NEWEST_WINS,
        explanation: `VM version is newer (${new Date(vmTime).toISOString()} vs ${new Date(hostTime).toISOString()})`,
        timestamp: new Date(),
      };
    } else {
      // Same timestamp - fall back to size
      return this.resolveLargestWins(conflict);
    }
  }

  /**
   * Largest wins strategy
   */
  private resolveLargestWins(conflict: Conflict): Resolution {
    if (conflict.hostVersion.size >= conflict.vmVersion.size) {
      return {
        action: "use-host",
        strategy: ConflictStrategy.LARGEST_WINS,
        explanation: `Host version is larger (${conflict.hostVersion.size} vs ${conflict.vmVersion.size} bytes)`,
        timestamp: new Date(),
      };
    } else {
      return {
        action: "use-vm",
        strategy: ConflictStrategy.LARGEST_WINS,
        explanation: `VM version is larger (${conflict.vmVersion.size} vs ${conflict.hostVersion.size} bytes)`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Rename strategy - keep both versions
   */
  private resolveRename(conflict: Conflict): Resolution {
    const timestamp = Date.now();
    const dir = path.dirname(conflict.path);
    const ext = path.extname(conflict.path);
    const basename = path.basename(conflict.path, ext);

    // Generate conflict file names
    const hostNewName = this.formatConflictName(
      basename,
      ext,
      timestamp,
      "host"
    );
    const vmNewName = this.formatConflictName(basename, ext, timestamp, "vm");

    const hostNewPath = path.join(dir, hostNewName);
    const vmNewPath = path.join(dir, vmNewName);

    // Use host as the "main" file, rename VM version
    return {
      action: "use-both",
      strategy: ConflictStrategy.RENAME,
      explanation: `Keeping both versions: host as ${conflict.path}, VM renamed to ${vmNewPath}`,
      newPath: vmNewPath,
      timestamp: new Date(),
    };
  }

  /**
   * Prompt user for resolution
   */
  private async resolvePrompt(conflict: Conflict): Promise<Resolution> {
    try {
      const resolution = await this.options.onPrompt(conflict);
      return {
        ...resolution,
        strategy: ConflictStrategy.PROMPT,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new ConflictError(
        ConflictErrorCode.USER_CANCELLED,
        `User cancelled conflict resolution for ${conflict.path}`,
        conflict
      );
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Format conflict file name
   */
  private formatConflictName(
    basename: string,
    ext: string,
    timestamp: number,
    side: "host" | "vm"
  ): string {
    return this.options.conflictNameFormat
      .replace("{basename}", basename)
      .replace("{ext}", ext)
      .replace("{timestamp}", timestamp.toString())
      .replace("{side}", side);
  }

  /**
   * Track a resolution in history
   */
  private trackResolution(conflict: Conflict, resolution: Resolution): void {
    // Manage history size
    if (this.conflictHistory.size >= this.options.maxTrackedConflicts) {
      // Remove oldest entry
      const oldest = Array.from(this.conflictHistory.entries()).sort(
        (a, b) => a[1].detectedAt.getTime() - b[1].detectedAt.getTime()
      )[0];
      if (oldest) {
        this.conflictHistory.delete(oldest[0]);
      }
    }

    this.conflictHistory.set(conflict.path, {
      path: conflict.path,
      detectedAt: conflict.detectedAt || new Date(),
      resolution,
      resolved: resolution.action !== "skip",
    });
  }
}

/**
 * Utility function to check if two file versions conflict
 */
export function versionsConflict(
  hostVersion: FileMetadata,
  vmVersion: FileMetadata
): boolean {
  return hostVersion.checksum !== vmVersion.checksum;
}

/**
 * Utility function to format conflict for display
 */
export function formatConflict(conflict: Conflict): string {
  return `
Conflict detected: ${conflict.path}

Host version:
  Size: ${conflict.hostVersion.size} bytes
  Modified: ${conflict.hostVersion.mtime.toISOString()}
  Checksum: ${conflict.hostVersion.checksum.slice(0, 16)}...

VM version:
  Size: ${conflict.vmVersion.size} bytes
  Modified: ${conflict.vmVersion.mtime.toISOString()}
  Checksum: ${conflict.vmVersion.checksum.slice(0, 16)}...
`.trim();
}

export default ConflictResolver;
