/**
 * Unified Verification Service
 * 
 * Orchestrates visual evidence capture for both:
 * - File-based mode (development, simple deployments)
 * - gRPC mode (production, high-performance)
 * 
 * Automatically selects mode based on configuration and availability.
 */

import { Log } from "@/shared/util/log";
import { Bus } from "@/shared/bus";
import type { VisualCaptureManager } from "./visual/manager";
import { EvidenceFileWriter, type EvidenceFile } from "./file-writer";
import { VerificationGrpcServer, type GrpcServerConfig } from "./grpc-server";

const log = Log.create({ service: "verification" });

// ============================================================================
// Configuration
// ============================================================================

export interface VerificationServiceConfig {
  /** Primary mode: "auto" | "file" | "grpc" */
  mode: "auto" | "file" | "grpc";
  
  /** File-based configuration */
  fileBased?: {
    evidenceDir: string;
    keepFiles: boolean;
  };
  
  /** gRPC configuration */
  grpc?: GrpcServerConfig;
  
  /** Fallback to file if gRPC fails */
  fallbackToFile: boolean;
  
  /** Auto-cleanup old evidence */
  autoCleanup: boolean;
  cleanupMaxAgeHours: number;
}

export const DEFAULT_CONFIG: VerificationServiceConfig = {
  mode: "auto",
  fileBased: {
    evidenceDir: ".a2r/evidence",
    keepFiles: false,
  },
  grpc: {
    port: 50051,
    host: "0.0.0.0",
  },
  fallbackToFile: true,
  autoCleanup: true,
  cleanupMaxAgeHours: 24,
};

// ============================================================================
// Service State
// ============================================================================

type ServiceMode = "file" | "grpc" | "uninitialized";

interface ServiceState {
  mode: ServiceMode;
  fileWriter: EvidenceFileWriter | null;
  grpcServer: VerificationGrpcServer | null;
  isRunning: boolean;
}

// ============================================================================
// Verification Service
// ============================================================================

export class VerificationService {
  private config: VerificationServiceConfig;
  private visualManager: VisualCaptureManager;
  private state: ServiceState;

