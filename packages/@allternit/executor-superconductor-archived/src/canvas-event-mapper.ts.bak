// packages/executor-superconductor/src/canvas-event-mapper.ts

// Canvas Event Protocol Mapping
export type CanvasEventType = 
  | 'run.parallel.launch'      // Launch Implementations GenTab
  | 'render.preview.url'       // Live Preview GenTab
  | 'render.diff.patch'        // Diff Viewer GenTab
  | 'render.verification.summary' // Test/Lint/Typecheck GenTab
  | 'status.run';              // Progress + degraded states

export interface CanvasEvent {
  type: CanvasEventType;
  topic: string;
  payload: any;
  ts: number;
  runId: string;
  variantId?: string;
}

export interface SuperconductorEvent {
  eventType: string;
  payload: any;
  timestamp: string;
  jobId: string;
  variantId?: string;
}

export class CanvasEventMapper {
  /**
   * Maps Superconductor events to A2rchitech Canvas events
   */
  static mapSuperconductorToCanvas(superconductorEvent: SuperconductorEvent): CanvasEvent | null {
    const timestamp = new Date(superconductorEvent.timestamp).getTime();
    
    switch (superconductorEvent.eventType) {
      case 'job.started':
        return {
          type: 'run.parallel.launch',
          topic: 'parallel.execution',
          payload: {
            runId: superconductorEvent.jobId,
            variants: superconductorEvent.payload?.variants || [],
            goal: superconductorEvent.payload?.goal
          },
          ts: timestamp,
          runId: superconductorEvent.jobId
        };
        
      case 'variant.preview.ready':
        return {
          type: 'render.preview.url',
          topic: 'preview.rendered',
          payload: {
            previewUrl: superconductorEvent.payload?.previewUrl,
            variantId: superconductorEvent.variantId,
            runId: superconductorEvent.jobId
          },
          ts: timestamp,
          runId: superconductorEvent.jobId,
          variantId: superconductorEvent.variantId
        };
        
      case 'variant.diff.generated':
        return {
          type: 'render.diff.patch',
          topic: 'diff.generated',
          payload: {
            diff: superconductorEvent.payload?.diff,
            variantId: superconductorEvent.variantId,
            runId: superconductorEvent.jobId
          },
          ts: timestamp,
          runId: superconductorEvent.jobId,
          variantId: superconductorEvent.variantId
        };
        
      case 'variant.verification.completed':
        return {
          type: 'render.verification.summary',
          topic: 'verification.completed',
          payload: {
            verificationResults: superconductorEvent.payload?.verificationResults,
            variantId: superconductorEvent.variantId,
            runId: superconductorEvent.jobId
          },
          ts: timestamp,
          runId: superconductorEvent.jobId,
          variantId: superconductorEvent.variantId
        };
        
      case 'job.status.update':
        return {
          type: 'status.run',
          topic: 'run.status',
          payload: {
            status: superconductorEvent.payload?.status,
            progress: superconductorEvent.payload?.progress,
            activeVariants: superconductorEvent.payload?.activeVariants,
            completedVariants: superconductorEvent.payload?.completedVariants
          },
          ts: timestamp,
          runId: superconductorEvent.jobId
        };
        
      case 'job.completed':
        return {
          type: 'status.run',
          topic: 'run.status',
          payload: {
            status: 'completed',
            results: superconductorEvent.payload?.results,
            completedAt: superconductorEvent.timestamp
          },
          ts: timestamp,
          runId: superconductorEvent.jobId
        };
        
      case 'job.failed':
        return {
          type: 'status.run',
          topic: 'run.status',
          payload: {
            status: 'failed',
            error: superconductorEvent.payload?.error,
            failedAt: superconductorEvent.timestamp
          },
          ts: timestamp,
          runId: superconductorEvent.jobId
        };
        
      default:
        // Ignore unmapped events
        console.debug(`[CanvasEventMapper] Unmapped Superconductor event: ${superconductorEvent.eventType}`);
        return null;
    }
  }
  
  /**
   * Converts a stream of Superconductor events to Canvas events
   */
  static *mapSuperconductorStreamToCanvas(
    superconductorEvents: Iterable<SuperconductorEvent>
  ): Iterable<CanvasEvent> {
    for (const event of superconductorEvents) {
      const canvasEvent = this.mapSuperconductorToCanvas(event);
      if (canvasEvent) {
        yield canvasEvent;
      }
    }
  }
  
  /**
   * Maps batch results from Superconductor to Canvas events
   */
  static mapBatchResultsToCanvas(runId: string, results: any): CanvasEvent[] {
    const events: CanvasEvent[] = [];
    
    // Add run completion event
    events.push({
      type: 'status.run',
      topic: 'run.status',
      payload: {
        status: results.status,
        results: results.results,
        completedAt: new Date().toISOString()
      },
      ts: Date.now(),
      runId
    });
    
    // Add individual variant events
    if (results.results && Array.isArray(results.results)) {
      for (const result of results.results) {
        if (result.previewUrl) {
          events.push({
            type: 'render.preview.url',
            topic: 'preview.rendered',
            payload: {
              previewUrl: result.previewUrl,
              variantId: result.variantId,
              runId
            },
            ts: Date.now(),
            runId,
            variantId: result.variantId
          });
        }
        
        if (result.diff) {
          events.push({
            type: 'render.diff.patch',
            topic: 'diff.generated',
            payload: {
              diff: result.diff,
              variantId: result.variantId,
              runId
            },
            ts: Date.now(),
            runId,
            variantId: result.variantId
          });
        }
        
        if (result.verificationResults && result.verificationResults.length > 0) {
          events.push({
            type: 'render.verification.summary',
            topic: 'verification.completed',
            payload: {
              verificationResults: result.verificationResults,
              variantId: result.variantId,
              runId
            },
            ts: Date.now(),
            runId,
            variantId: result.variantId
          });
        }
      }
    }
    
    return events;
  }
}