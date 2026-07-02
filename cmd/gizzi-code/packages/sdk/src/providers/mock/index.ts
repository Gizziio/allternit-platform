/**
 * Allternit Mock Provider
 *
 * Deterministic echo provider for tests and offline demos.
 * Repeats the last user message back so outputs are reproducible
 * and no external API key is required.
 */

export interface AllternitMockOptions {
  /** Artificial response delay in milliseconds. */
  responseDelay?: number;
  /** Whether chatStream should yield tokens or a single response. */
  shouldStream?: boolean;
  /** Optional fixed response text (defaults to echoing the last user message). */
  mockResponse?: string;
}

export interface MockMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface MockChatOptions {
  messages: MockMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface MockChatResponse {
  id: string;
  model: string;
  content: string;
  usage: { input_tokens: number; output_tokens: number };
}

export class AllternitMock {
  private options: AllternitMockOptions;

  constructor(options: AllternitMockOptions = {}) {
    this.options = options;
  }

  private resolveContent(messages: MockMessage[]): string {
    if (this.options.mockResponse) return this.options.mockResponse;
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    return lastUser?.content ?? 'Mock response';
  }

  async chat(options: MockChatOptions): Promise<MockChatResponse> {
    if (this.options.responseDelay) {
      await new Promise((resolve) => setTimeout(resolve, this.options.responseDelay));
    }
    const content = this.resolveContent(options.messages);
    return {
      id: `mock_${Date.now()}`,
      model: 'mock-echo',
      content,
      usage: {
        input_tokens: options.messages.reduce((sum, m) => sum + m.content.length, 0),
        output_tokens: content.length,
      },
    };
  }

  async *chatStream(options: MockChatOptions): AsyncGenerator<MockChatResponse> {
    const content = this.resolveContent(options.messages);
    const chunkSize = 4;
    for (let i = 0; i < content.length; i += chunkSize) {
      if (this.options.responseDelay) {
        await new Promise((resolve) => setTimeout(resolve, this.options.responseDelay));
      }
      yield {
        id: `mock_${Date.now()}`,
        model: 'mock-echo',
        content: content.slice(i, i + chunkSize),
        usage: {
          input_tokens: i === 0
            ? options.messages.reduce((sum, m) => sum + m.content.length, 0)
            : 0,
          output_tokens: Math.min(chunkSize, content.length - i),
        },
      };
    }
  }

  async listModels(): Promise<Array<{ id: string; name: string }>> {
    return [
      { id: 'mock-gpt', name: 'Mock GPT' },
      { id: 'mock-claude', name: 'Mock Claude' },
      { id: 'mock-local', name: 'Mock Local' },
    ];
  }
}
