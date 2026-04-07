/**
 * Allternit Kimi Provider (Moonshot AI)
 *
 * Moonshot AI's Kimi API client for Allternit SDK
 * API: https://api.moonshot.cn/v1
 * Docs: https://platform.moonshot.cn/docs
 */
import { HarnessError } from '../../harness/types.js';
export const KIMI_MODELS = {
    MOONSHOT_V1_8K: 'moonshot-v1-8k',
    MOONSHOT_V1_32K: 'moonshot-v1-32k',
    MOONSHOT_V1_128K: 'moonshot-v1-128k',
};
export class AllternitKimi {
    apiKey;
    baseURL;
    constructor(options) {
        this.apiKey = options.apiKey;
        this.baseURL = options.baseURL || 'https://api.moonshot.cn/v1';
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
                presence_penalty: options.presencePenalty,
                frequency_penalty: options.frequencyPenalty,
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            throw new HarnessError(error.error?.message || `Kimi API error: ${response.status}`, HarnessErrorCode.PROVIDER_ERROR, { statusCode: response.status });
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
                presence_penalty: options.presencePenalty,
                frequency_penalty: options.frequencyPenalty,
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            throw new HarnessError(error.error?.message || `Kimi API error: ${response.status}`, HarnessErrorCode.PROVIDER_ERROR, { statusCode: response.status });
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
            // Return default models if API doesn't support listing
            return [
                { id: KIMI_MODELS.MOONSHOT_V1_8K, object: 'model', created: 1704067200, owned_by: 'moonshot' },
                { id: KIMI_MODELS.MOONSHOT_V1_32K, object: 'model', created: 1704067200, owned_by: 'moonshot' },
                { id: KIMI_MODELS.MOONSHOT_V1_128K, object: 'model', created: 1704067200, owned_by: 'moonshot' },
            ];
        }
        const data = await response.json();
        return data.data;
    }
}
export default AllternitKimi;
//# sourceMappingURL=index.js.map