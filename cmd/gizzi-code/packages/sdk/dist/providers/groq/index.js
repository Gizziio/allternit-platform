/**
 * Allternit Groq Provider
 *
 * Groq API client for Allternit SDK
 * API: https://api.groq.com/openai/v1 (OpenAI-compatible)
 */
import { HarnessError } from '../../harness/types.js';
export const GROQ_MODELS = {
    LLAMA3_8B: 'llama3-8b-8192',
    LLAMA3_70B: 'llama3-70b-8192',
    LLAMA2_70B: 'llama2-70b-4096',
    MIXTRAL_8X7B: 'mixtral-8x7b-32768',
    GEMMA_7B: 'gemma-7b-it',
    GEMMA2_9B: 'gemma2-9b-it',
    LLAMA3_1_70B: 'llama-3.1-70b-versatile',
    LLAMA3_1_8B: 'llama-3.1-8b-instant',
};
export class AllternitGroq {
    apiKey;
    baseURL;
    constructor(options) {
        this.apiKey = options.apiKey;
        this.baseURL = options.baseURL || 'https://api.groq.com/openai/v1';
    }
    async chat(options) {
        const response = await fetch(`${this.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: options.model,
                messages: options.messages,
                temperature: options.temperature,
                max_tokens: options.maxTokens,
                top_p: options.topP,
                stream: false,
                tools: options.tools,
                tool_choice: options.toolChoice,
                seed: options.seed,
                stop: options.stop,
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            throw new HarnessError(error.error?.message || `Groq API error: ${response.status}`, HarnessErrorCode.PROVIDER_ERROR, { statusCode: response.status });
        }
        const data = await response.json();
        return data;
    }
    async *chatStream(options) {
        const response = await fetch(`${this.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'Accept': 'text/event-stream',
            },
            body: JSON.stringify({
                model: options.model,
                messages: options.messages,
                temperature: options.temperature,
                max_tokens: options.maxTokens,
                top_p: options.topP,
                stream: true,
                tools: options.tools,
                tool_choice: options.toolChoice,
                seed: options.seed,
                stop: options.stop,
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            throw new HarnessError(error.error?.message || `Groq API error: ${response.status}`, HarnessErrorCode.PROVIDER_ERROR, { statusCode: response.status });
        }
        const reader = response.body.getReader();
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
                    if (line.trim() === '' || line.trim() === 'data: [DONE]')
                        continue;
                    if (line.startsWith('data: ')) {
                        try {
                            const chunk = JSON.parse(line.slice(6));
                            yield chunk;
                        }
                        catch {
                            // Skip malformed JSON
                        }
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
    }
    async listModels() {
        const response = await fetch(`${this.baseURL}/models`, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
            },
        });
        if (!response.ok) {
            throw new HarnessError(`Failed to list Groq models: ${response.status}`, HarnessErrorCode.PROVIDER_ERROR, { statusCode: response.status });
        }
        const data = await response.json();
        return data.data;
    }
}
export default AllternitGroq;
//# sourceMappingURL=index.js.map