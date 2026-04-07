/**
 * Local Mode (Ollama)
 * Routes requests to local Ollama server
 */
import { APIError, APIConnectionError, APIUserAbortError, } from '../../providers/anthropic';
import { AllternitError } from '../../providers/anthropic/core/error';
/**
 * Default Ollama base URL
 */
const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
/**
 * Stream from local Ollama server
 */
export async function* streamFromLocal(config, request) {
    const signal = request.signal;
    const baseURL = config.baseURL || DEFAULT_OLLAMA_URL;
    try {
        // Check for cancellation before starting
        if (signal?.aborted) {
            yield { type: 'error', error: new APIUserAbortError() };
            return;
        }
        // Convert messages to Ollama format
        const ollamaMessages = convertToOllamaMessages(request.messages);
        // Build request body
        const requestBody = {
            model: request.model,
            messages: ollamaMessages,
            stream: true,
            options: {
                temperature: request.temperature,
                num_predict: request.maxTokens,
            },
        };
        // Add tools if provided (Ollama supports tools in newer versions)
        if (request.tools && request.tools.length > 0) {
            requestBody.tools = convertToOllamaTools(request.tools);
        }
        const response = await fetch(`${baseURL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
            },
            body: JSON.stringify(requestBody),
            signal,
        });
        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            }
            catch {
                // Not JSON
            }
            throw new APIError(response.status, errorData || { error: errorText }, `Ollama error: ${response.statusText}`, response.headers);
        }
        // Process NDJSON stream
        yield* processOllamaStream(response);
    }
    catch (error) {
        // Handle cancellation
        if (signal?.aborted) {
            yield { type: 'error', error: new APIUserAbortError() };
            return;
        }
        // Handle connection errors
        if (error instanceof TypeError) {
            if (error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) {
                yield {
                    type: 'error',
                    error: new APIConnectionError({
                        message: `Failed to connect to Ollama at ${baseURL}. Is Ollama running?`,
                        cause: error,
                    }),
                };
                return;
            }
        }
        // Re-yield harness errors
        if (error instanceof AllternitError) {
            yield { type: 'error', error };
            return;
        }
        // Wrap unknown errors
        const harnessError = new AllternitError(error instanceof Error ? error.message : 'Unknown error in Local mode');
        yield { type: 'error', error: harnessError };
    }
}
/**
 * Process Ollama NDJSON stream
 */
async function* processOllamaStream(response) {
    const reader = response.body?.getReader();
    if (!reader) {
        throw new AllternitError('Response body is null');
    }
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedToolCalls = new Map();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (!line.trim())
                    continue;
                try {
                    const chunk = JSON.parse(line);
                    // Handle error in stream
                    if (chunk.error) {
                        yield {
                            type: 'error',
                            error: new AllternitError(chunk.error),
                        };
                        continue;
                    }
                    // Handle content
                    if (chunk.message?.content) {
                        yield { type: 'text', text: chunk.message.content };
                    }
                    // Handle tool calls
                    if (chunk.message?.tool_calls) {
                        for (const toolCall of chunk.message.tool_calls) {
                            const existing = accumulatedToolCalls.get(toolCall.function.name);
                            if (existing) {
                                // Accumulate arguments if streaming tool calls
                                Object.assign(existing.function.arguments, toolCall.function.arguments);
                            }
                            else {
                                accumulatedToolCalls.set(toolCall.function.name, toolCall);
                                yield {
                                    type: 'tool_call',
                                    id: toolCall.id || `tool_${Date.now()}_${toolCall.function.name}`,
                                    name: toolCall.function.name,
                                    arguments: toolCall.function.arguments || {},
                                };
                            }
                        }
                    }
                    // Stream is done
                    if (chunk.done) {
                        // Yield usage info if available
                        if (chunk.prompt_eval_count !== undefined || chunk.eval_count !== undefined) {
                            yield {
                                type: 'usage',
                                input_tokens: chunk.prompt_eval_count ?? 0,
                                output_tokens: chunk.eval_count ?? 0,
                            };
                        }
                        yield { type: 'done' };
                        return;
                    }
                }
                catch (e) {
                    // Skip malformed chunks
                    console.warn('Failed to parse Ollama stream chunk:', line);
                }
            }
        }
        // Stream ended without explicit done
        yield { type: 'done' };
    }
    finally {
        reader.releaseLock();
    }
}
/**
 * Non-streaming completion via Ollama
 */
export async function completeViaLocal(config, request) {
    const baseURL = config.baseURL || DEFAULT_OLLAMA_URL;
    const ollamaMessages = convertToOllamaMessages(request.messages);
    const requestBody = {
        model: request.model,
        messages: ollamaMessages,
        stream: false,
        options: {
            temperature: request.temperature,
            num_predict: request.maxTokens,
        },
    };
    if (request.tools && request.tools.length > 0) {
        requestBody.tools = convertToOllamaTools(request.tools);
    }
    const response = await fetch(`${baseURL}/api/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
        },
        body: JSON.stringify(requestBody),
        signal: request.signal,
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new APIError(response.status, { error: errorText }, `Ollama error: ${response.statusText}`, response.headers);
    }
    const result = await response.json();
    return {
        content: result.message?.content || '',
        tool_calls: result.message?.tool_calls?.map((tc) => ({
            id: tc.id || `tool_${Date.now()}_${tc.function.name}`,
            name: tc.function.name,
            arguments: tc.function.arguments || {},
        })),
        usage: {
            input_tokens: result.prompt_eval_count ?? 0,
            output_tokens: result.eval_count ?? 0,
        },
    };
}
/**
 * List available local models from Ollama
 */
