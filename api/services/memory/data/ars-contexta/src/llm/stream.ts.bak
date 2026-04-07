/**
 * Streaming Response Handler
 * GAP-78: LLM Integration
 * 
 * WIH: GAP-78, Owner: T3-A1
 * 
 * Handles SSE (Server-Sent Events) streaming for LLM responses.
 * Provides buffering, buffering, and real-time processing.
 */

import type { LlmStreamChunk, Insight } from '../types.js';

/**
 * Stream processor configuration
 */
export interface StreamConfig {
  /** Buffer size for collecting chunks */
  bufferSize?: number;
  /** Callback for each chunk */
  onChunk?: (chunk: LlmStreamChunk) => void;
  /** Callback for accumulated content */
  onContent?: (content: string) => void;
  /** Callback when stream completes */
  onComplete?: (fullContent: string) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
}

/**
 * Stream accumulator collects chunks and builds final content
 */
export class StreamAccumulator {
  private chunks: LlmStreamChunk[] = [];
  private content = '';
  private config: StreamConfig;
  private isComplete = false;

  constructor(config: StreamConfig = {}) {
    this.config = config;
  }

  /**
   * Add a chunk to the accumulator
   */
  add(chunk: LlmStreamChunk): void {
    if (this.isComplete) {
      return;
    }

    this.chunks.push(chunk);
    this.content += chunk.delta;

    this.config.onChunk?.(chunk);
    this.config.onContent?.(this.content);

    if (chunk.finishReason === 'stop' || chunk.finishReason === 'length') {
      this.isComplete = true;
      this.config.onComplete?.(this.content);
    }
  }

  /**
   * Get accumulated content so far
   */
  getContent(): string {
    return this.content;
  }

  /**
   * Check if stream is complete
   */
  isFinished(): boolean {
    return this.isComplete;
  }

  /**
   * Get all chunks
   */
  getChunks(): LlmStreamChunk[] {
    return [...this.chunks];
  }
}

/**
 * Process LLM stream with insight extraction
 * Coordinates with 6Rs pipeline for real-time insight generation
 */
export async function* processStreamWithInsights(
  stream: AsyncGenerator<LlmStreamChunk>,
  options: {
    extractInsights?: boolean;
    minChunkSize?: number;
    insightCallback?: (insights: Insight[]) => void;
  } = {}
): AsyncGenerator<{ chunk: LlmStreamChunk; content: string; insights?: Insight[] }> {
  const { extractInsights = false, minChunkSize = 200, insightCallback } = options;
  const accumulator = new StreamAccumulator();
  let buffer = '';

  for await (const chunk of stream) {
    accumulator.add(chunk);
    buffer += chunk.delta;

    let insights: Insight[] | undefined;

    // Extract insights when buffer reaches threshold
    if (extractInsights && buffer.length >= minChunkSize) {
      insights = await extractInsightsFromBuffer(buffer);
      if (insights.length > 0) {
        insightCallback?.(insights);
      }
      buffer = ''; // Clear buffer after extraction
    }

    yield {
      chunk,
      content: accumulator.getContent(),
      insights,
    };
  }

  // Process remaining buffer
  if (extractInsights && buffer.length > 0) {
    const insights = await extractInsightsFromBuffer(buffer);
    if (insights.length > 0) {
      insightCallback?.(insights);
      yield {
        chunk: { id: 'final', delta: '', finishReason: 'stop' },
        content: accumulator.getContent(),
        insights,
      };
    }
  }
}

/**
 * Extract insights from content buffer
 * Placeholder for NLP/LLM-based extraction
 */
async function extractInsightsFromBuffer(buffer: string): Promise<Insight[]> {
  // STUBBED - Would integrate with insight generation logic
  // This is a lightweight extraction for streaming contexts
  const insights: Insight[] = [];

  // Simple pattern detection for streaming contexts
  const sentences = buffer.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    
    // Detect potential key insights (keywords-based heuristics)
    const insightPattern = /\b(important|significant|key|crucial|essential|notably|interestingly|discovered|found|revealed|shows|demonstrates|therefore|thus|consequently)\b/i;
    if (insightPattern.test(trimmed)) {
      insights.push({
        id: `stream_insight_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'pattern',
        description: trimmed,
        confidence: 0.6,
        relatedNotes: [],
        source: 'llm',
        timestamp: new Date().toISOString(),
      });
    }
  }

  return insights.slice(0, 3); // Limit insights per buffer
}

/**
 * Parse SSE (Server-Sent Events) stream
 */
export async function* parseSseStream(
  response: Response
): AsyncGenerator<LlmStreamChunk> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const chunk = parseSseLine(line);
        if (chunk) {
          yield chunk;
        }
      }
    }

    // Process remaining buffer
    if (buffer) {
      const chunk = parseSseLine(buffer);
      if (chunk) {
        yield chunk;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parse a single SSE line
 */
function parseSseLine(line: string): LlmStreamChunk | null {
  line = line.trim();
  
  if (!line.startsWith('data:')) {
    return null;
  }

  const data = line.slice(5).trim();

  if (data === '[DONE]') {
    return {
      id: 'done',
      delta: '',
      finishReason: 'stop',
    };
  }

  try {
    const parsed = JSON.parse(data);
    return {
      id: parsed.id ?? `sse_${Date.now()}`,
      delta: parsed.choices?.[0]?.delta?.content ?? '',
      finishReason: parsed.choices?.[0]?.finish_reason ?? null,
      usage: parsed.usage,
    };
  } catch {
    // Non-JSON data, treat as plain text
    return {
      id: `raw_${Date.now()}`,
      delta: data,
      finishReason: null,
    };
  }
}

/**
 * Create a mock stream for testing
 */
export function createMockStream(content: string, delayMs = 10): AsyncGenerator<LlmStreamChunk> {
  const words = content.split(' ');
  let index = 0;

  return (async function* () {
    while (index < words.length) {
      await new Promise(r => setTimeout(r, delayMs));
      
      const isLast = index === words.length - 1;
      yield {
        id: `mock_${index}`,
        delta: words[index] + (isLast ? '' : ' '),
        finishReason: isLast ? 'stop' : null,
      };
      
      index++;
    }
  })();
}
