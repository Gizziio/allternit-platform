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
export declare class AllternitOllamaError extends Error {
    readonly code: string;
    readonly statusCode?: number;
    readonly cause?: Error;
    constructor({ message, code, statusCode, cause, }: {
        message: string;
        code: string;
        statusCode?: number;
        cause?: Error;
    });
}
export declare class AllternitOllamaConnectionError extends AllternitOllamaError {
    constructor({ message, cause }?: {
        message?: string;
        cause?: Error;
    });
}
export declare class AllternitOllamaModelError extends AllternitOllamaError {
    constructor({ message, model }?: {
        message?: string;
        model?: string;
    });
}
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    images?: string[];
}
export interface ChatOptions {
    temperature?: number;
    num_predict?: number;
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
export interface AllternitOllamaOptions {
    baseURL?: string;
    timeout?: number;
    fetch?: typeof fetch;
}
export declare class AllternitOllama {
    private baseURL;
    private timeout;
    private fetch;
    constructor(opts?: AllternitOllamaOptions);
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
    chat(params: ChatParams): Promise<ChatResponse>;
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
    chatStream(params: ChatParams): AsyncGenerator<ChatStreamChunk>;
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
    generate(params: GenerateParams): Promise<GenerateResponse>;
    /**
     * Stream text generation responses from Ollama (legacy endpoint).
     *
     * @param params - Generate parameters including model and prompt
     * @returns AsyncGenerator yielding generate stream chunks
     * @throws {AllternitOllamaConnectionError} If Ollama server is not running
     * @throws {AllternitOllamaModelError} If the model is not found
     * @throws {AllternitOllamaError} For other API errors
     */
    generateStream(params: GenerateParams): AsyncGenerator<Partial<GenerateResponse>>;
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
    listModels(): Promise<Model[]>;
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
    pullModel(name: string, insecure?: boolean): Promise<void>;
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
    pullModelStream(name: string, insecure?: boolean): AsyncGenerator<PullProgress>;
    private fetchWithTimeout;
    private handleErrorResponse;
    private wrapError;
}
export default AllternitOllama;
//# sourceMappingURL=index.d.ts.map