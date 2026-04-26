import { Langfuse } from "langfuse";
import { generateUUID } from "@/lib/utils";

/**
 * Platform Langfuse Client
 * 
 * Provides unified tracing for:
 * - Privacy tracking (Local vs Cloud)
 * - Tool reliability monitoring
 * - Resource utilization
 */
class PlatformTelemetry {
  private static instance: PlatformTelemetry;
  private langfuse: Langfuse | null = null;
  private currentTraceId: string | null = null;

  private constructor() {
    // Only initialize if we have environment variables (canonical production check)
    if (process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY || process.env.LANGFUSE_SECRET_KEY) {
      this.langfuse = new Langfuse();
    }
  }

  public static getInstance(): PlatformTelemetry {
    if (!PlatformTelemetry.instance) {
      PlatformTelemetry.instance = new PlatformTelemetry();
    }
    return PlatformTelemetry.instance;
  }

  /**
   * Start a new trace for a user session or request
   */
  public startTrace(name: string, userId?: string, metadata?: Record<string, any>) {
    if (!this.langfuse) return null;
    
    const traceId = generateUUID();
    this.currentTraceId = traceId;
    
    return this.langfuse.trace({
      id: traceId,
      name,
      userId,
      metadata: {
        ...metadata,
        platform: typeof window !== 'undefined' && (window as any).allternit?.backend ? 'desktop' : 'web',
      },
      tags: [
        metadata?.isLocal ? 'privacy:local' : 'privacy:cloud'
      ]
    });
  }

  /**
   * Record a tool execution with success/failure status
   */
  public recordTool(traceId: string, toolName: string, status: 'success' | 'failure', duration?: number, error?: string) {
    if (!this.langfuse) return;

    const span = this.langfuse.span({
      traceId,
      name: `tool:${toolName}`,
      startTime: Date.now() - (duration || 0),
      metadata: { status, error }
    });

    span.update({
      endTime: Date.now(),
      output: { status, error }
    });
  }

  /**
   * Global flush
   */
  public async flush() {
    if (this.langfuse) {
      await this.langfuse.flushAsync();
    }
  }
}

export const platformTelemetry = PlatformTelemetry.getInstance();
