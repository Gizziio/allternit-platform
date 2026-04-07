/**
 * Cloud Mode
 * Routes requests through Allternit's managed API gateway
 */
import { APIError, APIConnectionError, APIUserAbortError, } from '../../providers/anthropic';
import { AllternitError } from '../../providers/anthropic/core/error';
/**
 * Stream from Allternit Cloud API
 * POST to https://api.allternit.com/v1/ai/stream
 */
export async function* streamFromCloud(config, request) {
    const signal = request.signal;
    const baseURL = config.baseURL || 'https://api.allternit.com';
    try {
        // Check for cancellation before starting
        if (signal?.aborted) {
            yield { type: 'error', error: new APIUserAbortError() };
            return;
        }
        const response = await fetch(`${baseURL}/v1/ai/stream`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream',
                'X-Allternit-Provider': request.provider,
            },
            body: JSON.stringify({
                provider: request.provider,
                model: request.model,
                messages: request.messages,
                temperature: request.temperature,
                max_tokens: request.maxTokens,
                tools: request.tools,
            }),
            signal,
        });
        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            }
            catch {
                // Not JSON, use text as message
            }
            throw new APIError(response.status, errorData || { message: errorText }, `Cloud API error: ${response.statusText}`, response.headers);
        }
        // Process SSE stream
        yield* processCloudStream(response);
    }
    catch (error) {
        // Handle cancellation
        if (signal?.aborted) {
            yield { type: 'error', error: new APIUserAbortError() };
            return;
        }
        // Handle specific error types
        if (error instanceof TypeError && error.message.includes('fetch')) {
            yield {
                type: 'error',
                error: new APIConnectionError({
                    message: 'Failed to connect to Allternit Cloud API',
                    cause: error,
                }),
            };
            return;
        }
        // Re-yield harness errors
        if (error instanceof AllternitError) {
            yield { type: 'error', error };
            return;
        }
        // Wrap unknown errors
        const harnessError = new AllternitError(error instanceof Error ? error.message : 'Unknown error in Cloud mode');
        yield { type: 'error', error: harnessError };
    }
}
/**
 * Process SSE stream from Allternit Cloud API
 */
async function* processCloudStream(response) {
    const reader = response.body?.getReader();
    if (!reader) {
        throw new AllternitError('Response body is null');
    }
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = null;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                // Empty line indicates end of event
                if (!line.trim()) {
                    if (currentEvent?.data) {
                        yield* parseCloudEvent(currentEvent);
                    }
                    currentEvent = null;
                    continue;
                }
                // Parse SSE field
                if (line.startsWith('event: ')) {
                    currentEvent = {
                        event: line.slice(7).trim(),
                        data: currentEvent?.data || '',
                    };
                }
                else if (line.startsWith('data: ')) {
                    if (!currentEvent) {
                        currentEvent = { event: null, data: '' };
                    }
                    currentEvent.data = line.slice(6).trim();
                }
                else if (line.startsWith(':')) {
                    // Comment line, ignore
                }
            }
        }
        // Process any remaining event
        if (currentEvent?.data) {
            yield* parseCloudEvent(currentEvent);
        }
        // Ensure we always yield done
        yield { type: 'done' };
    }
    finally {
        reader.releaseLock();
    }
}
/**
 * Parse a single SSE event from Cloud API
 */
async function* parseCloudEvent(sse) {
    // Handle ping events
    if (sse.event === 'ping') {
        return;
    }
    // Handle error events
    if (sse.event === 'error') {
        try {
            const error = JSON.parse(sse.data);
            yield {
                type: 'error',
                error: new APIError(error.status || 500, error, error.message || 'Cloud API error', undefined),
            };
        }
        catch {
            yield {
                type: 'error',
                error: new AllternitError(sse.data || 'Unknown cloud error'),
            };
        }
        return;
    }
    // Parse data payload
    try {
        const chunk = JSON.parse(sse.data);
        switch (chunk.type) {
            case 'text':
                if (chunk.text) {
                    yield { type: 'text', text: chunk.text };
                }
                break;
            case 'tool_call':
                yield {
                    type: 'tool_call',
                    id: chunk.id || `tool_${Date.now()}`,
                    name: chunk.name,
                    arguments: chunk.arguments || {},
                };
                break;
            case 'tool_result':
                yield {
                    type: 'tool_result',
                    tool_use_id: chunk.tool_use_id,
                    content: chunk.content,
                };
                break;
            case 'thinking':
                if (chunk.thinking) {
                    yield { type: 'thinking', thinking: chunk.thinking };
                }
                break;
            case 'usage':
                yield {
                    type: 'usage',
                    input_tokens: chunk.input_tokens ?? 0,
                    output_tokens: chunk.output_tokens ?? 0,
                };
                break;
            case 'done':
                yield { type: 'done' };
                break;
            default:
                // Unknown chunk type, ignore
                break;
        }
    }
    catch (e) {
        // Skip malformed chunks
        console.warn('Failed to parse cloud stream chunk:', sse.data);
    }
}
/**
 * Non-streaming completion via Cloud API
 */
export async function completeViaCloud(config, request) {
    const baseURL = config.baseURL || 'https://api.allternit.com';
    const response = await fetch(`${baseURL}/v1/ai/complete`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
            'X-Allternit-Provider': request.provider,
        },
        body: JSON.stringify({
            provider: request.provider,
            model: request.model,
            messages: request.messages,
            temperature: request.temperature,
            max_tokens: request.maxTokens,
            tools: request.tools,
        }),
        signal: request.signal,
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
        throw new APIError(response.status, errorData || { message: errorText }, `Cloud API error: ${response.statusText}`, response.headers);
    }
    return response.json();
}
/**
 * List available models from Cloud API
 */
export async function listCloudModels(config, provider) {
    const baseURL = config.baseURL || 'https://api.allternit.com';
    const url = new URL(`${baseURL}/v1/ai/models`);
    if (provider) {
        url.searchParams.set('provider', provider);
    }
    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${config.accessToken}`,
        },
    });
    if (!response.ok) {
        const error = await response.text();
        throw new APIError(response.status, { error }, `Failed to list models: ${response.statusText}`, response.headers);
    }
    const data = await response.json();
    return data.models || [];
}
//# sourceMappingURL=cloud.js.map