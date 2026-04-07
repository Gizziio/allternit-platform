/**
 * Allternit Ollama Provider
 * 
 * Native Ollama integration for local LLM inference.
 * Ollama runs at http://localhost:11434 by default.
 * 
 * @example
 * ```typescript
 * import { AllternitOllama } from '@allternit/sdk/providers/ollama';
 * 
 * const ollama = new AllternitOllama();
 * 
 * // Chat completion
 * const response = await ollama.chat({
 *   model: 'llama3.2',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 * 
 * // Streaming
 * for await (const chunk of ollama.chatStream({
 *   model: 'llama3.2',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * })) {
 *   process.stdout.write(chunk.message?.content || '');
 * }
 * ```
 */

// ============================================================================
// Error Handling
// ============================================================================

export class AllternitOllamaError extends Error {
  readonly code: string;
  readonly statusCode?: number;
  readonly cause?: Error;

  constructor({
    message,
    code,
    statusCode,
    cause,
  }: {
    message: string;
    code: string;
    statusCode?: number;
    cause?: Error;
  }) {
    super(message);
    this.name = 'AllternitOllamaError';
    this.code = code;
    this.statusCode = statusCode;
    this.cause = cause;
  }
}

export class AllternitOllamaConnectionError extends AllternitOllamaError {
  constructor({ message, cause }: { message?: string; cause?: Error } = {}) {
    super({
      message: message || 'Failed to connect to Ollama server. Is it running?',
      code: 'CONNECTION_ERROR',
      cause,
    });
    this.name = 'AllternitOllamaConnectionError';
  }
}

export class AllternitOllamaModelError extends AllternitOllamaError {
  constructor({ message, model }: { message?: string; model?: string } = {}) {
    super({
      message: message || `Model${model ? ` '${model}'` : ''} not found`,
      code: 'MODEL_NOT_FOUND',
      statusCode: 404,
    });
    this.name = 'AllternitOllamaModelError';
  }
}

// ============================================================================
// Types
// ============================================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  images?: string[]; // base64 encoded images for multimodal models
}

export interface ChatOptions {
  temperature?: number;
  num_predict?: number; // max tokens
  top_p?: number;
  top_k?: number;
  seed?: number;
  stop?: string[];
  frequency_penalty?: number;
  presence_penalty?: number;
  mirostat?: number;
  mirostat_eta?: number;
  mirostat_tau?: number;
}

export interface ChatResponse {
  message: ChatMessage;
  done: boolean;
  model: string;
  created_at: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface ChatStreamChunk {
  message?: ChatMessage;
  done: boolean;
  model?: string;
  created_at?: string;
}

export interface GenerateOptions extends ChatOptions {
  system?: string;
  template?: string;
  context?: number[];
  raw?: boolean;
  format?: 'json';
  keep_alive?: string | number;
}

export interface GenerateResponse {
  response: string;
  done: boolean;
  model: string;
  created_at: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
  context?: number[];
}

export interface Model {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface ListModelsResponse {
  models: Model[];
}

export interface PullProgress {
  status: string;
  completed?: number;
  total?: number;
}

export interface ChatParams {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  options?: ChatOptions;
  keep_alive?: string | number;
}

export interface GenerateParams {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: GenerateOptions;
  system?: string;
  template?: string;
  context?: number[];
  raw?: boolean;
  format?: 'json';
  keep_alive?: string | number;
}

// ============================================================================
// AllternitOllama Client
// ============================================================================

export interface AllternitOllamaOptions {
  baseURL?: string;
  timeout?: number;
  fetch?: typeof fetch;
}

export class AllternitOllama {
  private baseURL: string;
  private timeout: number;
  private fetch: typeof fetch;

  constructor(opts: AllternitOllamaOptions = {}) {
    this.baseURL = opts.baseURL || 'http://localhost:11434';
    this.timeout = opts.timeout || 300000; // 5 minutes default for LLM requests
    this.fetch = opts.fetch || globalThis.fetch;
  }

  // ============================================================================
  // Chat Completion
  // ============================================================================

  /**
   * Send a chat completion request to Ollama.
   * 
   * @param params - Chat parameters including model, messages, and options
   * @returns Promise resolving to the chat response
   * @throws {AllternitOllamaConnectionError} If Ollama server is not running
   * @throws {AllternitOllamaModelError} If the model is not found
   * @throws {AllternitOllamaError} For other API errors
   * 
   * @example
   * ```typescript
   * const response = await ollama.chat({
   *   model: 'llama3.2',
   *   messages: [
   *     { role: 'system', content: 'You are a helpful assistant.' },
   *     { role: 'user', content: 'What is the capital of France?' }
   *   ],
   *   options: { temperature: 0.7 }
   * });
   * console.log(response.message.content);
   * ```
   */
  async chat(params: ChatParams): Promise<ChatResponse> {
    const url = `${this.baseURL}/api/chat`;
    
    const body = {
      model: params.model,
      messages: params.messages,
      stream: false,
      options: params.options,
      keep_alive: params.keep_alive,
    };

    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        await this.handleErrorResponse(response, params.model);
      }