export async function listLocalModels(config) {
    const baseURL = config.baseURL || DEFAULT_OLLAMA_URL;
    try {
        const response = await fetch(`${baseURL}/api/tags`, {
            method: 'GET',
            headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {},
        });
        if (!response.ok) {
            const error = await response.text();
            throw new APIError(response.status, { error }, `Failed to list Ollama models: ${response.statusText}`, response.headers);
        }
        const data = await response.json();
        return data.models || [];
    }
    catch (error) {
        if (error instanceof APIError)
            throw error;
        throw new APIConnectionError({
            message: `Failed to connect to Ollama at ${baseURL}`,
            cause: error instanceof Error ? error : undefined,
        });
    }
}
/**
 * Pull a model from Ollama
 */
export async function pullLocalModel(config, modelName) {
    const baseURL = config.baseURL || DEFAULT_OLLAMA_URL;
    const response = await fetch(`${baseURL}/api/pull`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
        },
        body: JSON.stringify({ name: modelName }),
    });
    if (!response.ok) {
        const error = await response.text();
        throw new APIError(response.status, { error }, `Failed to pull model: ${response.statusText}`, response.headers);
    }
    // Consume the stream (pull progress)
    const reader = response.body?.getReader();
    if (reader) {
        while (true) {
            const { done } = await reader.read();
            if (done)
                break;
        }
        reader.releaseLock();
    }
}
// ============================================================================
// Converters
// ============================================================================
/**
 * Convert harness messages to Ollama format
 */
function convertToOllamaMessages(messages) {
    return messages.map((msg) => {
        const role = msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user';
        if (typeof msg.content === 'string') {
            return {
                role,
                content: msg.content,
            };
        }
        // Handle complex content blocks
        const textParts = [];
        const images = [];
        for (const block of msg.content) {
            if (block.type === 'text') {
                textParts.push(block.text);
            }
            else if (block.type === 'image' && block.source.type === 'base64') {
                images.push(block.source.data);
            }
        }
        return {
            role,
            content: textParts.join('\n'),
            images: images.length > 0 ? images : undefined,
        };
    });
}
/**
 * Convert harness tools to Ollama format
 */
function convertToOllamaTools(tools) {
    return tools.map((tool) => ({
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description,
            parameters: {
                type: 'object',
                properties: tool.input_schema.properties,
                required: tool.input_schema.required,
            },
        },
    }));
}
//# sourceMappingURL=local.js.map