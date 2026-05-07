/**
 * Provider Adapters - Bridge between AI SDK streams and Allternit ReplyEvent format.
 * Extracted from the private @allternit/provider-adapters package.
 */

import type { ReplyEvent } from '@/types/replies-contract';

export type AiSdkStreamPart = {
  type: 'text-delta' | 'reasoning' | 'tool-call' | 'tool-result' | 'step-finish' | 'finish';
  id?: string;
  text?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  [key: string]: unknown;
};

export interface AiSdkReplyAdapterOptions {
  replyId: string;
  runId?: string;
  onEvent?: (event: ReplyEvent) => void;
}

export class AiSdkReplyAdapter {
  private replyId: string;
  private runId?: string;
  private onEvent?: (event: ReplyEvent) => void;

  constructor(options: AiSdkReplyAdapterOptions) {
    this.replyId = options.replyId;
    this.runId = options.runId;
    this.onEvent = options.onEvent;
  }

  async consume(fullStream: AsyncIterable<AiSdkStreamPart>): Promise<void> {
    for await (const part of fullStream) {
      this.process(part);
    }
  }

  process(part: AiSdkStreamPart): ReplyEvent {
    const event = this.convertPartToEvent(part);
    this.onEvent?.(event);
    return event;
  }

  private convertPartToEvent(part: AiSdkStreamPart): ReplyEvent {
    const baseEvent = {
      replyId: this.replyId,
      timestamp: Date.now(),
      runId: this.runId,
    };

    switch (part.type) {
      case 'text-delta':
        return {
          ...baseEvent,
          type: 'text:delta',
          data: { content: part.text ?? '' },
        };

      case 'reasoning':
        return {
          ...baseEvent,
          type: 'reasoning:delta',
          data: { content: part.text ?? '' },
        };

      case 'tool-call':
        return {
          ...baseEvent,
          type: 'tool_call:start',
          data: {
            toolName: part.toolName ?? 'unknown',
            input: part.input,
          },
        };

      case 'tool-result':
        return {
          ...baseEvent,
          type: 'tool_call:end',
          data: {
            output: typeof part.output === 'string' ? part.output : JSON.stringify(part.output),
          },
        };

      case 'step-finish':
        return {
          ...baseEvent,
          type: 'text:end',
          data: {},
        };

      case 'finish':
        return {
          ...baseEvent,
          type: 'reply:complete',
          data: {},
        };

      default:
        return {
          ...baseEvent,
          type: `unknown:${part.type}`,
          data: part,
        };
    }
  }
}
