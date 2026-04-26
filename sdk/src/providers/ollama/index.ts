/**
 * AllternitOllama Provider
 * Local Ollama model integration for the Allternit harness
 */

import { Message, Tool } from '../../harness/types';

export interface OllamaConfig {
  baseURL: string;
  defaultModel?: string;
}

export interface OllamaModel {
  name: string;
  size: number;
  digest?: string;
  modified?: string;
}

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  stream?: boolean;
  options?: Record<string, unknown>;
}

export interface OllamaChatRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  stream?: boolean;
  tools?: Tool[];
  options?: Record<string, unknown>;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response?: string;
  message?: {
    role: string;
    content: string;
  };
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

/**
 * AllternitOllama provides a client for local Ollama instances
 */
export class AllternitOllama {
  private config: OllamaConfig;

  constructor(config: OllamaConfig) {
    this.config = {
      baseURL: config.baseURL.replace(/\/$/, ''), // Remove trailing slash
      defaultModel: config.defaultModel || 'llama2',
    };
  }

  /**
   * List available models from the Ollama server
   */
  async listModels(): Promise<OllamaModel[]> {
    const response = await fetch(`${this.config.baseURL}/api/tags`);
    
    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return (data.models || []).map((model: any) => ({
      name: model.name,
      size: model.size,
      digest: model.digest,
      modified: model.modified_at,
    }));
  }

  /**
   * Pull a model from Ollama
   */
  async pullModel(model: string): Promise<void> {
    const response = await fetch(`${this.config.baseURL}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: false }),
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Generate completion using Ollama
   */
  async *generate(request: OllamaGenerateRequest): AsyncGenerator<string> {
    const response = await fetch(`${this.config.baseURL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        prompt: request.prompt,
        system: request.system,
        stream: true,
        options: request.options,
      }),
    });

    if (!response.ok) {
      throw new Error(`Generation failed: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data: OllamaResponse = JSON.parse(line);
          if (data.response) {
            yield data.response;
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
  }

  /**
   * Chat completion using Ollama
   */
  async *chat(request: OllamaChatRequest): AsyncGenerator<string> {
    const response = await fetch(`${this.config.baseURL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: true,
        tools: request.tools,
        options: request.options,
      }),
    });

    if (!response.ok) {
      throw new Error(`Chat failed: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data: OllamaResponse = JSON.parse(line);
          if (data.message?.content) {
            yield data.message.content;
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
  }

  /**
   * Check if Ollama server is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseURL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Re-export types
export * from '../../harness/types';
