/**
 * Session State Tracker
 * 
 * Indexes run state from allternit-workspace/run_state/
 * for session continuity and recovery
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { MemoryOrchestrator } from '../orchestrator.js';

/**
 * Run state structure (simplified)
 */
interface RunState {
  run_id: string;
  graph_id: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  node_states?: Array<{
    node_id: string;
    status: string;
    output?: unknown;
  }>;
  resume_cursor?: {
    next_nodes: string[];
    last_checkpoint?: string;
  };
  receipts?: string[];
  artifacts?: Array<{
    name: string;
    path: string;
    type: string;
  }>;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/**
 * Session State Tracker class
 */
export class SessionTracker {
  private orchestrator: MemoryOrchestrator;
  private runStateDir: string;
  private trackedCount = 0;
  private errorCount = 0;

  constructor(orchestrator: MemoryOrchestrator, runStateDir: string) {
    this.orchestrator = orchestrator;
    this.runStateDir = runStateDir;
  }

  /**
   * Track all session states
   */
  async trackAll(): Promise<{
    total: number;
    success: number;
    errors: number;
    active: number;
    completed: number;
  }> {
    console.log('SessionTracker: Starting session state tracking...');
    console.log(`SessionTracker: Scanning directory: ${this.runStateDir}`);

    // Find all run state JSON files
    const stateFiles = await glob('*.json', {
      cwd: this.runStateDir,
      absolute: true,
    });

    console.log(`SessionTracker: Found ${stateFiles.length} run state files`);

    let activeCount = 0;
    let completedCount = 0;

    // Process each state file
    for (const file of stateFiles) {
      try {
        const status = await this.trackSession(file);
        this.trackedCount++;
        
        if (status === 'running' || status === 'paused') {
          activeCount++;
        } else if (status === 'completed') {
          completedCount++;
        }
        
        // Progress logging every 10 sessions
        if (this.trackedCount % 10 === 0) {
          console.log(`SessionTracker: Tracked ${this.trackedCount}/${stateFiles.length} sessions...`);
        }
      } catch (error) {
        this.errorCount++;
        console.error(`SessionTracker: Error tracking ${file}:`, error);
      }
    }

    console.log('SessionTracker: Tracking complete');
    console.log(`  - Total files: ${stateFiles.length}`);
    console.log(`  - Successfully tracked: ${this.trackedCount}`);
    console.log(`  - Errors: ${this.errorCount}`);
    console.log(`  - Active sessions: ${activeCount}`);
    console.log(`  - Completed sessions: ${completedCount}`);

    return {
      total: stateFiles.length,
      success: this.trackedCount,
      errors: this.errorCount,
      active: activeCount,
      completed: completedCount,
    };
  }

  /**
   * Track a single session state
   */
  private async trackSession(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath, 'utf-8');
    const state = JSON.parse(content) as RunState;

    // Extract session information for memory
    const memoryContent = this.extractSessionInfo(state, filePath);

    // Ingest into memory
    const source = `session:${state.run_id}`;
    
    await this.orchestrator.ingest(
      JSON.stringify(memoryContent, null, 2),
      source
    );

    return state.status;
  }

  /**
   * Extract session information from run state
   */
  private extractSessionInfo(state: RunState, filePath: string): Record<string, unknown> {
    // Build node status summary
    const nodeSummary = (state.node_states || []).map(node => ({
      node_id: node.node_id,
      status: node.status,
      has_output: node.output !== undefined && node.output !== null,
    }));

    // Build artifact summary
    const artifactSummary = (state.artifacts || []).map(artifact => ({
      name: artifact.name,
      type: artifact.type,
      path: artifact.path,
    }));

    // Build resume info
    const resumeInfo = state.resume_cursor ? {
      has_resume_point: true,
      next_nodes: state.resume_cursor.next_nodes,
      last_checkpoint: state.resume_cursor.last_checkpoint,
    } : {
      has_resume_point: false,
    };

    return {
      run_id: state.run_id || 'unknown',
      graph_id: state.graph_id || 'unknown',
      status: state.status,
      node_count: (state.node_states || []).length,
      node_summary: nodeSummary,
      artifact_count: (state.artifacts || []).length,
      artifact_summary: artifactSummary,
      resume_info: resumeInfo,
      receipt_count: (state.receipts || []).length,
      created_at: state.created_at,
      updated_at: state.updated_at,
      file_path: filePath,
      
      // Searchable tags
      tags: this.generateTags(state),
      
      // For session recovery queries
      recovery_hints: {
        can_resume: state.status === 'paused' || (state.resume_cursor?.next_nodes?.length ?? 0) > 0,
        next_steps: state.resume_cursor?.next_nodes || [],
        last_known_state: state.node_states?.slice(-5).map(n => n.status),
      },
    };
  }

