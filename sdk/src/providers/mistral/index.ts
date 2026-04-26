/**
 * Mistral AI Provider for Allternit SDK
 * https://docs.mistral.ai/
 */

import { Message, Tool, HarnessError, HarnessErrorCode, HarnessResponse } from '../../harness/types';

export interface MistralConfig {
  apiKey: string;
  baseURL?: string;
  defaultModel?: string;
}

export interface MistralRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }>;
    tool_call_id?: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
}

export interface MistralResponse {
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
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface MistralStreamChunk {
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
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Supported Mistral models
 */
export const MISTRAL_MODELS = {
  TINY: 'mistral-tiny',
  SMALL: 'mistral-small',
  MEDIUM: 'mistral-medium',
  LARGE: 'mistral-large-latest',
  EMBED: 'mistral-embed',
} as const;

export type MistralModel = typeof MISTRAL_MODELS[keyof typeof MISTRAL_MODELS];

/**
 * AllternitMistral provides a client for Mistral AI API
 */
export class AllternitMistral {
  private config: Required<MistralConfig>;

  constructor(config: MistralConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseURL: (config.baseURL || 'https://api.mistral.ai/v1').replace(/\/$/, ''),
      defaultModel: config.defaultModel || MISTRAL_MODELS.LARGE,
    };
  }

  /**
   * Transform internal messages to Mistral format
   */
  private transformMessages(messages: Message[]): MistralRequest['messages'] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      ...(msg.name && { name: msg.name }),
      ...(msg.tool_calls && {
        tool_calls: msg.tool_calls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      }),
      ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
    }));
  }

  /**
   * Transform tools to Mistral format
   */
  private transformTools(tools?: Tool[]): MistralRequest['tools'] {
    if (!tools?.length) return undefined;
    return tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as unknown as Record<string, unknown>,
      },
    }));
  }

  /**
   * Handle API errors
   */
  private handleError(error: unknown, response?: Response): never {
    if (error instanceof HarnessError) throw error;
    
    if (response) {
      if (response.status === 401) {
        throw new HarnessError(
          HarnessErrorCode.AUTHENTICATION_ERROR,
          'Invalid Mistral API key',
          error
        );
      }
      if (response.status === 429) {
        throw new HarnessError(
          HarnessErrorCode.RATE_LIMITED,
          'Mistral rate limit exceeded',
          error
        );
      }
      if (response.status >= 500) {
        throw new HarnessError(
          HarnessErrorCode.API_ERROR,
          `Mistral API error: ${response.status} ${response.statusText}`,
          error
        );
      }
    }
    
    throw new HarnessError(
      HarnessErrorCode.UNKNOWN_ERROR,
      error instanceof Error ? error.message : 'Unknown error',
      error
    );
  }

  /**
   * Non-streaming chat completion
   */
  async chat(
    messages: Message[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      tools?: Tool[];
    }
  ): Promise<HarnessResponse> {
    try {
      const request: MistralRequest = {
        model: options?.model || this.config.defaultModel,
        messages: this.transformMessages(messages),
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        tools: this.transformTools(options?.tools) as unknown as MistralRequest['tools'],
        stream: false,
      };

      const response = await fetch(`${this.config.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        this.handleError(new Error(`HTTP ${response.status}`), response);
      }

      const data: MistralResponse = await response.json();
      const choice = data.choices[0];

      return {
        content: choice.message.content || '',
        toolCalls: choice.message.tool_calls?.map(tc => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        })),
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      if (error instanceof HarnessError) throw error;
      this.handleError(error);
    }
  }

  /**
   * Streaming chat completion
   */
  async *chatStream(
    messages: Message[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      tools?: Tool[];
    }
  ): AsyncGenerator<{ content?: string; toolCalls?: Array<{ id: string; name: string; arguments: string }> }> {
    try {
      const request: MistralRequest = {
        model: options?.model || this.config.defaultModel,
        messages: this.transformMessages(messages),
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        tools: this.transformTools(options?.tools),
        stream: true,
      };

      const response = await fetch(`${this.config.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        this.handleError(new Error(`HTTP ${response.status}`), response);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new HarnessError(HarnessErrorCode.STREAM_ERROR, 'No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          
          if (trimmed.startsWith('data: ')) {
            try {
              const data: MistralStreamChunk = JSON.parse(trimmed.slice(6));
              const delta = data.choices[0]?.delta;
              
              if (delta?.content) {
                yield { content: delta.content };
              }
              
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  if (tc.function?.name || tc.function?.arguments) {
                    yield {
                      toolCalls: [{
                        id: tc.id || '',
                        name: tc.function.name || '',
                        arguments: tc.function.arguments || '',
                      }],
                    };
                  }
                }
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof HarnessError) throw error;
      this.handleError(error);
    }
  }

  /**
   * List available models from Mistral
   */
  async listModels(): Promise<Array<{ id: string; name: string }>> {
    try {
      const response = await fetch(`${this.config.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });

      if (!response.ok) {
        this.handleError(new Error(`HTTP ${response.status}`), response);
      }

      const data = await response.json();
      return (data.data || []).map((model: any) => ({
        id: model.id,
        name: model.name || model.id,
      }));
    } catch (error) {
      if (error instanceof HarnessError) throw error;
      this.handleError(error);
    }
  }
}

export default AllternitMistral;
