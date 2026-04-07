/**
 * Allternit Groq Provider
 * 
 * Groq API client for Allternit SDK
 * API: https://api.groq.com/openai/v1 (OpenAI-compatible)
 */

import { HarnessError } from '../../harness/errors.js';

export interface AllternitGroqOptions {
  apiKey: string;
  baseURL?: string;
}

export interface GroqMessage {
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
}

export interface GroqCompletionOptions {
  model: string;
  messages: GroqMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description?: string;
      parameters: Record<string, any>;
    };
  }>;
}

export class AllternitGroq {
  private apiKey: string;
  private baseURL: string;

  constructor(options: AllternitGroqOptions) {
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL || 'https://api.groq.com/openai/v1';
  }

  async complete(options: GroqCompletionOptions): Promise<any> {
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
        `Groq API error: ${response.status} ${response.statusText}`,
        'PROVIDER_NOT_FOUND'
      );
    }

    return response.json();
  }

  async *stream(options: GroqCompletionOptions): AsyncGenerator<any> {
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
        `Groq API error: ${response.status} ${response.statusText}`,
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

export default AllternitGroq;
