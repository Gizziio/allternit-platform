// packages/executor-superconductor/src/superconductor.executor.ts

import { Executor, ParallelRun, ExecutionResult, ExecutionStatus, ExecutionUpdate, VariantResult } from '@allternit/executor-core';
import { CanvasEventMapper } from './canvas-event-mapper';

interface SuperconductorConfig {
  apiKey: string;
  endpoint: string;
  pollingInterval: number;
  timeout: number;
}

export class SuperconductorExecutor implements Executor {
  private config: SuperconductorConfig;
  private readonly DEFAULT_CONFIG: Required<SuperconductorConfig> = {
    apiKey: '',
    endpoint: 'http://localhost:3010',
    pollingInterval: 3000, // Faster polling for local dev
    timeout: 300000 
  };

  constructor(config: Partial<SuperconductorConfig> = {}) {
    this.config = {
      ...this.DEFAULT_CONFIG,
      ...config
    };

    if (!this.config.apiKey) {
      throw new Error('SuperconductorExecutor requires an API key');
    }
  }

  async execute(run: ParallelRun): Promise<ExecutionResult> {
    console.log(`[SuperconductorExecutor] Executing parallel run: ${run.runId}`);

    // Validate run parameters
    if (!run.goal) {
      throw new Error('ParallelRun must have a goal');
    }

    if (!run.variants || run.variants.length === 0) {
      throw new Error('ParallelRun must have at least one variant');
    }

    // Submit the parallel run to Superconductor
    const response = await fetch(`${this.config.endpoint}/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'X-A2rchitech-Run-ID': run.runId,
        'X-Request-ID': run.runId
      },
      body: JSON.stringify(this.mapToSuperconductorFormat(run))
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to submit run to Superconductor: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const job = await response.json();
    console.log(`[SuperconductorExecutor] Submitted run ${run.runId}, job ID: ${job.jobId}`);

    // Poll for completion with timeout
    return this.pollForResultWithTimeout(job.jobId, run.runId);
  }

  private mapToSuperconductorFormat(run: ParallelRun) {
    // Map A2rchitech ParallelRun format to Superconductor format
    return {
      jobId: run.runId,
      goal: run.goal,
      variants: run.variants.map(variant => ({
        variantId: variant.variantId,
        model: variant.model,
        agentType: variant.agentType,
        params: variant.params,
        priority: variant.priority || 1
      })),
      verificationProfile: run.verificationProfile || {
        tests: false,
        linting: false,
        typechecking: false,
        customChecks: []
      },
      snapshotId: run.snapshotId,
      createdAt: run.createdAt
    };
  }

  private async pollForResultWithTimeout(jobId: string, runId: string): Promise<ExecutionResult> {
    const startTime = Date.now();

    while (Date.now() - startTime < this.config.timeout) {
      const status = await this.pollStatus(runId);
      console.log(`[SuperconductorExecutor] Polling status for ${runId}: ${status.status} (${status.progress}%)`);

      if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
        // Fetch final results
        const response = await fetch(`${this.config.endpoint}/runs/${runId}/results`, {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`
          }
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Failed to fetch results from Superconductor: ${response.status} ${response.statusText} - ${errorBody}`);
        }

        const results = await response.json();
        return this.mapFromSuperconductorResults(results, runId);
      }

      // Wait before next poll
      await this.delay(this.config.pollingInterval);
    }

    // Timeout reached
    throw new Error(`SuperconductorExecutor timeout reached (${this.config.timeout}ms) for run ${runId}`);
  }

  private mapFromSuperconductorResults(superconductorResults: any, runId: string): ExecutionResult {
    // Validate and map Superconductor results format to A2rchitech format
    if (!superconductorResults || !superconductorResults.variants) {
      throw new Error(`Invalid results format received from Superconductor for run ${runId}`);
    }

    const mappedResults: VariantResult[] = superconductorResults.variants.map((variant: any) => {
      if (!variant.variantId) {
        throw new Error(`Missing variantId in Superconductor result for run ${runId}`);
      }

      return {
        variantId: variant.variantId,
        status: variant.status || 'failed',
        output: variant.output,
        previewUrl: variant.previewUrl,
        diff: variant.diff,
        verificationResults: Array.isArray(variant.verificationResults) ? variant.verificationResults : [],
        error: variant.error
      };
    });

    return {
      runId,
      status: superconductorResults.status as 'completed' | 'failed' | 'cancelled' | 'partial',
      results: mappedResults,
      createdAt: superconductorResults.createdAt || new Date().toISOString(),
      completedAt: superconductorResults.completedAt || new Date().toISOString()
    };
  }

  async pollStatus(runId: string): Promise<ExecutionStatus> {
    const response = await fetch(`${this.config.endpoint}/runs/${runId}/status`, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'X-Request-ID': runId
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to poll status from Superconductor: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const status = await response.json();

    // Validate required fields
    if (!status.status) {
      throw new Error(`Invalid status response from Superconductor for run ${runId}`);
    }

    return {
      runId,
      status: status.status,
      progress: typeof status.progress === 'number' ? status.progress : 0,
      activeVariants: typeof status.activeVariants === 'number' ? status.activeVariants : 0,
      completedVariants: typeof status.completedVariants === 'number' ? status.completedVariants : 0,
      totalVariants: typeof status.totalVariants === 'number' ? status.totalVariants : 0,
      updatedAt: status.updatedAt || new Date().toISOString()
    };
  }

  async cancel(runId: string): Promise<void> {
    const response = await fetch(`${this.config.endpoint}/runs/${runId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'X-Request-ID': runId
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to cancel run in Superconductor: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    console.log(`[SuperconductorExecutor] Cancelled run: ${runId}`);
  }

  async *streamUpdates(runId: string): AsyncIterable<ExecutionUpdate> {
    // Create a streaming connection to Superconductor events
    const eventsUrl = `${this.config.endpoint}/runs/${runId}/events?apiKey=${encodeURIComponent(this.config.apiKey)}`;

    // Use fetch with streaming for better compatibility
    const response = await fetch(eventsUrl, {
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok || !response.body) {
      throw new Error(`Failed to establish event stream with Superconductor: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = line.slice(6); // Remove 'data: ' prefix
              const parsedData = JSON.parse(eventData);

              // Map Superconductor event to A2rchitech format
              const canvasEvent = CanvasEventMapper.mapSuperconductorToCanvas({
                eventType: parsedData.type || parsedData.eventType,
                payload: parsedData.payload || parsedData,
                timestamp: parsedData.timestamp || new Date().toISOString(),
                jobId: runId,
                variantId: parsedData.variantId
              });

              if (canvasEvent) {
                yield {
                  runId,
                  variantId: canvasEvent.variantId,
                  eventType: mapCanvasEventTypeToExecutionUpdate(canvasEvent.type),
                  payload: canvasEvent.payload,
                  timestamp: new Date(canvasEvent.ts).toISOString()
                } as ExecutionUpdate;
              }
            } catch (error) {
              console.warn(`[SuperconductorExecutor] Failed to parse event data:`, line, error);
              continue;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Maps CanvasEventType to ExecutionUpdateEventType
 */
function mapCanvasEventTypeToExecutionUpdate(canvasEventType: string): ExecutionUpdate['eventType'] {
  switch (canvasEventType) {
    case 'run.parallel.launch':
      return 'started';
    case 'render.preview.url':
      return 'preview-ready';
    case 'render.diff.patch':
      return 'diff-ready';
    case 'render.verification.summary':
      return 'verification-result';
    case 'status.run':
      return 'progress';
    default:
      return 'progress';
  }
}