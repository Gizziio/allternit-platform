/**
 * Allternit Together AI Provider
 * 
 * Together AI API client for Allternit SDK
 * API: https://api.together.xyz/v1 (OpenAI-compatible)
 */

import { HarnessError } from '../../harness/errors.js';
import type { HarnessErrorCode } from '../../harness/errors.js';

export interface AllternitTogetherOptions {
  apiKey: string;
  baseURL?: string;
}

export interface TogetherMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
}

export interface TogetherTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface TogetherChatOptions {
  model: string;
  messages: TogetherMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  stream?: boolean;
  tools?: TogetherTool[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  stop?: string | string[];
  repetitionPenalty?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  minP?: number;
}

export interface TogetherChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: TogetherMessage;
    finish_reason: string;
    logprobs?: unknown;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface TogetherStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: Partial<TogetherMessage>;
    finish_reason: string | null;
    logprobs?: unknown;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export const TOGETHER_MODELS = {
  LLAMA2_70B: 'togethercomputer/llama-2-70b-chat',
  LLAMA2_13B: 'togethercomputer/llama-2-13b-chat',
  LLAMA2_7B: 'togethercomputer/llama-2-7b-chat',
  MISTRAL_7B: 'mistralai/Mistral-7B-Instruct-v0.1',
  MIXTRAL_8X7B: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
  QWEN_72B: 'Qwen/Qwen1.5-72B-Chat',
  DBRX: 'databricks/dbrx-instruct',
} as const;

export class AllternitTogether {
  private apiKey: string;
  private baseURL: string;

  constructor(options: AllternitTogetherOptions) {
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL || 'https://api.together.xyz/v1';
  }

  async chat(options: TogetherChatOptions): Promise<TogetherChatResponse> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        top_k: options.topK,
        stream: false,
        tools: options.tools,
        tool_choice: options.toolChoice,
        stop: options.stop,
        repetition_penalty: options.repetitionPenalty,
        presence_penalty: options.presencePenalty,
        frequency_penalty: options.frequencyPenalty,
        min_p: options.minP,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new HarnessError(
        error.error?.message || `Together AI error: ${response.status}`,
        HarnessErrorCode.PROVIDER_ERROR,
        { statusCode: response.status }
      );
    }

    const data = await response.json() as TogetherChatResponse;
    return data;
  }

  async *chatStream(options: TogetherChatOptions): AsyncGenerator<TogetherStreamChunk> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        top_k: options.topK,
        stream: true,
        tools: options.tools,
        tool_choice: options.toolChoice,
        stop: options.stop,
        repetition_penalty: options.repetitionPenalty,
        presence_penalty: options.presencePenalty,
        frequency_penalty: options.frequencyPenalty,
        min_p: options.minP,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new HarnessError(
        error.error?.message || `Together AI error: ${response.status}`,
        HarnessErrorCode.PROVIDER_ERROR,
        { statusCode: response.status }
      );
    }

    const reader = response.body!.getReader();
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
          if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
          
          if (line.startsWith('data: ')) {
            try {
              const chunk = JSON.parse(line.slice(6)) as TogetherStreamChunk;
              yield chunk;
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async listModels(): Promise<Array<{ id: string; object: string; created: number; owned_by: string }>> {
    const response = await fetch(`${this.baseURL}/models`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new HarnessError(
        `Failed to list Together AI models: ${response.status}`,
        HarnessErrorCode.PROVIDER_ERROR,
        { statusCode: response.status }
      );
    }

    const data = await response.json() as { data: Array<{ id: string; object: string; created: number; owned_by: string }> };
    return data.data;
  }
}

export default AllternitTogether;
