/**
 * Bot Memory Context Injection
 *
 * Reads promoted/pinned bot memories from the canonical bot-memory-store and
 * formats them as context injected into the chat/session system prompt.
 *
 * @module bot-memory-context
 */

import { createModuleLogger } from '@/lib/logger';
import {
  getDefaultBotMemoryStore,
  resetDefaultBotMemoryStore,
  type BotMemoryStore,
} from './bot-memory-store';
import type { Agent } from '@/lib/agents/agent.types';

const logger = createModuleLogger('BotMemoryContext');

// Reuse the canonical singleton store shared across the surface.
export function getBotMemoryStore(): BotMemoryStore {
  return getDefaultBotMemoryStore();
}

/** Reset the singleton memory store. Intended for tests only. */
export function resetBotMemoryStore(): void {
  resetDefaultBotMemoryStore();
}

export interface BotMemoryContextOptions {
  /** Tenant boundary. Defaults to a shared workspace tenant. */
  tenantId?: string;
  /** Maximum number of memories to include. */
  limit?: number;
  /** Highest sensitivity level to include (public < internal < confidential < secret). */
  maxSensitivity?: 'public' | 'internal' | 'confidential' | 'secret';
  /** Include pinned memories even if they would otherwise be excluded. */
  includePinned?: boolean;
  /** Scope retrieval to a specific session when provided. */
  sessionId?: string;
}

/**
 * Build a Markdown block summarizing a bot's durable memories.
 *
 * Only promoted and pinned memories are returned by default. Session-scoped
 * memories are included when a sessionId is provided.
 */
export function buildBotMemoryContext(
  botId: string,
  options: BotMemoryContextOptions = {},
): string {
  const {
    tenantId = 'default',
    limit = 20,
    maxSensitivity = 'internal',
    includePinned = true,
    sessionId,
  } = options;

  const store = getBotMemoryStore();

  const activeMemories = store.queryMemories({
    tenantId,
    botId,
    status: includePinned ? ['promoted', 'pinned'] : 'promoted',
    maxSensitivity,
    includeExpired: false,
    limit,
    sessionId,
  });

  if (activeMemories.length === 0) {
    return '';
  }

  const lines = [
    '## Bot Memory',
    '',
    'The following facts have been learned and approved for this bot:',
    '',
  ];

  for (const memory of activeMemories) {
    const scopeLabel = memory.scope === 'bot' ? '' : ` (${memory.scope})`;
    const pinMarker = memory.status === 'pinned' ? '📌 ' : '';
    lines.push(`- ${pinMarker}${memory.content}${scopeLabel}`);
  }

  return lines.join('\n');
}

/**
 * Inject formatted bot memory into a system prompt.
 *
 * The base system prompt is preserved; memory is appended so it does not
 * override explicit instructions.
 */
export function injectBotMemoryIntoSystemPrompt(
  agent: Agent,
  baseSystemPrompt: string,
  options?: BotMemoryContextOptions,
): string {
  if (!agent.id) {
    logger.debug('Agent has no id; skipping memory injection');
    return baseSystemPrompt;
  }

  try {
    const memoryContext = buildBotMemoryContext(agent.id, options);
    if (!memoryContext) {
      return baseSystemPrompt;
    }

    return [baseSystemPrompt, memoryContext].filter(Boolean).join('\n\n');
  } catch (err) {
    logger.warn(
      { err, botId: agent.id },
      'Failed to build memory context; returning base prompt',
    );
    return baseSystemPrompt;
  }
}

/**
 * Propose a memory candidate from a bot session message.
 *
 * This is a thin helper so callers (chat surfaces, tool handlers) can record
 * learned facts without importing the store directly.
 */
export function proposeBotMemory(
  botId: string,
  content: string,
  tenantId: string = 'default',
): void {
  const store = getBotMemoryStore();
  store.proposeMemory({
    botId,
    tenantId,
    scope: 'bot',
    content,
    provenance: {
      sourceType: 'assistant',
    },
    confidence: 0.8,
    sensitivity: 'internal',
    status: 'candidate',
  });
}
