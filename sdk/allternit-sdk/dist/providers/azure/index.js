/**
 * Azure OpenAI Provider for Allternit SDK
 * https://azure.microsoft.com/en-us/services/cognitive-services/openai-service/
 */
import { HarnessError, HarnessErrorCode } from '../../harness/types';
/**
 * Common Azure OpenAI API versions
 */
export const AZURE_API_VERSIONS = {
    V2024_02: '2024-02-01',
    V2024_06: '2024-06-01',
    V2024_08: '2024-08-01-preview',
    V2024_10: '2024-10-01-preview',
    V2025_01: '2025-01-01-preview',
};
/**
 * AllternitAzureOpenAI provides a client for Azure OpenAI Service
 */
export class AllternitAzureOpenAI {
    config;
    constructor(config) {
        const apiVersion = config.apiVersion || AZURE_API_VERSIONS.V2024_06;
        let baseURL;
        if (config.baseURL) {
            baseURL = config.baseURL.replace(/\/$/, '');
        }
        else if (config.resourceName) {
            baseURL = `https://${config.resourceName}.openai.azure.com/openai/deployments/${config.deploymentName}`;
        }
        else {
            throw new HarnessError(HarnessErrorCode.CONFIG_INVALID, 'Either resourceName or baseURL must be provided');
        }
        this.config = {
            apiKey: config.apiKey,
            baseURL,
            apiVersion,
            deploymentName: config.deploymentName,
        };
    }
    /**
     * Build the full API URL with query parameters
     */
    buildURL(endpoint) {
        const separator = this.config.baseURL.includes('?') ? '&' : '?';
        return `${this.config.baseURL}/${endpoint}${separator}api-version=${this.config.apiVersion}`;
    }
    /**
     * Transform internal messages to Azure OpenAI format
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
     * Transform tools to Azure OpenAI format
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
                throw new HarnessError(HarnessErrorCode.AUTHENTICATION_ERROR, 'Invalid Azure OpenAI API key', error);
            }
            if (response.status === 429) {
                throw new HarnessError(HarnessErrorCode.RATE_LIMITED, 'Azure OpenAI rate limit exceeded', error);
            }
            if (response.status === 404) {
                throw new HarnessError(HarnessErrorCode.PROVIDER_NOT_FOUND, 'Azure OpenAI deployment not found', error);
            }
            if (response.status >= 500) {
                throw new HarnessError(HarnessErrorCode.API_ERROR, `Azure OpenAI API error: ${response.status} ${response.statusText}`, error);
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
                messages: this.transformMessages(messages),
                temperature: options?.temperature,
                max_tokens: options?.maxTokens,
                top_p: options?.topP,
                frequency_penalty: options?.frequencyPenalty,
                presence_penalty: options?.presencePenalty,
                stop: options?.stop,
                tools: this.transformTools(options?.tools),
                stream: false,
            };
            const response = await fetch(this.buildURL('chat/completions'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': this.config.apiKey,
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
                messages: this.transformMessages(messages),
                temperature: options?.temperature,
                max_tokens: options?.maxTokens,
                top_p: options?.topP,
                frequency_penalty: options?.frequencyPenalty,
                presence_penalty: options?.presencePenalty,
                stop: options?.stop,
                tools: this.transformTools(options?.tools),
                stream: true,
            };
            const response = await fetch(this.buildURL('chat/completions'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': this.config.apiKey,
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
     * Get rate limit information from headers
     */
    async getRateLimits() {
        try {
            // Make a minimal request to get rate limit headers
            const response = await fetch(this.buildURL('models'), {
                method: 'GET',
                headers: {
                    'api-key': this.config.apiKey,
                },
            });
            const headers = response.headers;
            const resetSeconds = headers.get('x-ratelimit-reset-requests');
            return {
                requestsRemaining: parseInt(headers.get('x-ratelimit-remaining-requests') || '0') || undefined,
                requestsLimit: parseInt(headers.get('x-ratelimit-limit-requests') || '0') || undefined,
                tokensRemaining: parseInt(headers.get('x-ratelimit-remaining-tokens') || '0') || undefined,
                tokensLimit: parseInt(headers.get('x-ratelimit-limit-tokens') || '0') || undefined,
                resetTime: resetSeconds ? new Date(parseInt(resetSeconds) * 1000) : undefined,
            };
        }
        catch (error) {
            // Silently return empty object on error
            return {};
        }
    }
}
export default AllternitAzureOpenAI;
