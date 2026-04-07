/**
 * Allternit Together AI Provider
 *
 * Together AI API client for Allternit SDK
 * API: https://api.together.xyz/v1 (OpenAI-compatible)
 */
import { HarnessError } from '../../harness/types.js';
export const TOGETHER_MODELS = {
    LLAMA2_70B: 'togethercomputer/llama-2-70b-chat',
    LLAMA2_13B: 'togethercomputer/llama-2-13b-chat',
    LLAMA2_7B: 'togethercomputer/llama-2-7b-chat',
    MISTRAL_7B: 'mistralai/Mistral-7B-Instruct-v0.1',
    MIXTRAL_8X7B: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    QWEN_72B: 'Qwen/Qwen1.5-72B-Chat',
    DBRX: 'databricks/dbrx-instruct',
};
export class AllternitTogether {
    apiKey;
    baseURL;
    constructor(options) {
        this.apiKey = options.apiKey;
        this.baseURL = options.baseURL || 'https://api.together.xyz/v1';
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
                top_k: options.topK,
                stream: false,
                tools: options.tools,
                tool_choice: options.toolChoice,
                stop: options.stop,
                repetition_penalty: options.repetitionPenalty,
                presence_penalty: options.presencePenalty,
                frequency_penalty: options.frequencyPenalty,
                min_p: options.minP,
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            throw new HarnessError(error.error?.message || `Together AI error: ${response.status}`, HarnessErrorCode.PROVIDER_ERROR, { statusCode: response.status });
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
                top_k: options.topK,
                stream: true,
                tools: options.tools,
                tool_choice: options.toolChoice,
                stop: options.stop,
                repetition_penalty: options.repetitionPenalty,
                presence_penalty: options.presencePenalty,
                frequency_penalty: options.frequencyPenalty,
                min_p: options.minP,
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            throw new HarnessError(error.error?.message || `Together AI error: ${response.status}`, HarnessErrorCode.PROVIDER_ERROR, { statusCode: response.status });
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
            throw new HarnessError(`Failed to list Together AI models: ${response.status}`, HarnessErrorCode.PROVIDER_ERROR, { statusCode: response.status });
        }
        const data = await response.json();
        return data.data;
    }
}
export default AllternitTogether;
//# sourceMappingURL=index.js.map