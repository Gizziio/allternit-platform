/**
 * Stub LLM Provider for Testing
 * GAP-78: LLM Integration
 * 
 * WIH: GAP-78, Owner: T3-A1
 * 
 * Always available provider for testing and development.
 * Returns predictable responses without external dependencies.
 */

import type {
  LlmClient,
  LlmConfig,
  LlmRequest,
  LlmResponse,
  LlmStreamChunk,
} from '../types.js';

/**
 * Stub provider for testing
 */
export class StubProvider implements LlmClient {
  readonly provider = 'stub';
  readonly config: LlmConfig;
  
  constructor(config: LlmConfig) {
    this.config = config;
  }

  /**
   * Generate stub response based on request
   */
  async complete(request: LlmRequest): Promise<LlmResponse> {
    const lastMessage = request.messages.at(-1)?.content ?? '';
    const stubResponse = this.generateStubResponse(lastMessage);
    
    return {
      id: `stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      content: stubResponse,
      usage: { 
        promptTokens: this.estimateTokens(lastMessage), 
        completionTokens: this.estimateTokens(stubResponse),
        totalTokens: this.estimateTokens(lastMessage) + this.estimateTokens(stubResponse),
      },
      model: this.config.model,
      finishReason: 'stop',
    };
  }

  /**
   * Generate streaming stub response
   */
  async *stream(request: LlmRequest): AsyncGenerator<LlmStreamChunk> {
    const lastMessage = request.messages.at(-1)?.content ?? '';
    const stubResponse = this.generateStubResponse(lastMessage);
    const words = stubResponse.split(' ');
    const id = `stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    for (let i = 0; i < words.length; i++) {
      yield {
        id,
        delta: words[i] + (i < words.length - 1 ? ' ' : ''),
        finishReason: i === words.length - 1 ? 'stop' : null,
      };
      
      // Simulate slight delay between tokens
      if (i < words.length - 1) {
        await new Promise(r => setTimeout(r, 10));
      }
    }
  }

  /**
   * Always healthy
   */
  async health(): Promise<boolean> {
    return true;
  }

  /**
   * Generate context-aware stub response
   */
  private generateStubResponse(message: string): string {
    const lower = message.toLowerCase();
    
    if (lower.includes('summarize') || lower.includes('summary')) {
      return '[STUB] This appears to be a request for summarization. In production, this would be a concise summary of the provided content.';
    }
    
    if (lower.includes('insight') || lower.includes('analyze')) {
      return '[STUB] Key insights from this content:\n1. Main theme: [would be identified]\n2. Important concept: [would be extracted]\n3. Potential gap: [would be noted]';
    }
    
    if (lower.includes('entity') || lower.includes('extract')) {
      return '[STUB] Entities detected:\n- Person: [names would be here]\n- Organization: [orgs would be here]\n- Concept: [concepts would be here]';
    }
    
    if (lower.includes('hello') || lower.includes('hi')) {
      return 'Hello! I\'m the stub LLM provider for Ars Contexta. Set ENABLE_OPENAI=true or ENABLE_ANTHROPIC=true to use real LLMs.';
    }
    
    return `[STUB] Received message: "${message.slice(0, 50)}${message.length > 50 ? '...' : ''}". This is a stub response for testing.`;
  }

  /**
   * Rough token estimation (4 chars ~= 1 token)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