      const data = await response.json() as ChatResponse;
      return data;
    } catch (error) {
      throw this.wrapError(error, params.model);
    }
  }

  // ============================================================================
  // Streaming Chat
  // ============================================================================

  /**
   * Stream chat completion responses from Ollama.
   * 
   * @param params - Chat parameters including model, messages, and options
   * @returns AsyncGenerator yielding chat stream chunks
   * @throws {AllternitOllamaConnectionError} If Ollama server is not running
   * @throws {AllternitOllamaModelError} If the model is not found
   * @throws {AllternitOllamaError} For other API errors
   * 
   * @example
   * ```typescript
   * for await (const chunk of ollama.chatStream({
   *   model: 'llama3.2',
   *   messages: [{ role: 'user', content: 'Tell me a story' }],
   * })) {
   *   process.stdout.write(chunk.message?.content || '');
   * }
   * ```
   */
  async *chatStream(params: ChatParams): AsyncGenerator<ChatStreamChunk> {
    const url = `${this.baseURL}/api/chat`;
    
    const body = {
      model: params.model,
      messages: params.messages,
      stream: true,
      options: params.options,
      keep_alive: params.keep_alive,
    };

    let response: Response;
    try {
      response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw this.wrapError(error, params.model);
    }

    if (!response.ok) {
      await this.handleErrorResponse(response, params.model);
    }

    if (!response.body) {
      throw new AllternitOllamaError({
        message: 'Response body is null',
        code: 'STREAM_ERROR',
      });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as ChatStreamChunk;
            yield parsed;

            if (parsed.done) {
              return;
            }
          } catch {
            // Skip malformed JSON lines
            continue;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ============================================================================
  // Generate Text (Legacy)
  // ============================================================================

  /**
   * Generate text using the legacy /api/generate endpoint.
   * 
   * @param params - Generate parameters including model and prompt
   * @returns Promise resolving to the generate response
   * @throws {AllternitOllamaConnectionError} If Ollama server is not running
   * @throws {AllternitOllamaModelError} If the model is not found
   * @throws {AllternitOllamaError} For other API errors
   * 
   * @example
   * ```typescript
   * const response = await ollama.generate({
   *   model: 'llama3.2',
   *   prompt: 'Why is the sky blue?',
   *   system: 'You are a scientist.'
   * });
   * console.log(response.response);
   * ```
   */
  async generate(params: GenerateParams): Promise<GenerateResponse> {
    const url = `${this.baseURL}/api/generate`;
    
    const body = {
      model: params.model,
      prompt: params.prompt,
      stream: false,
      system: params.system,
      template: params.template,
      context: params.context,
      raw: params.raw,
      format: params.format,
      options: params.options,
      keep_alive: params.keep_alive,
    };

    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        await this.handleErrorResponse(response, params.model);
      }

      const data = await response.json() as GenerateResponse;
      return data;
    } catch (error) {
      throw this.wrapError(error, params.model);
    }
  }