  constructor(visualManager: VisualCaptureManager, config?: Partial<VerificationServiceConfig>) {
    this.visualManager = visualManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      mode: "uninitialized",
      fileWriter: null,
      grpcServer: null,
      isRunning: false,
    };
  }

  /**
   * Initialize and start the service
   */
  async initialize(): Promise<ServiceMode> {
    if (this.state.isRunning) {
      log.warn("[VerificationService] Already initialized");
      return this.state.mode;
    }

    log.info("[VerificationService] Initializing", { mode: this.config.mode });

    // Determine mode
    const mode = await this.determineMode();
    this.state.mode = mode;

    try {
      if (mode === "grpc") {
        await this.startGrpc();
      } else {
        await this.startFileBased();
      }

      this.state.isRunning = true;
      
      // Start cleanup loop if enabled
      if (this.config.autoCleanup) {
        this.startCleanupLoop();
      }

      log.info("[VerificationService] Initialized successfully", { mode });
      return mode;

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error("[VerificationService] Initialization failed", { mode, error: message });

      // Try fallback
      if (this.config.fallbackToFile && mode === "grpc") {
        log.info("[VerificationService] Falling back to file-based mode");
        return this.initializeFileFallback();
      }

      throw error;
    }
  }

  /**
   * Stop the service gracefully
   */
  async stop(): Promise<void> {
    log.info("[VerificationService] Stopping");

    if (this.state.grpcServer) {
      await this.state.grpcServer.stop();
    }

    this.state.isRunning = false;
    this.state.mode = "uninitialized";

    log.info("[VerificationService] Stopped");
  }

  /**
   * Capture evidence for a WIH using the active mode
   */
  async captureForWih(
    wihId: string,
    options: {
      changedFiles?: string[];
      timeout?: number;
    } = {},
  ): Promise<EvidenceFile | null> {
    if (!this.state.isRunning) {
      log.warn("[VerificationService] Not initialized, capturing in file mode");
      // Auto-initialize in file mode for convenience
      await this.initializeFileFallback();
    }

    if (this.state.mode === "grpc") {
      // In gRPC mode, the Rust side calls us
      // We just need to ensure we're ready to respond
      log.debug("[VerificationService] gRPC mode active, waiting for requests", { wihId });
      
      // Also write file as backup/audit trail
      if (this.state.fileWriter) {
        this.state.fileWriter.writeEvidence(wihId, options).catch(e => {
          log.warn("[VerificationService] Backup file write failed", { wihId, error: e });
        });
      }
      
      return null; // Evidence will be delivered via gRPC
    }

    // File-based mode: write evidence immediately
    if (this.state.fileWriter) {
      return this.state.fileWriter.writeEvidence(wihId, options);
    }

    return null;
  }

  /**
   * Get current service status
   */
  getStatus(): {
    mode: ServiceMode;
    isRunning: boolean;
    grpcPort?: number;
    evidenceDir?: string;
  } {
    return {
      mode: this.state.mode,
      isRunning: this.state.isRunning,
      grpcPort: this.config.grpc?.port,
      evidenceDir: this.config.fileBased?.evidenceDir,
    };
  }

  /**
   * Check if evidence exists for a WIH (file-based mode only)
   */
  async evidenceExists(wihId: string): Promise<boolean> {
    if (this.state.fileWriter) {
      return this.state.fileWriter.evidenceExists(wihId);
    }
    return false;
  }

  /**
   * Read evidence file (for debugging)
   */
  async readEvidence(wihId: string): Promise<EvidenceFile | null> {
    if (this.state.fileWriter) {
      return this.state.fileWriter.readEvidence(wihId);
    }
    return null;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async determineMode(): Promise<ServiceMode> {
    const configuredMode = this.config.mode;

    if (configuredMode === "file") {
      return "file";
    }

    if (configuredMode === "grpc") {
      return "grpc";
    }

    // Auto mode: prefer gRPC if available, fallback to file
    if (await this.isGrpcAvailable()) {
      return "grpc";
    }

    return "file";
  }

  private async isGrpcAvailable(): Promise<boolean> {
    // Check if gRPC port is available
    try {
      const net = require("net");
      return new Promise((resolve) => {
        const tester = net.createServer();
        tester.once("error", () => resolve(false));
        tester.once("listening", () => {
          tester.close();
          resolve(true);
        });
        tester.listen(this.config.grpc?.port || 50051);
      });
    } catch {
      return false;
    }
  }

  private async startGrpc(): Promise<void> {
    if (!this.config.grpc) {
      throw new Error("gRPC configuration missing");
    }

    log.info("[VerificationService] Starting gRPC server", {
      port: this.config.grpc.port,
      host: this.config.grpc.host,
    });

    this.state.grpcServer = new VerificationGrpcServer(
      this.visualManager,
      this.config.grpc,
    );

    await this.state.grpcServer.start();

    // Also create file writer for backup/audit
    this.state.fileWriter = new EvidenceFileWriter(this.visualManager, {
      evidenceDir: this.config.fileBased?.evidenceDir,
      keepFiles: true, // Keep for audit trail
    });
  }

  private async startFileBased(): Promise<void> {
    log.info("[VerificationService] Starting file-based mode", {
      evidenceDir: this.config.fileBased?.evidenceDir,
    });

    this.state.fileWriter = new EvidenceFileWriter(this.visualManager, {
      evidenceDir: this.config.fileBased?.evidenceDir,
      keepFiles: this.config.fileBased?.keepFiles,
    });
  }

  private async initializeFileFallback(): Promise<ServiceMode> {
    this.state.mode = "file";
    await this.startFileBased();
    this.state.isRunning = true;
    return "file";
  }

  private startCleanupLoop(): void {
    const intervalMs = 60 * 60 * 1000; // 1 hour

    const cleanup = async () => {
      if (!this.state.isRunning) return;
      
      try {
        if (this.state.fileWriter) {
          const cleaned = await this.state.fileWriter.cleanupOld(
            this.config.cleanupMaxAgeHours,
          );
          if (cleaned > 0) {
            log.info("[VerificationService] Auto-cleanup completed", { cleaned });
          }
        }
      } catch (error) {
        log.error("[VerificationService] Cleanup failed", { error });
      }

      // Schedule next cleanup
      setTimeout(cleanup, intervalMs);
    };

    // Start first cleanup after interval
    setTimeout(cleanup, intervalMs);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalService: VerificationService | null = null;

export async function initializeVerificationService(
  visualManager: VisualCaptureManager,
  config?: Partial<VerificationServiceConfig>,
): Promise<VerificationService> {
  if (globalService) {
    log.warn("[VerificationService] Already initialized, returning existing instance");
    return globalService;
  }

  globalService = new VerificationService(visualManager, config);
  await globalService.initialize();
  
  return globalService;
}

export function getVerificationService(): VerificationService | null {
  return globalService;
}

export async function stopVerificationService(): Promise<void> {
  if (globalService) {
    await globalService.stop();
    globalService = null;
  }
}

// ============================================================================
// Convenience Exports
// ============================================================================

export { EvidenceFileWriter, type EvidenceFile } from "./file-writer";
export { VerificationGrpcServer, type GrpcServerConfig } from "./grpc-server";
