/**
 * Replay and Diff
 * 
 * Replay: Re-run a DAG using the same WIHs/policies/tool schemas
 * Diff: Compare two runs by event stream + receipts
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventLogEntry, RunManifest } from './events';

export interface ReplayConfig {
  sourceRunId: string;
  sourceDir: string;
  targetDir: string;
  dryRun?: boolean;
}

export interface ReplayPlan {
  canReplay: boolean;
  reason?: string;
  steps: ReplayStep[];
}

export interface ReplayStep {
  sequence: number;
  type: string;
  tool?: string;
  args?: Record<string, unknown>;
  expectedDecision?: string;
}

export interface DiffResult {
  identical: boolean;
  differences: Difference[];
  summary: {
    sourceEventCount: number;
    targetEventCount: number;
    addedEvents: number;
    removedEvents: number;
    modifiedEvents: number;
  };
}

export interface Difference {
  type: 'added' | 'removed' | 'modified';
  sequence?: number;
  sourceEvent?: EventLogEntry;
  targetEvent?: EventLogEntry;
  fieldChanges?: FieldChange[];
}

export interface FieldChange {
  field: string;
  sourceValue: unknown;
  targetValue: unknown;
}

export class ReplayEngine {
  /**
   * Load events from a run
   */
  async loadEvents(runId: string, baseDir: string): Promise<EventLogEntry[]> {
    const logPath = path.join(baseDir, runId, 'events.jsonl');
    
    if (!fs.existsSync(logPath)) {
      throw new Error(`Events not found for run ${runId} at ${logPath}`);
    }

    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.trim().split('\n');
    
    return lines
      .filter(line => line.trim())
      .map(line => JSON.parse(line) as EventLogEntry);
  }

  /**
   * Load manifest from a run
   */
  async loadManifest(runId: string, baseDir: string): Promise<RunManifest> {
    const manifestPath = path.join(baseDir, runId, 'manifest.json');
    
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Manifest not found for run ${runId}`);
    }

    const content = fs.readFileSync(manifestPath, 'utf-8');
    return JSON.parse(content) as RunManifest;
  }

  /**
   * Create a replay plan from source events
   */
  async createReplayPlan(config: ReplayConfig): Promise<ReplayPlan> {
    try {
      const events = await this.loadEvents(config.sourceRunId, config.sourceDir);
      const manifest = await this.loadManifest(config.sourceRunId, config.sourceDir);

      const steps: ReplayStep[] = [];

      for (const event of events) {
        if (event.type === 'PreToolUse') {
          const payload = event.payload as { toolCall?: { tool: string; args: Record<string, unknown> } };
          if (payload?.toolCall) {
            steps.push({
              sequence: event.sequence,
              type: event.type,
              tool: payload.toolCall.tool,
              args: payload.toolCall.args,
            });
          }
        } else if (event.type === 'SubagentStart') {
          steps.push({
            sequence: event.sequence,
            type: 'worker_spawn',
          });
        }
      }

      return {
        canReplay: true,
        steps,
      };
    } catch (error) {
      return {
        canReplay: false,
        reason: error instanceof Error ? error.message : String(error),
        steps: [],
      };
    }
  }

  /**
   * Diff two runs
   */
  async diffRuns(
    sourceRunId: string,
    targetRunId: string,
    baseDir: string
  ): Promise<DiffResult> {
    const sourceEvents = await this.loadEvents(sourceRunId, baseDir);
    const targetEvents = await this.loadEvents(targetRunId, baseDir);

    const differences: Difference[] = [];
    const sourceMap = new Map(sourceEvents.map(e => [e.sequence, e]));
    const targetMap = new Map(targetEvents.map(e => [e.sequence, e]));

    // Find all unique sequences
    const allSequences = new Set([
      ...sourceEvents.map(e => e.sequence),
      ...targetEvents.map(e => e.sequence),
    ]);

    for (const seq of allSequences) {
      const sourceEvent = sourceMap.get(seq);
      const targetEvent = targetMap.get(seq);

      if (!sourceEvent && targetEvent) {
        differences.push({
          type: 'added',
          sequence: seq,
          targetEvent,
        });
      } else if (sourceEvent && !targetEvent) {
        differences.push({
          type: 'removed',
          sequence: seq,
          sourceEvent,
        });
      } else if (sourceEvent && targetEvent) {
        const fieldChanges = this.compareEvents(sourceEvent, targetEvent);
        if (fieldChanges.length > 0) {
          differences.push({
            type: 'modified',
            sequence: seq,
            sourceEvent,
            targetEvent,
            fieldChanges,
          });
        }
      }
    }

    return {
      identical: differences.length === 0,
      differences,
      summary: {
        sourceEventCount: sourceEvents.length,
        targetEventCount: targetEvents.length,
        addedEvents: differences.filter(d => d.type === 'added').length,
        removedEvents: differences.filter(d => d.type === 'removed').length,
        modifiedEvents: differences.filter(d => d.type === 'modified').length,
      },
    };
  }

  /**
   * Verify determinism by replaying and comparing
   */
  async verifyDeterminism(
    runId: string,
    baseDir: string,
    replayFn: (plan: ReplayPlan) => Promise<string>
  ): Promise<{
    deterministic: boolean;
    originalRun: string;
    replayRun: string;
    diff: DiffResult;
  }> {
    // Create replay plan
    const plan = await this.createReplayPlan({
      sourceRunId: runId,
      sourceDir: baseDir,
      targetDir: baseDir,
    });

    if (!plan.canReplay) {
      throw new Error(`Cannot replay: ${plan.reason}`);
    }

    // Execute replay
    const replayRunId = await replayFn(plan);

    // Diff original vs replay
    const diff = await this.diffRuns(runId, replayRunId, baseDir);

    return {
      deterministic: diff.identical,
      originalRun: runId,
      replayRun: replayRunId,
      diff,
    };
  }

  /**
   * Compare two events and return field-level differences
   */
  private compareEvents(source: EventLogEntry, target: EventLogEntry): FieldChange[] {
    const changes: FieldChange[] = [];
    const fieldsToCompare = ['type', 'timestamp', 'payload'];

    for (const field of fieldsToCompare) {
      const sourceValue = source[field as keyof EventLogEntry];
      const targetValue = target[field as keyof EventLogEntry];

      if (JSON.stringify(sourceValue) !== JSON.stringify(targetValue)) {
        changes.push({
          field,
          sourceValue,
          targetValue,
        });
      }
    }

    return changes;
  }
}

// Factory function
export function createReplayEngine(): ReplayEngine {
  return new ReplayEngine();
}
