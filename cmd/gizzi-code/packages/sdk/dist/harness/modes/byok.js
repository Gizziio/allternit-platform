/**
 * BYOK Mode (Bring Your Own Key)
 * Routes requests to appropriate provider using user's API keys
 */
import { AllternitAI, APIError, APIUserAbortError, } from '../../providers/anthropic';
import { AllternitError } from '../../providers/anthropic/core/error';
/**
 * Stream from BYOK mode - routes to appropriate provider based on request.provider
 */
export async function* streamFromBYOK(config, request) {
    const signal = request.signal;
    try {
        switch (request.provider) {
            case 'anthropic':
                yield* streamFromAnthropic(config, request);
                break;
            case 'openai':
                yield* streamFromOpenAI(config, request);
                break;
            case 'google':
                yield* streamFromGoogle(config, request);
                break;
            default:
                throw new AllternitError(`Unsupported provider for BYOK mode: ${request.provider}. Supported: anthropic, openai, google`);
        }
    }
    catch (error) {
        // Handle cancellation
        if (signal?.aborted) {
            yield { type: 'error', error: new APIUserAbortError() };
            return;
        }
        // Re-yield harness errors
        if (error instanceof AllternitError) {
            yield { type: 'error', error };
            return;
        }
        // Wrap unknown errors
        const harnessError = new AllternitError(error instanceof Error ? error.message : 'Unknown error in BYOK mode');
        yield { type: 'error', error: harnessError };
    }
}
/**
 * Stream from Anthropic API using AllternitAI client
 */
async function* streamFromAnthropic(config, request) {
    const apiKey = config.keys.anthropic;
    if (!apiKey) {
        throw new AllternitError('Anthropic API key not configured. Run: gizzi auth add anthropic --key <key>');
    }
    const client = new AllternitAI({
        apiKey,
        baseURL: config.baseURLs?.anthropic,
    });
    // Convert messages to Anthropic format
    const anthropicMessages = convertToAnthropicMessages(request.messages);
    // Create stream
    const stream = await client.messages.create({
        model: request.model,
        max_tokens: request.maxTokens ?? 4096,
        messages: anthropicMessages,
        temperature: request.temperature,
        tools: request.tools?.map(convertToAnthropicTool),
        stream: true,
    }, { signal: request.signal });
    // Process stream events
    yield* processAnthropicStream(stream);
}
/**
 * Stream from OpenAI API
 */
async function* streamFromOpenAI(config, request) {
    const apiKey = config.keys.openai;
    if (!apiKey) {
        throw new AllternitError('OpenAI API key not configured. Run: gizzi auth add openai --key <key>');
    }
    const baseURL = config.baseURLs?.openai ?? 'https://api.openai.com/v1';
    const response = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: request.model,
            messages: request.messages,
            temperature: request.temperature,
            max_tokens: request.maxTokens,
            tools: request.tools?.map(convertToOpenAITool),
            stream: true,
        }),
        signal: request.signal,
    });
    if (!response.ok) {
        const error = await response.text();
        throw new APIError(response.status, { error: JSON.parse(error) }, `OpenAI API error: ${response.statusText}`, response.headers);
    }
    yield* processOpenAIStream(response);
}
/**
 * Stream from Google Gemini API
 */
