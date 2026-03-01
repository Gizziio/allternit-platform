/**
 * Anthropic Claude Provider Implementation
 * GAP-78: LLM Integration
 * 
 * WIH: GAP-78, Owner: T3-A1
 * 
 * Real implementation using Anthropic API
 */

import type {
  LlmClient,
  LlmConfig,
  LlmRequest,
  LlmResponse,
  LlmStreamChunk,
} from '../types.js';

/**
 * Anthropic API response types
 */
interface AnthropicMessage {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<
    | { type: 'text'; text: string }
    | {
        type: 'tool_use';
        id: string;
        name: string;
        input: Record<string, unknown>;
      }
  >;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicStreamEvent {
  type: string;
  index?: number;
  delta?: {
    type?: string;
    text?: string;
    partial_json?: string;
  };
  content_block?: {
    type: string;
    text?: string;
    id?: string;
    name?: string;
  };
  message?: Partial<AnthropicMessage>;
  usage?: {
    output_tokens: number;
  };
}

/**
 * Anthropic Claude provider
 */
export class AnthropicProvider implements LlmClient {
  readonly provider = 'anthropic';
  readonly config: LlmConfig;
  private baseUrl = 'https://api.anthropic.com/v1';
  
  constructor(config: LlmConfig) {
    this.config = config;
  }

  /**
   * Send completion request to Anthropic API
   */
  async complete(request: LlmRequest): Promise<LlmResponse> {
    const apiKey = this.config.apiKey || process.env['ANTHROPIC_API_KEY'];
    
    if (!apiKey) {
      throw new Error(
        'Anthropic API key required. Set ANTHROPIC_API_KEY environment variable ' +
        'or pass apiKey in config.'
      );
    }

    // Separate system message from other messages
    let systemPrompt: string | undefined;
    const messages = request.messages.filter(m => {
      if (m.role === 'system') {
        systemPrompt = m.content;
        return false;
      }
      return true;
    });

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
        system: systemPrompt,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        tools: request.tools?.map(tool => ({
          name: tool.function.name,
          description: tool.function.description,
          input_schema: tool.function.parameters,
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${error}`);
    }

    const data: AnthropicMessage = await response.json();
    const textContent = data.content.find(c => c.type === 'text');
    const toolContent = data.content.filter(c => c.type === 'tool_use');

    return {
      id: data.id,
      content: textContent?.type === 'text' ? textContent.text : '',
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      model: data.model,
      finishReason: this.mapStopReason(data.stop_reason),
      toolCalls: toolContent.map(tc => ({
        id: tc.id || '',
        type: 'function',
        function: {
          name: tc.name || '',
          arguments: JSON.stringify(tc.input || {}),
        },
      })),
    };
  }

  /**
   * Stream completion responses from Anthropic API
   */
  async *stream(request: LlmRequest): AsyncGenerator<LlmStreamChunk> {
    const apiKey = this.config.apiKey || process.env['ANTHROPIC_API_KEY'];
    
    if (!apiKey) {
      throw new Error('Anthropic API key required');
    }

    // Separate system message from other messages
    let systemPrompt: string | undefined;
    const messages = request.messages.filter(m => {
      if (m.role === 'system') {
        systemPrompt = m.content;
        return false;
      }
      return true;
    });

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
        system: systemPrompt,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let messageId = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const chunk = this.parseStreamLine(line, messageId);
          if (chunk) {
            if (!messageId) messageId = chunk.id;
            yield chunk;
          }
        }
      }

      // Process remaining buffer
      if (buffer) {
        const chunk = this.parseStreamLine(buffer, messageId);
        if (chunk) {
          yield chunk;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Parse a single SSE line from Anthropic stream
   */
  private parseStreamLine(line: string, currentId: string): LlmStreamChunk | null {
    line = line.trim();
    
    if (!line.startsWith('event:') && !line.startsWith('data:')) {
      return null;
    }

    // Handle event type lines
    if (line.startsWith('event:')) {
      return null;
    }

    // Handle data lines
    if (!line.startsWith('data:')) {
      return null;
    }

    const data = line.slice(5).trim();

    try {
      const event: AnthropicStreamEvent = JSON.parse(data);
      
      switch (event.type) {
        case 'message_start':
          if (event.message) {
            return {
              id: event.message.id || currentId,
              delta: '',
              finishReason: null,
            };
          }
          break;
          
        case 'content_block_delta':
          if (event.delta?.text) {
            return {
              id: currentId,
              delta: event.delta.text,
              finishReason: null,
            };
          }
          break;
          
        case 'message_delta':
          if (event.delta?.stop_reason) {
            return {
              id: currentId,
              delta: '',
              finishReason: this.mapStopReason(event.delta.stop_reason as string),
            };
          }
          break;
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Map Anthropic stop reason to standard format
   */
  private mapStopReason(reason: string | null): 'stop' | 'length' | 'tool_calls' | null {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'tool_use':
        return 'tool_calls';
      default:
        return null;
    }
  }

  /**
   * Health check - verify API connectivity
   */
  async health(): Promise<boolean> {
    const apiKey = this.config.apiKey || process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) return false;

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    const apiKey = this.config.apiKey || process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) return [];

    const response = await fetch(`${this.baseUrl}/models`, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.data
      .filter((m: any) => m.id.startsWith('claude-'))
      .map((m: any) => m.id);
  }
}
