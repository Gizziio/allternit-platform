/**
 * Bot Memory Injection
 *
 * Reads from the isolated bot-memory-store and injects promoted/pinned facts
 * into the agent session context. The actual secret material and memory records
 * stay client-side; only a formatted summary block reaches the runtime prompt.
 */

import { createBotMemoryStore } from './bot-memory-store';
import type { BotMemoryRecord } from './bot-memory-contracts';

const globalBotMemoryStore = createBotMemoryStore();

export interface RecallBotMemoriesOptions {
  tenantId: string;
  botId: string;
  query?: string;
  limit?: number;
}

export interface RecallBotMemoriesResult {
  memories: BotMemoryRecord[];
  contextBlock: string;
}

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export function formatMemoryContext(memories: BotMemoryRecord[]): string {
  if (memories.length === 0) {
    return '';
  }

  const lines = memories.map((memory) => {
    const scope = memory.scope ?? 'bot';
    const sensitivity = memory.sensitivity ?? 'internal';
    const confidence = formatConfidence(memory.confidence ?? 0.8);
    return `- [${scope}${memory.sessionId ? `:${memory.sessionId.slice(-6)}` : ''}${memory.projectId ? `:${memory.projectId.slice(-6)}` : ''}] ${memory.content} (confidence: ${confidence}, sensitivity: ${sensitivity})`;
  });

  return `Bot Memory (learned facts & preferences):\n${lines.join('\n')}`;
}

export function recallBotMemories(
  options: RecallBotMemoriesOptions,
): RecallBotMemoriesResult {
  const { tenantId, botId, query, limit = 5 } = options;

  const memories = globalBotMemoryStore.queryMemories({
    tenantId,
    botId,
    contains: query,
    status: ['promoted', 'pinned'],
    limit,
  });

  return {
    memories,
    contextBlock: formatMemoryContext(memories),
  };
}
