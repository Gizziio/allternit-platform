/**
 * Local LLM Provider (Ollama, llama.cpp, vLLM)
 * GAP-78: LLM Integration
 * 
 * WIH: GAP-78, Owner: T3-A1
 * 
 * Real implementation using Ollama API
 */

import type {
  LlmClient,
  LlmConfig,
  LlmRequest,
  LlmResponse,
  LlmStreamChunk,
} from '../types.js';

/**
 * Ollama API response types
 */
interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
    tool_calls?: Array<{
      function: {
        name: string;
        arguments: string;
      };
    }>;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaStreamChunk {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaModel {
  name: string;
  model: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

/**
 * Local LLM provider (Ollama-compatible)
 */
export class LocalProvider implements LlmClient {
  readonly provider = 'local';
  readonly config: LlmConfig;
  private baseUrl: string;
  
  constructor(config: LlmConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434';
  }

  /**
   * Send completion request via Ollama API
   */
  async complete(request: LlmRequest): Promise<LlmResponse> {
    const model = this.config.model;

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        stream: false,
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${error}`);
    }

    const data: OllamaChatResponse = await response.json();

    return {
      id: `ollama_${Date.now()}`,
      content: data.message.content,
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
      model: data.model,
      finishReason: 'stop',
      toolCalls: data.message.tool_calls?.map((tc, i) => ({
        id: `call_${i}`,
        type: 'function',
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })),
    };
  }

  /**
   * Stream completion responses
   */
  async *stream(request: LlmRequest): AsyncGenerator<LlmStreamChunk> {
    const model = this.config.model;

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        stream: true,
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    const id = `ollama_stream_${Date.now()}`;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const chunk: OllamaStreamChunk = JSON.parse(line);
            
            if (chunk.done) {
              yield {
                id,
                delta: '',
                finishReason: 'stop',
              };
              return;
            }

            yield {
              id,
              delta: chunk.message.content,
              finishReason: null,
            };
          } catch {
            // Skip invalid JSON lines
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const chunk: OllamaStreamChunk = JSON.parse(buffer);
          yield {
            id,
            delta: chunk.message.content,
            finishReason: chunk.done ? 'stop' : null,
          };
        } catch {
          // Ignore parse errors
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Health check - verify Ollama is running
   */
  async health(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List available local models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];
      
      const data = await response.json();
      return (data.models || []).map((m: OllamaModel) => m.name);
    } catch {
      return [];
    }
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(model: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: model,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to pull model: ${error}`);
    }
  }

  /**
   * Generate embeddings using Ollama
   */
  async generateEmbeddings(input: string | string[]): Promise<number[][]> {
    const texts = Array.isArray(input) ? input : [input];
    const model = this.config.model;
    const embeddings: number[][] = [];

    for (const text of texts) {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Embedding error: ${error}`);
      }

      const data = await response.json();
      embeddings.push(data.embedding);
    }

    return embeddings;
  }
}
