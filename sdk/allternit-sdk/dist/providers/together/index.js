/**
 * Together AI Provider for Allternit SDK
 * https://www.together.ai/
 * OpenAI-compatible API for open source models
 */
import { HarnessError, HarnessErrorCode } from '../../harness/types';
/**
 * Popular Together AI models
 */
export const TOGETHER_MODELS = {
    // Llama models
    LLAMA_2_70B: 'togethercomputer/llama-2-70b-chat',
    LLAMA_3_70B: 'meta-llama/Llama-3-70b-chat-hf',
    LLAMA_3_8B: 'meta-llama/Llama-3-8b-chat-hf',
    LLAMA_3_1_70B: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    LLAMA_3_1_8B: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    LLAMA_3_1_405B: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
    // Mistral models
    MIXTRAL_8X7B: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    MIXTRAL_8X22B: 'mistralai/Mixtral-8x22B-Instruct-v0.1',
    MISTRAL_7B: 'mistralai/Mistral-7B-Instruct-v0.2',
    // Qwen models
    QWEN_2_72B: 'Qwen/Qwen2-72B-Instruct',
    QWEN_2_7B: 'Qwen/Qwen2-7B-Instruct',
    // Other popular models
    DBRX_INSTRUCT: 'databricks/dbrx-instruct',
    NOUS_HERMES_2_YI_34B: 'NousResearch/Nous-Hermes-2-Yi-34B',
    WIZARDLM_2_8X22B: 'microsoft/WizardLM-2-8x22B',
    // Code models
    CODE_LLAMA_70B: 'togethercomputer/CodeLlama-70b-Instruct',
    DEEPSEEK_CODER_33B: 'deepseek-ai/deepseek-coder-33b-instruct',
    // Vision models
    LLAVA_13B: 'liuhaotian/llava-v1.5-13b',
};
/**
 * AllternitTogether provides a client for Together AI API
 */
export class AllternitTogether {
    config;
    constructor(config) {
        this.config = {
            apiKey: config.apiKey,
            baseURL: (config.baseURL || 'https://api.together.xyz/v1').replace(/\/$/, ''),
            defaultModel: config.defaultModel || TOGETHER_MODELS.LLAMA_3_1_70B,
        };
    }
    /**
     * Transform internal messages to Together format (OpenAI-compatible)
     */
    transformMessages(messages) {
        return messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            ...(msg.name && { name: msg.name }),
            ...(msg.tool_calls && {
                tool_calls: msg.tool_calls.map(tc => ({
                    id: tc.id,
                    type: 'function',
                    function: {
                        name: tc.name,
                        arguments: JSON.stringify(tc.arguments),
                    },
                })),
            }),
            ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
        }));
    }
    /**
     * Transform tools to Together format (OpenAI-compatible)
     */
    transformTools(tools) {
        if (!tools?.length)
            return undefined;
        return tools.map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
            },
        }));
    }
    /**
     * Handle API errors
     */
    handleError(error, response) {
        if (error instanceof HarnessError)
            throw error;
        if (response) {
            if (response.status === 401) {
                throw new HarnessError(HarnessErrorCode.AUTHENTICATION_ERROR, 'Invalid Together AI API key', error);
            }
            if (response.status === 429) {
                throw new HarnessError(HarnessErrorCode.RATE_LIMITED, 'Together AI rate limit exceeded', error);
            }
            if (response.status >= 500) {
                throw new HarnessError(HarnessErrorCode.API_ERROR, `Together AI API error: ${response.status} ${response.statusText}`, error);
            }
        }
        throw new HarnessError(HarnessErrorCode.UNKNOWN_ERROR, error instanceof Error ? error.message : 'Unknown error', error);
    }
    /**
     * Non-streaming chat completion
     */
    async chat(messages, options) {
        try {
            const request = {
                model: options?.model || this.config.defaultModel,
                messages: this.transformMessages(messages),
                temperature: options?.temperature,
                max_tokens: options?.maxTokens,
                top_p: options?.topP,
                top_k: options?.topK,
                repetition_penalty: options?.repetitionPenalty,
                stop: options?.stop,
                tools: this.transformTools(options?.tools),
                stream: false,
            };
            const response = await fetch(`${this.config.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`,
                },
                body: JSON.stringify(request),
            });
            if (!response.ok) {
                this.handleError(new Error(`HTTP ${response.status}`), response);
            }
            const data = await response.json();
            const choice = data.choices[0];
            return {
                content: choice.message.content || '',
                toolCalls: choice.message.tool_calls?.map(tc => ({
                    id: tc.id,
                    name: tc.function.name,
                    arguments: JSON.parse(tc.function.arguments),
                })),
                usage: data.usage ? {
                    promptTokens: data.usage.prompt_tokens,
                    completionTokens: data.usage.completion_tokens,
                    totalTokens: data.usage.total_tokens,
                } : undefined,
            };
        }
        catch (error) {
            if (error instanceof HarnessError)
                throw error;
            this.handleError(error);
        }
    }
    /**
     * Streaming chat completion
     */
    async *chatStream(messages, options) {
        try {
            const request = {
                model: options?.model || this.config.defaultModel,
                messages: this.transformMessages(messages),
                temperature: options?.temperature,
                max_tokens: options?.maxTokens,
                top_p: options?.topP,
                top_k: options?.topK,
                repetition_penalty: options?.repetitionPenalty,
                stop: options?.stop,
                tools: this.transformTools(options?.tools),
                stream: true,
            };
            const response = await fetch(`${this.config.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Accept': 'text/event-stream',
                },
                body: JSON.stringify(request),
            });
            if (!response.ok) {
                this.handleError(new Error(`HTTP ${response.status}`), response);
            }
            const reader = response.body?.getReader();
            if (!reader) {
                throw new HarnessError(HarnessErrorCode.STREAM_ERROR, 'No response body');
            }
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === 'data: [DONE]')
                        continue;
                    if (trimmed.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(trimmed.slice(6));
                            const delta = data.choices[0]?.delta;
                            if (delta?.content) {
                                yield { content: delta.content };
                            }
                            if (delta?.tool_calls) {
                                for (const tc of delta.tool_calls) {
                                    if (tc.function?.name || tc.function?.arguments) {
                                        yield {
                                            toolCalls: [{
                                                    id: tc.id || '',
                                                    name: tc.function.name || '',
                                                    arguments: tc.function.arguments || '',
                                                }],
                                        };
                                    }
                                }
                            }
                        }
                        catch {
                            // Skip invalid JSON lines
                        }
                    }
                }
            }
        }
        catch (error) {
            if (error instanceof HarnessError)
                throw error;
            this.handleError(error);
        }
    }
    /**
     * List available models from Together AI
     */
    async listModels() {
        try {
            const response = await fetch(`${this.config.baseURL}/models`, {
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                },
            });
            if (!response.ok) {
                this.handleError(new Error(`HTTP ${response.status}`), response);
            }
            const data = await response.json();
            return (data.data || []).map((model) => ({
                id: model.id,
                name: model.id,
                context_length: model.context_length,
            }));
        }
        catch (error) {
            if (error instanceof HarnessError)
                throw error;
            this.handleError(error);
        }
    }
}
export default AllternitTogether;