  /**
   * Stream text generation responses from Ollama (legacy endpoint).
   * 
   * @param params - Generate parameters including model and prompt
   * @returns AsyncGenerator yielding generate stream chunks
   * @throws {AllternitOllamaConnectionError} If Ollama server is not running
   * @throws {AllternitOllamaModelError} If the model is not found
   * @throws {AllternitOllamaError} For other API errors
   */
  async *generateStream(params: GenerateParams): AsyncGenerator<Partial<GenerateResponse>> {
    const url = `${this.baseURL}/api/generate`;
    
    const body = {
      model: params.model,
      prompt: params.prompt,
      stream: true,
      system: params.system,
      template: params.template,
      context: params.context,
      raw: params.raw,
      format: params.format,
      options: params.options,
      keep_alive: params.keep_alive,
    };

    let response: Response;
    try {
      response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw this.wrapError(error, params.model);
    }

    if (!response.ok) {
      await this.handleErrorResponse(response, params.model);
    }

    if (!response.body) {
      throw new AllternitOllamaError({
        message: 'Response body is null',
        code: 'STREAM_ERROR',
      });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as Partial<GenerateResponse>;
            yield parsed;

            if (parsed.done) {
              return;
            }
          } catch {
            // Skip malformed JSON lines
            continue;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ============================================================================
  // List Models
  // ============================================================================

  /**
   * List all available models in the local Ollama instance.
   * 
   * @returns Promise resolving to an array of models
   * @throws {AllternitOllamaConnectionError} If Ollama server is not running
   * @throws {AllternitOllamaError} For other API errors
   * 
   * @example
   * ```typescript
   * const models = await ollama.listModels();
   * console.log(models.map(m => m.name));
   * ```
   */
  async listModels(): Promise<Model[]> {
    const url = `${this.baseURL}/api/tags`;

    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = await response.json() as ListModelsResponse;
      return data.models || [];
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  // ============================================================================
  // Pull Model
  // ============================================================================

  /**
   * Pull a model from the Ollama library.
   * 
   * @param name - Name of the model to pull (e.g., 'llama3.2', 'codellama')
   * @param insecure - Allow insecure connections
   * @returns Promise that resolves when the model is pulled
   * @throws {AllternitOllamaConnectionError} If Ollama server is not running
   * @throws {AllternitOllamaError} For other API errors
   * 
   * @example
   * ```typescript
   * await ollama.pullModel('llama3.2');
   * console.log('Model pulled successfully');
   * ```
   */
  async pullModel(name: string, insecure?: boolean): Promise<void> {
    const url = `${this.baseURL}/api/pull`;

    const body = {
      name,
      insecure,
      stream: false,
    };

    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }, 0); // No timeout for pull operations

      if (!response.ok) {
        await this.handleErrorResponse(response, name);
      }

      // Consume the response to ensure the pull completes
      await response.text();
    } catch (error) {
      throw this.wrapError(error, name);
    }
  }

  /**
   * Pull a model with progress streaming.
   * 
   * @param name - Name of the model to pull
   * @param insecure - Allow insecure connections
   * @returns AsyncGenerator yielding pull progress updates
   * @throws {AllternitOllamaConnectionError} If Ollama server is not running
   * @throws {AllternitOllamaError} For other API errors
   * 
   * @example
   * ```typescript
   * for await (const progress of ollama.pullModelStream('llama3.2')) {
   *   if (progress.total) {
   *     const percent = Math.round((progress.completed || 0) / progress.total * 100);
   *     console.log(`${progress.status}: ${percent}%`);
   *   } else {
   *     console.log(progress.status);
   *   }
   * }
   * ```
   */
  async *pullModelStream(name: string, insecure?: boolean): AsyncGenerator<PullProgress> {
    const url = `${this.baseURL}/api/pull`;

    const body = {
      name,
      insecure,
      stream: true,
    };

    let response: Response;
    try {
      response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }, 0); // No timeout for pull operations
    } catch (error) {
      throw this.wrapError(error, name);
    }

    if (!response.ok) {
      await this.handleErrorResponse(response, name);
    }

    if (!response.body) {
      throw new AllternitOllamaError({
        message: 'Response body is null',
        code: 'STREAM_ERROR',
      });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as PullProgress;
            yield parsed;
          } catch {
            // Skip malformed JSON lines
            continue;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number = this.timeout,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const response = await this.fetch(url, {
        ...init,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new AllternitOllamaError({
            message: `Request timed out after ${timeoutMs}ms`,
            code: 'TIMEOUT_ERROR',
          });
        }
        if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
          throw new AllternitOllamaConnectionError({ cause: error });
        }
      }
      throw error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  private async handleErrorResponse(response: Response, modelName?: string): Promise<never> {
    let errorBody: string | Record<string, unknown> = '';
    try {
      errorBody = await response.json() as Record<string, unknown>;
    } catch {
      errorBody = await response.text();
    }

    const message = typeof errorBody === 'object' 
      ? (errorBody.error as string) || JSON.stringify(errorBody)
      : errorBody;

    // Check for model not found errors
    if (response.status === 404 || 
        (typeof message === 'string' && 
         (message.includes('model') || message.includes('not found')))) {
      throw new AllternitOllamaModelError({ 
        model: modelName,
        message: typeof message === 'string' ? message : undefined,
      });
    }

    throw new AllternitOllamaError({
      message: `Ollama API error: ${message}`,
      code: 'API_ERROR',
      statusCode: response.status,
    });
  }

  private wrapError(error: unknown, modelName?: string): Error {
    if (error instanceof AllternitOllamaError) {
      return error;
    }

    if (error instanceof Error) {
      if (error.message.includes('fetch failed') || 
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('connect')) {
        return new AllternitOllamaConnectionError({ cause: error });
      }
      
      if (error.message.includes('model') || error.message.includes('not found')) {
        return new AllternitOllamaModelError({ model: modelName });
      }

      return new AllternitOllamaError({
        message: error.message,
        code: 'UNKNOWN_ERROR',
        cause: error,
      });
    }

    return new AllternitOllamaError({
      message: String(error),
      code: 'UNKNOWN_ERROR',
    });
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default AllternitOllama;
