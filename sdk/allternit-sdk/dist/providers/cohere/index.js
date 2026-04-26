/**
 * Cohere Provider
 * Cohere AI API integration
 */
import { HarnessError, HarnessErrorCode } from '../../harness/types.js';
export class AllternitCohere {
    config;
    baseURL;
    constructor(config) {
        this.config = config;
        this.baseURL = config.baseURL || 'https://api.cohere.com/v2';
    }
    async *stream(request) {
        const url = `${this.baseURL}/chat`;
        // Map messages to Cohere format
        const messages = request.messages.map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
        }));
        // Separate system message if present
        const systemMessage = request.messages.find(m => m.role === 'system');
        const chatMessages = messages.filter(m => m.role !== 'system');
        const body = {
            model: request.model,
            messages: chatMessages,
            stream: true,
        };
        if (systemMessage) {
            body.preamble = systemMessage.content;
        }
        if (request.maxTokens) {
            body.max_tokens = request.maxTokens;
        }
        if (request.temperature !== undefined) {
            body.temperature = request.temperature;
        }
        if (request.topP !== undefined) {
            body.p = request.topP;
        }
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Accept': 'text/event-stream',
            },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new HarnessError(HarnessErrorCode.API_ERROR, `Cohere error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        const reader = response.body?.getReader();
        if (!reader) {
            throw new HarnessError(HarnessErrorCode.STREAM_ERROR, 'No response body');
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
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data: '))
                        continue;
                    const data = trimmed.slice(6);
                    try {
                        const event = JSON.parse(data);
                        if (event.type === 'content-delta' && event.delta?.message?.content?.text) {
                            yield {
                                type: 'text',
                                text: event.delta.message.content.text
                            };
                        }
                        if (event.type === 'message-end') {
                            yield {
                                type: 'done',
                                usage: event.delta?.usage ? {
                                    promptTokens: event.delta.usage.tokens.input,
                                    completionTokens: event.delta.usage.tokens.output,
                                    totalTokens: event.delta.usage.tokens.input + event.delta.usage.tokens.output,
                                } : undefined,
                            };
                            return;
                        }
                    }
                    catch {
                        // Ignore parse errors
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
        yield { type: 'done' };
    }
    async complete(request) {
        const chunks = [];
        for await (const chunk of this.stream(request)) {
            if (chunk.type === 'text') {
                chunks.push(chunk.text);
            }
        }
        return { content: chunks.join('') };
    }
}
export default AllternitCohere;
