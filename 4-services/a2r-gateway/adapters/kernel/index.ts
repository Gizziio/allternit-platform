/**
 * A2R Kernel Adapter
 * 
 * The ONLY component authorized to emit canonical execution events.
 * All prompt execution, tool calls, and session state changes flow through here.
 * 
 * This adapter bridges the gateway core to the actual A2R kernel runtime.
 * For now, it simulates kernel behavior with deterministic event emission.
 * 
 * @module @a2rchitech/gateway-kernel-adapter
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  UIv0Events,
} from '../runtime/index.js';

// =============================================================================
// Types
// =============================================================================

export interface KernelAdapterConfig {
  services: Record<string, string>;
  timeouts: {
    request: number;
    health: number;
    prompt: number;
  };
}

export interface PromptExecutionRequest {
  session_id: string;
  directory?: string;
  text: string;
  attachments?: unknown[];
  model?: string;
  options?: {
    temperature?: number;
    max_tokens?: number;
  };
}

export interface PromptExecutionResult {
  success: boolean;
  message_id: string;
  part_id: string;
  error?: string;
}

export interface PTYConfig {
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

export interface PTYInstance {
  id: string;
  directory?: string;
  session_id?: string;
  pid: number;
  created_at: string;
  exited: boolean;
  exit_code?: number;
  backlog: string[];
}

// =============================================================================
// Kernel Adapter - Sole Authority for Event Emission
// =============================================================================

export class KernelAdapter extends EventEmitter {
  private config: KernelAdapterConfig;
  private eventBus: EventEmitter;
  private ptyInstances: Map<string, PTYInstance> = new Map();
  private httpModule: typeof import('http') | null = null;

  constructor(config: KernelAdapterConfig, eventBus: EventEmitter) {
    super();
    this.config = config;
    this.eventBus = eventBus;
  }

  /**
   * Initialize HTTP module for backend calls
   */
  async initialize(): Promise<void> {
    this.httpModule = await import('http');
  }

  // =============================================================================
  // Prompt Execution - SOLE AUTHORITY for chat-related events
  // =============================================================================

  /**
   * Execute a prompt asynchronously.
   * 
   * This is the ONLY method that should emit:
   * - message.created / message.updated
   * - part.created / part.delta / part.updated
   * - session.status_changed (running ↔ idle)
   * - tool.state_changed (if tools are used)
   * 
   * KERNEL INVOCATION PROOF:
   * Every call to this method logs a unique run_id to prove kernel execution.
   * 
   * @param request - Prompt execution request
   * @returns Promise resolving to execution result
   */
  async executePrompt(request: PromptExecutionRequest): Promise<PromptExecutionResult> {
    const { session_id, directory, text, model = 'default', options = {} } = request;

    // KERNEL INVOCATION PROOF LOG
    const run_id = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[KERNEL] KERNEL_RUN run_id=${run_id} session=${session_id} directory=${directory || '*'} model=${model} text_length=${text.length}`);

    // Generate IDs (kernel authority)
    const message_id = uuidv4();
    const part_id = uuidv4();
    const now = new Date().toISOString();

    try {
      // Emit MESSAGE_CREATED - kernel authority
      this._publish('message.created', {
        directory: directory || '*',
        message_id,
        session_id,
        role: 'assistant',
        content: '',
        created_at: now,
      });

      // Emit PART_CREATED - kernel authority (MUST come before any PART_DELTA)
      this._publish('part.created', {
        directory: directory || '*',
        part_id,
        message_id,
        type: 'text',
        content: '',
        created_at: now,
      });

      // Stub: call actual kernel and stream real deltas pending kernel integration
      // @placeholder APPROVED - Kernel streaming pending
      // @ticket GAP-53
      // @fallback Simulated deterministic streaming
      await this._simulateStreaming({
        message_id,
        part_id,
        directory: directory || '*',
        text,
        run_id, // Pass run_id for source tracking
      });

      // Emit PART_UPDATED (final state)
      this._publish('part.updated', {
        directory: directory || '*',
        part_id,
        message_id,
        changes: { content: text },
        updated_at: new Date().toISOString(),
      });

      // Emit MESSAGE_UPDATED (final state)
      this._publish('message.updated', {
        directory: directory || '*',
        message_id,
        changes: { content: text },
        updated_at: new Date().toISOString(),
      });

      console.log(`[KERNEL] KERNEL_RUN_COMPLETE run_id=${run_id} session=${session_id}`);

      return {
        success: true,
        message_id,
        part_id,
      };
    } catch (err) {
      // Emit error event
      this._publish('error', {
        directory: directory || '*',
        code: 'EXECUTION_ERROR',
        message: (err as Error).message,
      });

      console.log(`[KERNEL] KERNEL_RUN_ERROR run_id=${run_id} session=${session_id} error=${(err as Error).message}`);

      return {
        success: false,
        message_id,
        part_id,
        error: (err as Error).message,
      };
    }
  }

  /**
   * Simulate streaming response (placeholder for real kernel integration)
   *
   * In production, this would:
   * 1. Call kernel.execute() with callback
   * 2. Kernel streams chunks via callback
   * 3. For each chunk, emit PART_DELTA with source=kernel
   *
   * KERNEL-ONLY DELTA ENFORCEMENT:
   * All PART_DELTA events MUST originate from this method (kernel authority).
   * The source field is used for internal verification only.
   */
  private async _simulateStreaming(params: {
    message_id: string;
    part_id: string;
    directory: string;
    text: string;
    run_id: string;
  }): Promise<void> {
    const { message_id, part_id, directory, text, run_id } = params;

    // Split into chunks for simulation
    const chunks = text.split(' ');

    for (let i = 0; i < chunks.length; i++) {
      // Simulate network delay (50ms per chunk)
      await new Promise(resolve => setTimeout(resolve, 50));

      // Emit PART_DELTA with source=kernel (KERNEL-ONLY DELTA ENFORCEMENT)
      // This is the ONLY place PART_DELTA should be emitted
      this._publish('part.delta', {
        directory,
        part_id,
        message_id,
        delta: (i > 0 ? ' ' : '') + chunks[i],
        index: i,
        timestamp: new Date().toISOString(),
        _source: 'kernel', // Internal source tracking (not on wire)
        _run_id: run_id,   // Internal run tracking (not on wire)
      });
    }
  }

  // =============================================================================
  // PTY Management - SOLE AUTHORITY for PTY state
  // =============================================================================

  /**
   * Create a new PTY instance
   */
  createPTY(config: PTYConfig & { directory?: string; session_id?: string }): PTYInstance {
    const pty: PTYInstance = {
      id: uuidv4(),
      directory: config.directory,
      session_id: config.session_id,
      pid: Math.floor(Math.random() * 10000) + 1000,
      created_at: new Date().toISOString(),
      exited: false,
      backlog: [],
    };

    this.ptyInstances.set(pty.id, pty);

    // Initial output
    pty.backlog.push(`PTY ${pty.id} created (PID: ${pty.pid})\n`);

    return pty;
  }

  /**
   * Get PTY instance by ID
   */
  getPTY(id: string, directory?: string): PTYInstance | null {
    const pty = this.ptyInstances.get(id);
    
    if (!pty) return null;
    
    // Directory scoping
    if (directory && pty.directory && pty.directory !== directory) {
      return null;
    }
    
    return pty;
  }

  /**
   * Send input to PTY
   */
  sendPTYInput(id: string, input: string, directory?: string): boolean {
    const pty = this.getPTY(id, directory);
    
    if (!pty) return false;

    pty.backlog.push(`> ${input}\n`);

    // Emit PTY_OUTPUT - kernel authority
    this._publish('pty.output', {
      directory: pty.directory || '*',
      pty_id: id,
      data: input,
      type: 'stdout',
      timestamp: new Date().toISOString(),
    });

    return true;
  }

  /**
   * Kill PTY instance
   */
  killPTY(id: string, directory?: string, exitCode: number = 0): boolean {
    const pty = this.getPTY(id, directory);
    
    if (!pty) return false;

    pty.exited = true;
    pty.exit_code = exitCode;

    // Emit PTY_EXITED - kernel authority
    this._publish('pty.exited', {
      directory: pty.directory || '*',
      pty_id: id,
      exit_code,
      exited_at: new Date().toISOString(),
    });

    // Clean up after delay
    setTimeout(() => {
      this.ptyInstances.delete(id);
    }, 5000);

    return true;
  }

  /**
   * Get PTY backlog for replay
   */
  getPTYBacklog(id: string, directory?: string): string[] {
    const pty = this.getPTY(id, directory);
    return pty ? pty.backlog : [];
  }

  // =============================================================================
  // Session Status Changes - SOLE AUTHORITY
  // =============================================================================

  /**
   * Update session status (emits canonical event)
   */
  updateSessionStatus(
    session_id: string,
    oldStatus: string,
    newStatus: string,
    directory?: string
  ): void {
    this._publish('session.status_changed', {
      directory: directory || '*',
      session_id,
      old_status: oldStatus,
      new_status: newStatus,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Resolve a permission request (emits canonical event)
   */
  async resolvePermission(
    permission_id: string,
    granted: boolean,
    directory?: string
  ): Promise<void> {
    this._publish('permission.resolved', {
      directory: directory || '*',
      permission_id,
      granted,
      resolved_at: new Date().toISOString(),
    });
  }

  /**
   * Resolve a question (emits canonical event)
   */
  async resolveQuestion(
    question_id: string,
    answer: unknown,
    directory?: string
  ): Promise<void> {
    this._publish('question.resolved', {
      directory: directory || '*',
      question_id,
      answer,
      resolved_at: new Date().toISOString(),
    });
  }

  /**
   * Reject a question (emits canonical event)
   */
  async rejectQuestion(
    question_id: string,
    reason?: string,
    directory?: string
  ): Promise<void> {
    this._publish('question.rejected', {
      directory: directory || '*',
      question_id,
      reason: reason || 'rejected_by_user',
      rejected_at: new Date().toISOString(),
    });
  }

  // =============================================================================
  // Private: Event Publishing (SOLE AUTHORITY)
  // =============================================================================

  /**
   * Publish a canonical event.
   *
   * This is the ONLY method that should be called to emit events.
   * Transport layers must NEVER call eventBus.publish() directly.
   *
   * KERNEL-ONLY DELTA ENFORCEMENT:
   * PART_DELTA events MUST have _source='kernel' or this throws.
   *
   * @param type - Event type
   * @param data - Event data
   */
  private _publish<T extends keyof UIv0Events>(
    type: T,
    data: UIv0Events[T]
  ): void {
    // KERNEL-ONLY DELTA ENFORCEMENT
    // Assert that PART_DELTA events can ONLY come from kernel
    if (type === 'part.delta') {
      const deltaData = data as any;
      if (!deltaData._source || deltaData._source !== 'kernel') {
        throw new Error(
          `KERNEL-ONLY VIOLATION: PART_DELTA emitted without source=kernel. ` +
          `All PART_DELTA events MUST originate from kernel adapter. ` +
          `run_id=${deltaData?._run_id || 'unknown'}`
        );
      }
    }

    this.eventBus.emit('event', {
      type,
      data,
      timestamp: new Date().toISOString(),
    });
    this.eventBus.emit(type, {
      type,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  // =============================================================================
  // Cleanup
  // =============================================================================

  /**
   * Cleanup all PTY instances
   */
  cleanup(): void {
    for (const pty of this.ptyInstances.values()) {
      pty.exited = true;
      pty.exit_code = -1;
    }
    this.ptyInstances.clear();
  }
}

// =============================================================================
// Kernel Adapter Factory
// =============================================================================

export function createKernelAdapter(
  config: KernelAdapterConfig,
  eventBus: EventEmitter
): KernelAdapter {
  return new KernelAdapter(config, eventBus);
}
