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
    code;
    statusCode;
    cause;
    constructor({ message, code, statusCode, cause, }) {
        super(message);
        this.name = 'AllternitOllamaError';
        this.code = code;
        this.statusCode = statusCode;
        this.cause = cause;
    }
}
export class AllternitOllamaConnectionError extends AllternitOllamaError {
    constructor({ message, cause } = {}) {
        super({
            message: message || 'Failed to connect to Ollama server. Is it running?',
            code: 'CONNECTION_ERROR',
            cause,
        });
        this.name = 'AllternitOllamaConnectionError';
    }
}
export class AllternitOllamaModelError extends AllternitOllamaError {
    constructor({ message, model } = {}) {
        super({
            message: message || `Model${model ? ` '${model}'` : ''} not found`,
            code: 'MODEL_NOT_FOUND',
            statusCode: 404,
        });
        this.name = 'AllternitOllamaModelError';
    }
}
export class AllternitOllama {
    baseURL;
    timeout;
    fetch;
    constructor(opts = {}) {
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
    async chat(params) {
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
            const data = await response.json();
            return data;
        }
        catch (error) {
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
    async *chatStream(params) {
        const url = `${this.baseURL}/api/chat`;
        const body = {
            model: params.model,
            messages: params.messages,
            stream: true,
            options: params.options,
            keep_alive: params.keep_alive,
        };
        let response;
        try {
            response = await this.fetchWithTimeout(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });
        }
        catch (error) {
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
                if (done)
                    break;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim());
                for (const line of lines) {
                    try {
                        const parsed = JSON.parse(line);
                        yield parsed;
                        if (parsed.done) {
                            return;
                        }
                    }
                    catch {
                        // Skip malformed JSON lines
                        continue;
                    }
                }
            }
        }
        finally {
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
    async generate(params) {
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
            const data = await response.json();
            return data;
        }
        catch (error) {
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
    async *generateStream(params) {
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
        let response;
        try {
            response = await this.fetchWithTimeout(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });
        }
        catch (error) {
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
                if (done)
                    break;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim());
                for (const line of lines) {
                    try {
                        const parsed = JSON.parse(line);
                        yield parsed;
                        if (parsed.done) {
                            return;
                        }
                    }
                    catch {
                        // Skip malformed JSON lines
                        continue;
                    }
                }
            }
        }
        finally {
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
    async listModels() {
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
            const data = await response.json();
            return data.models || [];
        }
        catch (error) {
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
    async pullModel(name, insecure) {
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
        }
        catch (error) {
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
    async *pullModelStream(name, insecure) {
        const url = `${this.baseURL}/api/pull`;
        const body = {
            name,
            insecure,
            stream: true,
        };
        let response;
        try {
            response = await this.fetchWithTimeout(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            }, 0); // No timeout for pull operations
        }
        catch (error) {
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
                if (done)
                    break;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim());
                for (const line of lines) {
                    try {
                        const parsed = JSON.parse(line);
                        yield parsed;
                    }
                    catch {
                        // Skip malformed JSON lines
                        continue;
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
    }
    // ============================================================================
    // Private Helpers
    // ============================================================================
    async fetchWithTimeout(url, init, timeoutMs = this.timeout) {
        const controller = new AbortController();
        const timeoutId = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
        try {
            const response = await this.fetch(url, {
                ...init,
                signal: controller.signal,
            });
            return response;
        }
        catch (error) {
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
        }
        finally {
            if (timeoutId)
                clearTimeout(timeoutId);
        }
    }
    async handleErrorResponse(response, modelName) {
        let errorBody = '';
        try {
            errorBody = await response.json();
        }
        catch {
            errorBody = await response.text();
        }
        const message = typeof errorBody === 'object'
            ? errorBody.error || JSON.stringify(errorBody)
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
    wrapError(error, modelName) {
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
//# sourceMappingURL=index.js.map