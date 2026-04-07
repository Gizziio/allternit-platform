/**
 * Allternit Cohere Provider
 * 
 * Cohere API client for Allternit SDK
 * API: https://api.cohere.com/v1
 */

import { HarnessError } from '../../harness/errors.js';
import type { HarnessErrorCode } from '../../harness/errors.js';

export interface AllternitCohereOptions {
  apiKey: string;
  baseURL?: string;
}

export interface CohereMessage {
  role: 'SYSTEM' | 'USER' | 'CHATBOT';
  message: string;
}

export interface CohereTool {
  name: string;
  description: string;
  parameterDefinitions?: Record<string, {
    description?: string;
    type: string;
    required?: boolean;
  }>;
}

export interface CohereChatOptions {
  model: string;
  message: string;
  chatHistory?: CohereMessage[];
  preamble?: string;
  temperature?: number;
  maxTokens?: number;
  k?: number;
  p?: number;
  seed?: number;
  stream?: boolean;
  tools?: CohereTool[];
  forceSingleStep?: boolean;
}

export interface CohereChatResponse {
  response_id: string;
  text: string;
  generation_id: string;
  chat_history: CohereMessage[];
  finish_reason: string;
  meta: {
    api_version: { version: string };
    billed_units: {
      input_tokens: number;
      output_tokens: number;
    };
    tokens: {
      input_tokens: number;
      output_tokens: number;
    };
  };
  tool_calls?: Array<{
    name: string;
    parameters: Record<string, unknown>;
  }>;
}

export interface CohereStreamChunk {
  text?: string;
  tool_calls?: Array<{
    name: string;
    parameters: Record<string, unknown>;
  }>;
  finish_reason?: string;
  is_finished?: boolean;
  response?: {
    response_id?: string;
    text?: string;
    tool_calls?: Array<{
      name: string;
      parameters: Record<string, unknown>;
    }>;
  };
}

export const COHERE_MODELS = {
  COMMAND: 'command',
  COMMAND_LIGHT: 'command-light',
  COMMAND_R: 'command-r',
  COMMAND_R_PLUS: 'command-r-plus',
} as const;

export class AllternitCohere {
  private apiKey: string;
  private baseURL: string;

  constructor(options: AllternitCohereOptions) {
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL || 'https://api.cohere.com/v1';
  }

  async chat(options: CohereChatOptions): Promise<CohereChatResponse> {
    const response = await fetch(`${this.baseURL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        message: options.message,
        chat_history: options.chatHistory,
        preamble: options.preamble,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        k: options.k,
        p: options.p,
        seed: options.seed,
        stream: false,
        tools: options.tools,
        force_single_step: options.forceSingleStep,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new HarnessError(
        error.message || `Cohere API error: ${response.status}`,
        HarnessErrorCode.PROVIDER_ERROR,
        { statusCode: response.status }
      );
    }

    const data = await response.json() as CohereChatResponse;
    return data;
  }

  async *chatStream(options: CohereChatOptions): AsyncGenerator<CohereStreamChunk> {
    const response = await fetch(`${this.baseURL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        model: options.model,
        message: options.message,
        chat_history: options.chatHistory,
        preamble: options.preamble,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        k: options.k,
        p: options.p,
        seed: options.seed,
        stream: true,
        tools: options.tools,
        force_single_step: options.forceSingleStep,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new HarnessError(
        error.message || `Cohere API error: ${response.status}`,
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
          if (line.trim() === '') continue;
          
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6)) as CohereStreamChunk;
              if (event.is_finished) {
                return;
              }
              yield event;
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

  async listModels(): Promise<string[]> {
    // Cohere doesn't have a models endpoint, return known models
    return Object.values(COHERE_MODELS);
  }
}

export default AllternitCohere;
