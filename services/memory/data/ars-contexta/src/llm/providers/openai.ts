/**
 * OpenAI Provider Implementation
 * GAP-78: LLM Integration
 * 
 * WIH: GAP-78, Owner: T3-A1
 * 
 * Real implementation using OpenAI API
 */

import type {
  LlmClient,
  LlmConfig,
  LlmRequest,
  LlmResponse,
  LlmStreamChunk,
} from '../types.js';

/**
 * OpenAI API response types
 */
interface OpenAIChatCompletion {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | null;
  }>;
}

/**
 * OpenAI-compatible provider
 */
export class OpenAiProvider implements LlmClient {
  readonly provider = 'openai';
  readonly config: LlmConfig;
  private baseUrl = 'https://api.openai.com/v1';
  
  constructor(config: LlmConfig) {
    this.config = config;
  }

  /**
   * Send completion request to OpenAI API
   */
  async complete(request: LlmRequest): Promise<LlmResponse> {
    const apiKey = this.config.apiKey || process.env['OPENAI_API_KEY'];
    
    if (!apiKey) {
      throw new Error(
        'OpenAI API key required. Set OPENAI_API_KEY environment variable ' +
        'or pass apiKey in config.'
      );
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: request.messages,
        max_tokens: request.maxTokens,
        temperature: request.temperature ?? 0.7,
        stream: false,
        tools: request.tools?.map(tool => ({
          type: 'function',
          function: {
            name: tool.function.name,
            description: tool.function.description,
            parameters: tool.function.parameters,
          },
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data: OpenAIChatCompletion = await response.json();
    const choice = data.choices[0];

    return {
      id: data.id,
      content: choice.message.content,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      model: data.model,
      finishReason: choice.finish_reason,
      toolCalls: choice.message.tool_calls?.map(tc => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })),
    };
  }

  /**
   * Stream completion responses from OpenAI API
   */
  async *stream(request: LlmRequest): AsyncGenerator<LlmStreamChunk> {
    const apiKey = this.config.apiKey || process.env['OPENAI_API_KEY'];
    
    if (!apiKey) {
      throw new Error('OpenAI API key required');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: request.messages,
        max_tokens: request.maxTokens,
        temperature: request.temperature ?? 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

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
        buffer = lines.pop() || '';

        for (const line of lines) {
          const chunk = this.parseStreamLine(line);
          if (chunk) {
            yield chunk;
          }
        }
      }

      // Process remaining buffer
      if (buffer) {
        const chunk = this.parseStreamLine(buffer);
        if (chunk) {
          yield chunk;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Parse a single SSE line from OpenAI stream
   */
  private parseStreamLine(line: string): LlmStreamChunk | null {
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
      const parsed: OpenAIStreamChunk = JSON.parse(data);
      const choice = parsed.choices[0];
      
      return {
        id: parsed.id,
        delta: choice.delta.content || '',
        finishReason: choice.finish_reason,
      };
    } catch {
      return null;
    }
  }

  /**
   * Health check - verify API connectivity
   */
  async health(): Promise<boolean> {
    const apiKey = this.config.apiKey || process.env['OPENAI_API_KEY'];
    if (!apiKey) return false;

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
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
    const apiKey = this.config.apiKey || process.env['OPENAI_API_KEY'];
    if (!apiKey) return [];

    const response = await fetch(`${this.baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.data
      .filter((m: any) => m.id.startsWith('gpt-'))
      .map((m: any) => m.id);
  }
}
