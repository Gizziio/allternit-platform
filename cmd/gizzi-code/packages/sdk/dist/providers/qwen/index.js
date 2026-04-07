/**
 * Allternit Qwen Provider (Alibaba Cloud)
 *
 * Alibaba Cloud's Qwen API client for Allternit SDK
 * API: https://dashscope.aliyuncs.com/api/v1
 * Docs: https://help.aliyun.com/zh/dashscope/
 */
import { HarnessError } from '../../harness/types.js';
export const QWEN_MODELS = {
    QWEN_MAX: 'qwen-max',
    QWEN_PLUS: 'qwen-plus',
    QWEN_TURBO: 'qwen-turbo',
    QWEN_72B_CHAT: 'qwen-72b-chat',
    QWEN_14B_CHAT: 'qwen-14b-chat',
    QWEN_7B_CHAT: 'qwen-7b-chat',
    QWEN_VL_PLUS: 'qwen-vl-plus',
    QWEN_VL_MAX: 'qwen-vl-max',
};
export class AllternitQwen {
    apiKey;
    baseURL;
    constructor(options) {
        this.apiKey = options.apiKey;
        this.baseURL = options.baseURL || 'https://dashscope.aliyuncs.com/api/v1';
    }
    async chat(options) {
        const response = await fetch(`${this.baseURL}/services/aigc/text-generation/generation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: options.model,
                input: {
                    messages: options.messages,
                },
                parameters: {
                    temperature: options.temperature,
                    max_tokens: options.maxTokens,
                    top_p: options.topP,
                    result_format: options.resultFormat || 'message',
                    tools: options.tools,
                    tool_choice: options.toolChoice,
                    enable_search: options.enableSearch,
                },
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new HarnessError(error.message || `Qwen API error: ${response.status}`, HarnessErrorCode.PROVIDER_ERROR, { statusCode: response.status });
        }
        const data = await response.json();
        return data;
    }
    async *chatStream(options) {
        const response = await fetch(`${this.baseURL}/services/aigc/text-generation/generation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'Accept': 'text/event-stream',
                'X-DashScope-SSE': 'enable',
            },
            body: JSON.stringify({
                model: options.model,
                input: {
                    messages: options.messages,
                },
                parameters: {
                    temperature: options.temperature,
                    max_tokens: options.maxTokens,
                    top_p: options.topP,
                    result_format: options.resultFormat || 'message',
                    tools: options.tools,
                    tool_choice: options.toolChoice,
                    enable_search: options.enableSearch,
                },
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new HarnessError(error.message || `Qwen API error: ${response.status}`, HarnessErrorCode.PROVIDER_ERROR, { statusCode: response.status });
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
                    if (line.trim() === '' || !line.startsWith('data:'))
                        continue;
                    try {
                        const jsonStr = line.slice(5).trim();
                        if (jsonStr === '[DONE]')
                            return;
                        const chunk = JSON.parse(jsonStr);
                        yield chunk;
                    }
                    catch {
                        // Skip malformed JSON
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
    }
    async listModels() {
        // DashScope doesn't have a public models endpoint, return known models
        return [
            { id: QWEN_MODELS.QWEN_MAX, name: 'Qwen Max' },
            { id: QWEN_MODELS.QWEN_PLUS, name: 'Qwen Plus' },
            { id: QWEN_MODELS.QWEN_TURBO, name: 'Qwen Turbo' },
            { id: QWEN_MODELS.QWEN_72B_CHAT, name: 'Qwen 72B Chat' },
            { id: QWEN_MODELS.QWEN_14B_CHAT, name: 'Qwen 14B Chat' },
            { id: QWEN_MODELS.QWEN_7B_CHAT, name: 'Qwen 7B Chat' },
            { id: QWEN_MODELS.QWEN_VL_PLUS, name: 'Qwen VL Plus' },
            { id: QWEN_MODELS.QWEN_VL_MAX, name: 'Qwen VL Max' },
        ];
    }
}
export default AllternitQwen;
//# sourceMappingURL=index.js.map