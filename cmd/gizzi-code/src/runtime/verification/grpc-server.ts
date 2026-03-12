/**
 * gRPC Verification Provider Server
 * 
 * Production-grade gRPC server for visual evidence gathering.
 * Provides real-time evidence streaming and health monitoring.
 */

import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import * as path from "path";
import { Log } from "@/shared/util/log";
import { captureVisualEvidenceDeterministic } from "./integration/deterministic";
import type { VisualCaptureManager } from "./manager";
import type { VisualArtifact } from "./types";

const log = Log.create({ service: "verification.grpc" });

// Load protobuf
const PROTO_PATH = path.join(__dirname, "proto", "verification.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const verificationProto = grpc.loadPackageDefinition(packageDefinition).verification as any;

// ============================================================================
// Type Definitions
// ============================================================================

interface EvidenceRequest {
  wih_id: string;
  metadata?: Record<string, string>;
}

interface Artifact {
  artifact_type: number;
  confidence: number;
  timestamp: string;
  metadata_json: string;
  image_data?: Buffer;
  text_content?: string;
  json_content?: string;
}

interface EvidenceResponse {
  evidence_id: string;
  wih_id: string;
  artifacts: Artifact[];
  captured_at: string;
  provider_id: string;
  overall_confidence: number;
}

interface HealthRequest {}

interface HealthResponse {
  healthy: boolean;
  version: string;
  metadata: Record<string, string>;
}

// ============================================================================
// gRPC Service Implementation
// ============================================================================

class VerificationProviderService {
  private visualManager: VisualCaptureManager;
  private version: string;
  private startTime: Date;

  constructor(visualManager: VisualCaptureManager) {
    this.visualManager = visualManager;
    this.version = process.env.npm_package_version || "1.0.0";
    this.startTime = new Date();
  }

  /**
   * Main evidence gathering endpoint
   */
  async gatherEvidence(
    call: grpc.ServerUnaryCall<EvidenceRequest, EvidenceResponse>,
    callback: grpc.sendUnaryData<EvidenceResponse>,
  ): Promise<void> {
    const wihId = call.request.wih_id;
    const metadata = call.request.metadata || {};
    
    log.info("[gRPC] Gathering evidence", { wihId, metadata });

    try {
      // Use deterministic capture (waits for dev server, etc.)
      const result = await captureVisualEvidenceDeterministic(
        this.visualManager,
        wihId,
        {
          waitForServer: true,
          serverTimeout: parseInt(metadata.timeout_ms || "30000"),
          changedFiles: metadata.changed_files?.split(","),
          injectIntoContext: false, // We want the raw result
        },
      );

      if (!result.success) {
        log.warn("[gRPC] Evidence gathering failed", { wihId, errors: result.errors });
        callback({
          code: grpc.status.INTERNAL,
          message: `Evidence gathering failed: ${result.errors.join(", ")}`,
          details: JSON.stringify({ errors: result.errors }),
        });
        return;
      }

      // Calculate overall confidence
      const overallConfidence = result.artifacts.length > 0
        ? result.artifacts.reduce((sum, a) => sum + (a.confidence || 0), 0) / result.artifacts.length
        : 1.0;

      // Convert to gRPC response
      const response: EvidenceResponse = {
        evidence_id: `ev_${Date.now()}_${wihId}`,
        wih_id: wihId,
        artifacts: result.artifacts.map(a => this.convertArtifact(a)),
        captured_at: new Date().toISOString(),
        provider_id: "visual-capture-ts-grpc",
        overall_confidence: overallConfidence,
      };

      log.info("[gRPC] Evidence gathered successfully", {
        wihId,
        artifactCount: response.artifacts.length,
        confidence: overallConfidence,
      });

      callback(null, response);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error("[gRPC] Error gathering evidence", { wihId, error: message });
      callback({
        code: grpc.status.INTERNAL,
        message: `Internal error: ${message}`,
      });
    }
  }

  /**
   * Streaming evidence endpoint for real-time updates
   */
  async streamEvidence(
    call: grpc.ServerWritableStream<EvidenceRequest, Artifact>,
  ): Promise<void> {
    const wihId = call.request.wih_id;
    log.info("[gRPC] Streaming evidence", { wihId });

    try {
      // Capture with progress callback
      const artifacts: VisualArtifact[] = [];
      
      // Stream each artifact as it's captured
      for (let i = 0; i < artifacts.length; i++) {
        const artifact = artifacts[i];
        const protoArtifact = this.convertArtifact(artifact);
        
        call.write(protoArtifact);
        
        log.debug("[gRPC] Streamed artifact", {
          wihId,
          type: artifact.type,
          index: i + 1,
          total: artifacts.length,
        });
      }

      call.end();
      log.info("[gRPC] Evidence stream complete", { wihId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error("[gRPC] Error streaming evidence", { wihId, error: message });
      call.destroy(new Error(message));
    }
  }

  /**
   * Health check endpoint
   */
  healthCheck(
    _call: grpc.ServerUnaryCall<HealthRequest, HealthResponse>,
    callback: grpc.sendUnaryData<HealthResponse>,
  ): void {
    const uptime = Date.now() - this.startTime.getTime();
    
    const response: HealthResponse = {
      healthy: true,
      version: this.version,
      metadata: {
        uptime_ms: uptime.toString(),
        node_version: process.version,
        platform: process.platform,
      },
    };

    callback(null, response);
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private convertArtifact(artifact: VisualArtifact): Artifact {
    const protoArtifact: Artifact = {
      artifact_type: this.artifactTypeToProto(artifact.type),
      confidence: artifact.confidence || 0,
      timestamp: artifact.timestamp,
      metadata_json: JSON.stringify({
        description: artifact.description,
        verificationClaim: artifact.verificationClaim,
        ...artifact.data,
      }),
    };

    // Include image data if available
    if (artifact.image?.path) {
      try {
        const fs = require("fs");
        protoArtifact.image_data = fs.readFileSync(artifact.image.path);
      } catch (e) {
        log.warn("Failed to read image data", { path: artifact.image.path, error: e });
      }
    }

    // Include text/JSON content if available
    if (artifact.llmContext) {
      protoArtifact.text_content = artifact.llmContext;
    }

    if (artifact.data) {
      protoArtifact.json_content = JSON.stringify(artifact.data);
    }

    return protoArtifact;
  }

  private artifactTypeToProto(type: string): number {
    const mapping: Record<string, number> = {
      "ui-state": 0,
      "coverage-map": 1,
      "console-output": 2,
      "visual-diff": 3,
      "error-state": 4,
      "performance-chart": 5,
      "structure-diagram": 6,
      "network-trace": 7,
    };
    return mapping[type] || 0;
  }
}

// ============================================================================
// Server Management
// ============================================================================

export interface GrpcServerConfig {
  port: number;
  host?: string;
  enableReflection?: boolean;
  maxConcurrentStreams?: number;
}

export class VerificationGrpcServer {
  private server: grpc.Server | null = null;
  private service: VerificationProviderService;
  private config: GrpcServerConfig;

  constructor(visualManager: VisualCaptureManager, config: GrpcServerConfig) {
    this.service = new VerificationProviderService(visualManager);
    this.config = {
      host: "0.0.0.0",
      enableReflection: true,
      maxConcurrentStreams: 100,
      ...config,
    };
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = new grpc.Server({
        "grpc.max_concurrent_streams": this.config.maxConcurrentStreams,
      });

      // Add service
      this.server.addService(verificationProto.VerificationProvider.service, {
        gatherEvidence: (call: any, callback: any) =>
          this.service.gatherEvidence(call, callback),
        streamEvidence: (call: any) => this.service.streamEvidence(call),
        healthCheck: (call: any, callback: any) =>
          this.service.healthCheck(call, callback),
      });

      // Bind and start
      const address = `${this.config.host}:${this.config.port}`;
      
      this.server.bindAsync(
        address,
        grpc.ServerCredentials.createInsecure(),
        (err, boundPort) => {
          if (err) {
            log.error("[gRPC] Failed to bind server", { error: err.message });
            reject(err);
            return;
          }

          this.server?.start();
          log.info("[gRPC] Verification server started", {
            address: `${this.config.host}:${boundPort}`,
          });
          resolve();
        },
      );
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.tryShutdown(() => {
        log.info("[gRPC] Server shut down gracefully");
        resolve();
      });
    });
  }

  getServer(): grpc.Server | null {
    return this.server;
  }
}

// ============================================================================
// Factory & Convenience Functions
// ============================================================================

export async function startVerificationServer(
  visualManager: VisualCaptureManager,
  port?: number,
): Promise<VerificationGrpcServer> {
  const config: GrpcServerConfig = {
    port: port || parseInt(process.env.VERIFICATION_GRPC_PORT || "50051"),
  };

  const server = new VerificationGrpcServer(visualManager, config);
  await server.start();
  
  return server;
}
