/**
 * Playground Tools
 *
 * Agent tools for playground interaction.
 */

import { playgroundStore } from './store';
import type { Playground, PlaygroundEvent } from './types';

// ============================================================================
// Tool Definitions
// ============================================================================

export interface PlaygroundWatchOptions {
  id: string;
  timeout?: number;
}

export interface PlaygroundOpenOptions {
  id: string;
}

export interface PlaygroundSubmitOptions {
  id: string;
  output: {
    prompt?: string;
    patch?: unknown;
  };
}

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Watch a playground for events
 * 
 * @example
 * ```typescript
 * const playground = await playground.watch({ id: 'pg_123' });
 * ```
 */
export async function playgroundWatch(options: PlaygroundWatchOptions): Promise<Playground | null> {
  const playground = await playgroundStore.get(options.id);
  return playground;
}

/**
 * Open a playground
 * 
 * @example
 * ```typescript
 * await playground.open({ id: 'pg_123' });
 * ```
 */
export async function playgroundOpen(options: PlaygroundOpenOptions): Promise<void> {
  await playgroundStore.emitEvent(options.id, {
    id: `evt_${Date.now()}`,
    playgroundId: options.id,
    type: 'PLAYGROUND_OPENED',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Submit playground output
 * 
 * @example
 * ```typescript
 * await playground.submit({
 *   id: 'pg_123',
 *   output: {
 *     prompt: 'Generated prompt text...',
 *     patch: { patches: [...] }
 *   }
 * });
 * ```
 */
export async function playgroundSubmit(options: PlaygroundSubmitOptions): Promise<void> {
  const { id, output } = options;
  
  // Emit submit event
  await playgroundStore.emitEvent(id, {
    id: `evt_${Date.now()}`,
    playgroundId: id,
    type: 'SUBMIT_OUTPUT',
    timestamp: new Date().toISOString(),
    data: { output },
  });

  // Update playground outputs
  const playground = await playgroundStore.get(id);
  if (playground) {
    playground.outputs = {
      ...playground.outputs,
      prompt: output.prompt ? {
        text: output.prompt,
        metadata: {
          templateType: playground.templateType,
          generatedAt: new Date().toISOString(),
          inputHash: generateHash(JSON.stringify(playground.inputs)),
        },
      } : playground.outputs?.prompt,
      patch: output.patch as any,
    };
    await playgroundStore.update(id, playground);
  }
}

/**
 * Record control change event
 */
export async function playgroundControlChange(
  playgroundId: string,
  controlId: string,
  newValue: unknown
): Promise<void> {
  await playgroundStore.emitEvent(playgroundId, {
    id: `evt_${Date.now()}`,
    playgroundId,
    type: 'CONTROL_CHANGED',
    timestamp: new Date().toISOString(),
    data: { controlId, newValue },
  });
}

/**
 * Record comment added event
 */
export async function playgroundCommentAdded(
  playgroundId: string,
  comment: {
    id: string;
    author: string;
    content: string;
    target?: string;
  }
): Promise<void> {
  await playgroundStore.emitEvent(playgroundId, {
    id: `evt_${Date.now()}`,
    playgroundId,
    type: 'COMMENT_ADDED',
    timestamp: new Date().toISOString(),
    data: { comment },
  });
}

/**
 * Record approval given event
 */
export async function playgroundApprovalGiven(
  playgroundId: string,
  approval: {
    id: string;
    author: string;
    target: string;
    approved: boolean;
  }
): Promise<void> {
  await playgroundStore.emitEvent(playgroundId, {
    id: `evt_${Date.now()}`,
    playgroundId,
    type: 'APPROVAL_GIVEN',
    timestamp: new Date().toISOString(),
    data: { approval },
  });
}

/**
 * Record agent applied patch event
 */
export async function playgroundAgentAppliedPatch(
  playgroundId: string,
  patch: {
    path: string;
    appliedAt: string;
    agentId: string;
  }
): Promise<void> {
  await playgroundStore.emitEvent(playgroundId, {
    id: `evt_${Date.now()}`,
    playgroundId,
    type: 'AGENT_APPLIED_PATCH',
    timestamp: new Date().toISOString(),
    data: { patch },
  });
}

// ============================================================================
// Utilities
// ============================================================================

function generateHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ============================================================================
// Tool Registry Export
// ============================================================================

export const playgroundTools = {
  watch: playgroundWatch,
  open: playgroundOpen,
  submit: playgroundSubmit,
  controlChange: playgroundControlChange,
  commentAdded: playgroundCommentAdded,
  approvalGiven: playgroundApprovalGiven,
  agentAppliedPatch: playgroundAgentAppliedPatch,
};
