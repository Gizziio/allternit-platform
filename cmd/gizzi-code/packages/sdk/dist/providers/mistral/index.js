/**
 * Allternit Mistral AI Provider
 *
 * Mistral AI API client for Allternit SDK
 * API: https://api.mistral.ai/v1
 */
import { HarnessError } from '../../harness/types.js';
export const MISTRAL_MODELS = {
    LARGE: 'mistral-large-latest',
    MEDIUM: 'mistral-medium-latest',
    SMALL: 'mistral-small-latest',
    TINY: 'mistral-tiny',
    EMBED: 'mistral-embed',
};
export class AllternitMistral {
    apiKey;
    baseURL;
    constructor(options) {
        this.apiKey = options.apiKey;
        this.baseURL = options.baseURL || 'https://api.mistral.ai/v1';
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
                response_format: options.responseFormat,
                safe_mode: options.safeMode,
                random_seed: options.randomSeed,
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new HarnessError(error.message || `Mistral API error: ${response.status}`, HarnessErrorCode.PROVIDER_ERROR, { statusCode: response.status });
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
                response_format: options.responseFormat,
                safe_mode: options.safeMode,
                random_seed: options.randomSeed,
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new HarnessError(error.message || `Mistral API error: ${response.status}`, HarnessErrorCode.PROVIDER_ERROR, { statusCode: response.status });
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
            throw new HarnessError(`Failed to list Mistral models: ${response.status}`, HarnessErrorCode.PROVIDER_ERROR, { statusCode: response.status });
        }
        const data = await response.json();
        return data.data;
    }
}
export default AllternitMistral;
//# sourceMappingURL=index.js.map