  /**
   * Generate searchable tags from session state
   */
  private generateTags(state: RunState): string[] {
    const tags: string[] = [];

    // Status tag
    tags.push(`status:${state.status}`);

    // Graph ID tag
    if (state.graph_id) {
      tags.push(`graph:${state.graph_id}`);
    }

    // Node count range tag
    const nodeCount = state.node_states?.length || 0;
    if (nodeCount > 0) {
      if (nodeCount < 10) {
        tags.push('size:small');
      } else if (nodeCount < 50) {
        tags.push('size:medium');
      } else {
        tags.push('size:large');
      }
    }

    return tags;
  }

  /**
   * Find sessions by graph ID
   */
  async findByGraphId(graphId: string, limit = 10): Promise<unknown[]> {
    const result = await this.orchestrator.query(
      `Find sessions for graph: ${graphId}`
    );

    return result.memories.slice(0, limit);
  }

  /**
   * Find active (resumable) sessions
   */
  async findActiveSessions(limit = 20): Promise<unknown[]> {
    const result = await this.orchestrator.query(
      'Find active or paused sessions that can be resumed'
    );

    return result.memories.filter(
      (m: any) => m.recovery_hints?.can_resume
    ).slice(0, limit);
  }

  /**
   * Get session recovery info
   */
  async getRecoveryInfo(runId: string): Promise<{
    canResume: boolean;
    nextSteps: string[];
    lastState: string[];
    artifacts: Array<{ name: string; type: string }>;
  } | null> {
    const result = await this.orchestrator.query(
      `Find session with run ID: ${runId}`
    );

    const memory = result.memories[0] as any;
    if (!memory) return null;

    return {
      canResume: memory.recovery_hints?.can_resume ?? false,
      nextSteps: memory.recovery_hints?.next_steps ?? [],
      lastState: memory.recovery_hints?.last_known_state ?? [],
      artifacts: memory.artifact_summary ?? [],
    };
  }

  /**
   * Get recent sessions
   */
  async getRecentSessions(limit = 10): Promise<unknown[]> {
    return this.orchestrator.getRecent(limit);
  }
}

/**
 * Main function to run session tracking
 */
async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     Allternitchitech Session State Tracker                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // Determine run state directory
  const workspaceRoot = process.env.ALLTERNIT_WORKSPACE_ROOT 
    || path.join(process.cwd(), '..', 'allternit-workspace');
  
  const runStateDir = path.join(workspaceRoot, 'run_state');

  // Check if run_state directory exists
  try {
    await fs.access(runStateDir);
  } catch {
    console.error(`Error: Run state directory not found: ${runStateDir}`);
    console.error('Please set ALLTERNIT_WORKSPACE_ROOT environment variable or run from the correct directory');
    process.exit(1);
  }

  // Initialize memory orchestrator
  const orchestrator = new MemoryOrchestrator();
  await orchestrator.initialize();

  // Run tracking
  const tracker = new SessionTracker(orchestrator, runStateDir);
  const result = await tracker.trackAll();

  console.log('');
  console.log('Tracking Summary:');
  console.log(`  Total sessions: ${result.total}`);
  console.log(`  Tracked: ${result.success}`);
  console.log(`  Errors: ${result.errors}`);
  console.log(`  Active sessions: ${result.active}`);
  console.log(`  Completed sessions: ${result.completed}`);
  console.log('');

  // Demo: Show active sessions
  if (result.active > 0) {
    console.log('Active Sessions (can be resumed):');
    const active = await tracker.findActiveSessions(5);
    for (const session of active) {
      const s = session as any;
      console.log(`  - ${s.run_id}: ${s.status} (${s.node_count} nodes)`);
    }
    console.log('');
  }

  // Show memory stats
  const stats = orchestrator.getStats();
  console.log('Memory Statistics:');
  console.log(`  Total memories: ${stats.memories.total}`);
  console.log(`  Insights: ${stats.insights}`);
  console.log(`  Connections: ${stats.connections}`);
  console.log('');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
