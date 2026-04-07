/**
 * Allternit Mistral Provider
 * 
 * Mistral AI API client for Allternit SDK
 * API: https://api.mistral.ai/v1
 */

import { HarnessError } from '../../harness/errors.js';

export interface AllternitMistralOptions {
  apiKey: string;
  baseURL?: string;
}

export interface MistralMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface MistralCompletionOptions {
  model: string;
  messages: MistralMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
}

export class AllternitMistral {
  private apiKey: string;
  private baseURL: string;

  constructor(options: AllternitMistralOptions) {
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL || 'https://api.mistral.ai/v1';
  }

  async complete(options: MistralCompletionOptions): Promise<any> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      throw new HarnessError(
        `Mistral API error: ${response.status} ${response.statusText}`,
        'PROVIDER_NOT_FOUND'
      );
    }

    return response.json();
  }

  async *stream(options: MistralCompletionOptions): AsyncGenerator<any> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...options, stream: true }),
    });

    if (!response.ok) {
      throw new HarnessError(
        `Mistral API error: ${response.status} ${response.statusText}`,
        'PROVIDER_NOT_FOUND'
      );
    }

    const reader = response.body?.getReader();
    if (!reader) throw new HarnessError('No response body', 'STREAM_ERROR');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          try {
            yield JSON.parse(data);
          } catch {}
        }
      }
    }
  }
}

export default AllternitMistral;
