/**
 * Azure OpenAI Provider for Allternit SDK
 * https://azure.microsoft.com/en-us/services/cognitive-services/openai-service/
 */

import { Message, Tool, HarnessError, HarnessErrorCode, HarnessResponse } from '../../harness/types';

export interface AzureOpenAIConfig {
  apiKey: string;
  resourceName: string;
  deploymentName: string;
  apiVersion?: string;
  baseURL?: string; // Alternative to resourceName for full URL
}

export interface AzureOpenAIRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool' | 'function';
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
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
  stop?: string[];
}

export interface AzureOpenAIResponse {
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
  system_fingerprint?: string;
}

export interface AzureOpenAIStreamChunk {
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
  system_fingerprint?: string;
}

/**
 * Common Azure OpenAI API versions
 */
export const AZURE_API_VERSIONS = {
  V2024_02: '2024-02-01',
  V2024_06: '2024-06-01',
  V2024_08: '2024-08-01-preview',
  V2024_10: '2024-10-01-preview',
  V2025_01: '2025-01-01-preview',
} as const;

/**
 * AllternitAzureOpenAI provides a client for Azure OpenAI Service
 */
export class AllternitAzureOpenAI {
  private config: {
    apiKey: string;
    baseURL: string;
    apiVersion: string;
    deploymentName: string;
  };

  constructor(config: AzureOpenAIConfig) {
    const apiVersion = config.apiVersion || AZURE_API_VERSIONS.V2024_06;
    
    let baseURL: string;
    if (config.baseURL) {
      baseURL = config.baseURL.replace(/\/$/, '');
    } else if (config.resourceName) {
      baseURL = `https://${config.resourceName}.openai.azure.com/openai/deployments/${config.deploymentName}`;
    } else {
      throw new HarnessError(
        HarnessErrorCode.CONFIG_INVALID,
        'Either resourceName or baseURL must be provided'
      );
    }

    this.config = {
      apiKey: config.apiKey,
      baseURL,
      apiVersion,
      deploymentName: config.deploymentName,
    };
  }

  /**
   * Build the full API URL with query parameters
   */
  private buildURL(endpoint: string): string {
    const separator = this.config.baseURL.includes('?') ? '&' : '?';
    return `${this.config.baseURL}/${endpoint}${separator}api-version=${this.config.apiVersion}`;
  }

  /**
   * Transform internal messages to Azure OpenAI format
   */
  private transformMessages(messages: Message[]): AzureOpenAIRequest['messages'] {
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
   * Transform tools to Azure OpenAI format
   */
  private transformTools(tools?: Tool[]): AzureOpenAIRequest['tools'] {
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
          'Invalid Azure OpenAI API key',
          error
        );
      }
      if (response.status === 429) {
        throw new HarnessError(
          HarnessErrorCode.RATE_LIMITED,
          'Azure OpenAI rate limit exceeded',
          error
        );
      }
      if (response.status === 404) {
        throw new HarnessError(
          HarnessErrorCode.PROVIDER_NOT_FOUND,
          'Azure OpenAI deployment not found',
          error
        );
      }
      if (response.status >= 500) {
        throw new HarnessError(
          HarnessErrorCode.API_ERROR,
          `Azure OpenAI API error: ${response.status} ${response.statusText}`,
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
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
      tools?: Tool[];
      stop?: string[];
    }
  ): Promise<HarnessResponse> {
    try {
      const request: AzureOpenAIRequest = {
        messages: this.transformMessages(messages),
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        frequency_penalty: options?.frequencyPenalty,
        presence_penalty: options?.presencePenalty,
        stop: options?.stop,
        tools: this.transformTools(options?.tools) as unknown as AzureOpenAIRequest['tools'],
        stream: false,
      };

      const response = await fetch(this.buildURL('chat/completions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.apiKey,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        this.handleError(new Error(`HTTP ${response.status}`), response);
      }

      const data: AzureOpenAIResponse = await response.json();
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
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
      tools?: Tool[];
      stop?: string[];
    }
  ): AsyncGenerator<{ content?: string; toolCalls?: Array<{ id: string; name: string; arguments: string }> }> {
    try {
      const request: AzureOpenAIRequest = {
        messages: this.transformMessages(messages),
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        frequency_penalty: options?.frequencyPenalty,
        presence_penalty: options?.presencePenalty,
        stop: options?.stop,
        tools: this.transformTools(options?.tools),
        stream: true,
      };

      const response = await fetch(this.buildURL('chat/completions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.apiKey,
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
              const data: AzureOpenAIStreamChunk = JSON.parse(trimmed.slice(6));
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
   * Get rate limit information from headers
   */
  async getRateLimits(): Promise<{
    requestsRemaining?: number;
    requestsLimit?: number;
    tokensRemaining?: number;
    tokensLimit?: number;
    resetTime?: Date;
  }> {
    try {
      // Make a minimal request to get rate limit headers
      const response = await fetch(this.buildURL('models'), {
        method: 'GET',
        headers: {
          'api-key': this.config.apiKey,
        },
      });

      const headers = response.headers;
      const resetSeconds = headers.get('x-ratelimit-reset-requests');

      return {
        requestsRemaining: parseInt(headers.get('x-ratelimit-remaining-requests') || '0') || undefined,
        requestsLimit: parseInt(headers.get('x-ratelimit-limit-requests') || '0') || undefined,
        tokensRemaining: parseInt(headers.get('x-ratelimit-remaining-tokens') || '0') || undefined,
        tokensLimit: parseInt(headers.get('x-ratelimit-limit-tokens') || '0') || undefined,
        resetTime: resetSeconds ? new Date(parseInt(resetSeconds) * 1000) : undefined,
      };
    } catch (error) {
      // Silently return empty object on error
      return {};
    }
  }
}

export default AllternitAzureOpenAI;
