/**
 * Observability - Event Log
 * 
 * Records hook events, gate decisions, worker lifecycle to events.jsonl
 * Provides replay and diff capabilities.
 */

import * as fs from 'fs';
import * as path from 'path';
import { HookEvent, RunId, CorrelationId } from '../types';

export interface ObservabilityConfig {
  outputDir: string;
  runId: RunId;
  enableConsole?: boolean;
}

export interface EventLogEntry extends HookEvent {
  sequence: number;
  logTimestamp: string;
}

export interface RunManifest {
  runId: RunId;
  startedAt: string;
  endedAt?: string;
  status: 'running' | 'completed' | 'failed';
  eventCount: number;
  correlationIds: CorrelationId[];
}

export class ObservabilityLogger {
  private config: ObservabilityConfig;
  private logPath: string;
  private manifestPath: string;
  private sequence = 0;
  private correlationIds: Set<CorrelationId> = new Set();
  private startTime: string;

  constructor(config: ObservabilityConfig) {
    this.config = config;
    this.startTime = new Date().toISOString();
    
    const runDir = path.join(config.outputDir, config.runId);
    fs.mkdirSync(runDir, { recursive: true });
    
    this.logPath = path.join(runDir, 'events.jsonl');
    this.manifestPath = path.join(runDir, 'manifest.json');

    this.writeManifest();
  }

  /**
   * Log a hook event
   */
  async logEvent(event: HookEvent): Promise<void> {
    this.sequence++;
    this.correlationIds.add(event.correlationId);

    const entry: EventLogEntry = {
      ...event,
      sequence: this.sequence,
      logTimestamp: new Date().toISOString(),
    };

    // Append to JSONL
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(this.logPath, line, 'utf-8');

    // Console output if enabled
    if (this.config.enableConsole) {
      console.log(`[${entry.sequence}] ${entry.type}: ${event.correlationId}`);
    }

    // Update manifest
    this.writeManifest();
  }

  /**
   * Log a gate decision
   */
  async logGateDecision(
    correlationId: CorrelationId,
    tool: string,
    decision: 'ALLOW' | 'BLOCK' | 'TRANSFORM' | 'REQUIRE_APPROVAL',
    reason?: string
  ): Promise<void> {
    await this.logEvent({
      type: 'PreToolUse', // Reuse hook type for consistency
      timestamp: new Date().toISOString(),
      runId: this.config.runId,
      correlationId,
      payload: {
        gateDecision: {
          tool,
          decision,
          reason,
        },
      },
    });
  }

  /**
   * Log worker lifecycle event
   */
  async logWorkerEvent(
    eventType: 'spawned' | 'running' | 'completed' | 'failed' | 'terminated',
    workerId: string,
    role: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.logEvent({
      type: 'SubagentStart', // Reuse for worker spawn
      timestamp: new Date().toISOString(),
      runId: this.config.runId,
      correlationId: `corr_worker_${workerId}`,
      payload: {
        workerEvent: eventType,
        workerId,
        role,
        ...metadata,
      },
    });
  }

  /**
   * Finalize the run manifest
   */
  async finalize(status: 'completed' | 'failed'): Promise<void> {
    const manifest: RunManifest = {
      runId: this.config.runId,
      startedAt: this.startTime,
      endedAt: new Date().toISOString(),
      status,
      eventCount: this.sequence,
      correlationIds: Array.from(this.correlationIds),
    };

    fs.writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  /**
   * Read all events
   */
  async readEvents(): Promise<EventLogEntry[]> {
    if (!fs.existsSync(this.logPath)) {
      return [];
    }

    const content = fs.readFileSync(this.logPath, 'utf-8');
    const lines = content.trim().split('\n');
    
    return lines
      .filter(line => line.trim())
      .map(line => JSON.parse(line) as EventLogEntry);
  }

  /**
   * Filter events by type
   */
  async filterEventsByType(eventType: string): Promise<EventLogEntry[]> {
    const events = await this.readEvents();
    return events.filter(e => e.type === eventType);
  }

  /**
   * Filter events by correlation ID
   */
  async filterEventsByCorrelation(correlationId: CorrelationId): Promise<EventLogEntry[]> {
    const events = await this.readEvents();
    return events.filter(e => e.correlationId === correlationId);
  }

  /**
   * Get run manifest
   */
  getManifest(): RunManifest {
    return {
      runId: this.config.runId,
      startedAt: this.startTime,
      status: 'running',
      eventCount: this.sequence,
      correlationIds: Array.from(this.correlationIds),
    };
  }

  private writeManifest(): void {
    const manifest = this.getManifest();
    fs.writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  }
}

// Factory function
export function createObservabilityLogger(config: ObservabilityConfig): ObservabilityLogger {
  return new ObservabilityLogger(config);
}
