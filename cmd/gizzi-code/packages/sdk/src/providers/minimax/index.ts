/**
 * Allternit MiniMax Provider
 * 
 * MiniMax AI API client for Allternit SDK
 * API: https://api.minimax.chat/v1
 * Docs: https://platform.minimaxi.com/document/ChatCompletion
 */

import { HarnessError } from '../../harness/errors.js';
import type { HarnessErrorCode } from '../../harness/errors.js';

export interface AllternitMiniMaxOptions {
  apiKey: string;
  groupId?: string;
  baseURL?: string;
}

export interface MiniMaxMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
}

export interface MiniMaxFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MiniMaxChatOptions {
  model: string;
  messages: MiniMaxMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  functions?: MiniMaxFunction[];
  functionCall?: 'auto' | 'none' | { name: string };
}

export interface MiniMaxChatResponse {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: MiniMaxMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  base_resp?: {
    status_code: number;
    status_msg: string;
  };
}

export interface MiniMaxStreamChunk {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: Partial<MiniMaxMessage>;
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export const MINIMAX_MODELS = {
  ABA5_5: 'abab5.5-chat',
  ABA5_5S: 'abab5.5s-chat',
  ABA6: 'abab6-chat',
  ABA6_5: 'abab6.5-chat',
  ABA6_5S: 'abab6.5s-chat',
} as const;

export class AllternitMiniMax {
  private apiKey: string;
  private groupId: string | undefined;
  private baseURL: string;

  constructor(options: AllternitMiniMaxOptions) {
    this.apiKey = options.apiKey;
    this.groupId = options.groupId || process.env.MINIMAX_GROUP_ID;
    this.baseURL = options.baseURL || 'https://api.minimax.chat/v1';
  }

  async chat(options: MiniMaxChatOptions): Promise<MiniMaxChatResponse> {
    const url = this.groupId 
      ? `${this.baseURL}/text/chatcompletion_v2?GroupId=${this.groupId}`
      : `${this.baseURL}/text/chatcompletion_v2`;

    const response = await fetch(url, {
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
        stream: false,
        functions: options.functions,
        function_call: options.functionCall,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ base_resp: { status_msg: 'Unknown error' } }));
      throw new HarnessError(
        error.base_resp?.status_msg || `MiniMax API error: ${response.status}`,
        HarnessErrorCode.PROVIDER_ERROR,
        { statusCode: response.status }
      );
    }

    const data = await response.json() as MiniMaxChatResponse;
    
    if (data.base_resp && data.base_resp.status_code !== 0) {
      throw new HarnessError(
        data.base_resp.status_msg,
        HarnessErrorCode.PROVIDER_ERROR,
        { statusCode: data.base_resp.status_code }
      );
    }

    return data;
  }

  async *chatStream(options: MiniMaxChatOptions): AsyncGenerator<MiniMaxStreamChunk> {
    const url = this.groupId 
      ? `${this.baseURL}/text/chatcompletion_v2?GroupId=${this.groupId}`
      : `${this.baseURL}/text/chatcompletion_v2`;

    const response = await fetch(url, {
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
        stream: true,
        functions: options.functions,
        function_call: options.functionCall,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ base_resp: { status_msg: 'Unknown error' } }));
      throw new HarnessError(
        error.base_resp?.status_msg || `MiniMax API error: ${response.status}`,
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
              const chunk = JSON.parse(line.slice(6)) as MiniMaxStreamChunk;
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

  async listModels(): Promise<Array<{ id: string; name: string }>> {
    return [
      { id: MINIMAX_MODELS.ABA5_5, name: 'ABAB 5.5' },
      { id: MINIMAX_MODELS.ABA5_5S, name: 'ABAB 5.5s' },
      { id: MINIMAX_MODELS.ABA6, name: 'ABAB 6' },
      { id: MINIMAX_MODELS.ABA6_5, name: 'ABAB 6.5' },
      { id: MINIMAX_MODELS.ABA6_5S, name: 'ABAB 6.5s' },
    ];
  }
}

export default AllternitMiniMax;
