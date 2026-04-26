/**
 * Groq Provider
 * Groq Cloud API integration (ultra-fast inference)
 */
import { HarnessError, HarnessErrorCode } from '../../harness/types.js';
export class AllternitGroq {
    config;
    baseURL;
    constructor(config) {
        this.config = config;
        this.baseURL = config.baseURL || 'https://api.groq.com/openai/v1';
    }
    async *stream(request) {
        const url = `${this.baseURL}/chat/completions`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`,
            },
            body: JSON.stringify({
                model: request.model,
                messages: request.messages,
                max_tokens: request.maxTokens,
                temperature: request.temperature,
                top_p: request.topP,
                stream: true,
                ...(request.tools ? { tools: request.tools } : {}),
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new HarnessError(HarnessErrorCode.API_ERROR, `Groq error: ${response.status} ${response.statusText} - ${errorText}`);
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
                    if (data === '[DONE]') {
                        yield { type: 'done' };
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices?.[0]?.delta;
                        if (delta?.content) {
                            yield { type: 'text', text: delta.content };
                        }
                        if (delta?.tool_calls) {
                            for (const toolCall of delta.tool_calls) {
                                yield {
                                    type: 'tool_call',
                                    id: toolCall.id || parsed.choices[0].id,
                                    name: toolCall.function?.name || '',
                                    arguments: toolCall.function?.arguments || '',
                                };
                            }
                        }
                        if (parsed.choices?.[0]?.finish_reason === 'stop' ||
                            parsed.choices?.[0]?.finish_reason === 'tool_calls') {
                            yield {
                                type: 'done',
                                usage: parsed.usage ? {
                                    promptTokens: parsed.usage.prompt_tokens,
                                    completionTokens: parsed.usage.completion_tokens,
                                    totalTokens: parsed.usage.total_tokens,
                                } : undefined,
                            };
                            return;
                        }
                    }
                    catch {
                        // Ignore parse errors for malformed chunks
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
export default AllternitGroq;
