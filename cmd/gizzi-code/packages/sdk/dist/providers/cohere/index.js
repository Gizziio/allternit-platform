/**
 * Allternit Cohere Provider
 *
 * Cohere API client for Allternit SDK
 * API: https://api.cohere.com/v1
 */
import { HarnessError } from '../../harness/types.js';
export const COHERE_MODELS = {
    COMMAND: 'command',
    COMMAND_LIGHT: 'command-light',
    COMMAND_R: 'command-r',
    COMMAND_R_PLUS: 'command-r-plus',
};
export class AllternitCohere {
    apiKey;
    baseURL;
    constructor(options) {
        this.apiKey = options.apiKey;
        this.baseURL = options.baseURL || 'https://api.cohere.com/v1';
    }
    async chat(options) {
        const response = await fetch(`${this.baseURL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: options.model,
                message: options.message,
                chat_history: options.chatHistory,
                preamble: options.preamble,
                temperature: options.temperature,
                max_tokens: options.maxTokens,
                k: options.k,
                p: options.p,
                seed: options.seed,
                stream: false,
                tools: options.tools,
                force_single_step: options.forceSingleStep,
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new HarnessError(error.message || `Cohere API error: ${response.status}`, HarnessErrorCode.PROVIDER_ERROR, { statusCode: response.status });
        }
        const data = await response.json();
        return data;
    }
    async *chatStream(options) {
        const response = await fetch(`${this.baseURL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'Accept': 'text/event-stream',
            },
            body: JSON.stringify({
                model: options.model,
                message: options.message,
                chat_history: options.chatHistory,
                preamble: options.preamble,
                temperature: options.temperature,
                max_tokens: options.maxTokens,
                k: options.k,
                p: options.p,
                seed: options.seed,
                stream: true,
                tools: options.tools,
                force_single_step: options.forceSingleStep,
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new HarnessError(error.message || `Cohere API error: ${response.status}`, HarnessErrorCode.PROVIDER_ERROR, { statusCode: response.status });
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
                    if (line.trim() === '')
                        continue;
                    if (line.startsWith('data: ')) {
                        try {
                            const event = JSON.parse(line.slice(6));
                            if (event.is_finished) {
                                return;
                            }
                            yield event;
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
        // Cohere doesn't have a models endpoint, return known models
        return Object.values(COHERE_MODELS);
    }
}
export default AllternitCohere;
//# sourceMappingURL=index.js.map