async function* streamFromGoogle(config, request) {
    const apiKey = config.keys.google;
    if (!apiKey) {
        throw new AllternitError('Google API key not configured. Run: gizzi auth add google --key <key>');
    }
    const baseURL = config.baseURLs?.google ?? 'https://generativelanguage.googleapis.com/v1beta';
    // Convert messages to Gemini format
    const contents = convertToGeminiContents(request.messages);
    const response = await fetch(`${baseURL}/models/${request.model}:streamGenerateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents,
            generationConfig: {
                temperature: request.temperature,
                maxOutputTokens: request.maxTokens,
            },
        }),
        signal: request.signal,
    });
    if (!response.ok) {
        const error = await response.text();
        throw new APIError(response.status, { error: JSON.parse(error) }, `Google API error: ${response.statusText}`, response.headers);
    }
    yield* processGoogleStream(response);
}
// ============================================================================
// Stream Processors
// ============================================================================
/**
 * Process Anthropic SSE stream
 */
async function* processAnthropicStream(stream) {
    let currentToolUse = null;
    for await (const event of stream) {
        switch (event.type) {
            case 'content_block_delta': {
                if (event.delta.type === 'text_delta') {
                    yield { type: 'text', text: event.delta.text };
                }
                else if (event.delta.type === 'input_json_delta') {
                    // Accumulate tool input JSON
                    if (currentToolUse) {
                        currentToolUse.input += event.delta.partial_json;
                    }
                }
                break;
            }
            case 'content_block_start': {
                if (event.content_block.type === 'tool_use') {
                    currentToolUse = {
                        id: event.content_block.id,
                        name: event.content_block.name,
                        input: '',
                    };
                }
                break;
            }
            case 'content_block_stop': {
                if (currentToolUse) {
                    try {
                        const input = JSON.parse(currentToolUse.input || '{}');
                        yield {
                            type: 'tool_call',
                            id: currentToolUse.id,
                            name: currentToolUse.name,
                            arguments: input,
                        };
                    }
                    catch {
                        yield {
                            type: 'tool_call',
                            id: currentToolUse.id,
                            name: currentToolUse.name,
                            arguments: {},
                        };
                    }
                    currentToolUse = null;
                }
                break;
            }
            case 'message_delta': {
                if (event.usage) {
                    yield {
                        type: 'usage',
                        input_tokens: event.usage.input_tokens ?? 0,
                        output_tokens: event.usage.output_tokens ?? 0,
                    };
                }
                break;
            }
            case 'message_stop': {
                yield { type: 'done' };
                break;
            }
        }
    }
}
/**
 * Process OpenAI SSE stream
 */
async function* processOpenAIStream(response) {
    const reader = response.body?.getReader();
    if (!reader) {
        throw new AllternitError('Response body is null');
    }
    const decoder = new TextDecoder();
    let buffer = '';
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        yield { type: 'done' };
                        return;
                    }
                    try {
                        const chunk = JSON.parse(data);
                        const delta = chunk.choices?.[0]?.delta;
                        if (delta?.content) {
                            yield { type: 'text', text: delta.content };
                        }
                        if (delta?.tool_calls) {
                            for (const toolCall of delta.tool_calls) {
                                if (toolCall.function?.name) {
                                    yield {
                                        type: 'tool_call',
                                        id: toolCall.id || `tool_${Date.now()}`,
                                        name: toolCall.function.name,
                                        arguments: JSON.parse(toolCall.function.arguments || '{}'),
                                    };
                                }
                            }
                        }
                        if (chunk.usage) {
                            yield {
                                type: 'usage',
                                input_tokens: chunk.usage.prompt_tokens ?? 0,
                                output_tokens: chunk.usage.completion_tokens ?? 0,
                            };
                        }
                    }
                    catch (e) {
                        // Skip malformed chunks
                    }
                }
            }
        }
        yield { type: 'done' };
    }
    finally {
        reader.releaseLock();
    }
}
/**
 * Process Google Gemini stream
 */
async function* processGoogleStream(response) {
    const reader = response.body?.getReader();
    if (!reader) {
        throw new AllternitError('Response body is null');
    }
    const decoder = new TextDecoder();
    let buffer = '';
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
                    const candidates = chunk.candidates || [];
                    for (const candidate of candidates) {
                        const content = candidate.content;
                        if (!content)
                            continue;
                        for (const part of content.parts || []) {
                            if (part.text) {
                                yield { type: 'text', text: part.text };
                            }
                            if (part.functionCall) {
                                yield {
                                    type: 'tool_call',
                                    id: part.functionCall.name,
                                    name: part.functionCall.name,
                                    arguments: part.functionCall.args || {},
                                };
                            }
                        }
                    }
                    if (chunk.usageMetadata) {
                        yield {
                            type: 'usage',
                            input_tokens: chunk.usageMetadata.promptTokenCount ?? 0,
                            output_tokens: chunk.usageMetadata.candidatesTokenCount ?? 0,
                        };
                    }
                }
                catch (e) {
                    // Skip malformed chunks
                }
            }
        }
        yield { type: 'done' };
    }
    finally {
        reader.releaseLock();
    }
}
// ============================================================================
// Message/Tool Converters
// ============================================================================
/**
 * Convert harness messages to Anthropic format
 */
function convertToAnthropicMessages(messages) {
    const result = [];
    for (const msg of messages) {
        // Skip system messages - they are handled separately by Anthropic
        if (msg.role === 'system')
            continue;
        const role = msg.role === 'user' ? 'user' : 'assistant';
        if (typeof msg.content === 'string') {
            result.push({ role, content: msg.content });
        }
        else {
            const blocks = [];
            for (const block of msg.content) {
                if (block.type === 'text') {
                    blocks.push({ type: 'text', text: block.text });
                }
                else if (block.type === 'image') {
                    blocks.push({
                        type: 'image',
                        source: {
                            type: block.source.type,
                            media_type: block.source.media_type,
                            data: block.source.data,
                        },
                    });
                }
                // Skip tool_use and tool_result blocks for now
            }
            // Cast to MessageParam content type
            result.push({ role, content: blocks });
        }
    }
    return result;
}
/**
 * Convert harness tool to Anthropic format
 */
function convertToAnthropicTool(tool) {
    return {
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema,
    };
}
/**
 * Convert harness tool to OpenAI format
 */
function convertToOpenAITool(tool) {
    return {
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema,
        },
    };
}
/**
 * Convert harness messages to Gemini format
 */
function convertToGeminiContents(messages) {
    return messages.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: typeof msg.content === 'string'
            ? [{ text: msg.content }]
            : msg.content
                .filter((b) => b.type === 'text')
                .map((b) => ({ text: b.text })),
    }));
}
//# sourceMappingURL=byok.js.map