/**
 * AWS Bedrock Provider for Allternit SDK
 * https://aws.amazon.com/bedrock/
 *
 * Note: This provider uses AWS SDK. In browser environments,
 * you need to configure AWS credentials separately.
 */
import { HarnessError, HarnessErrorCode } from '../../harness/types';
/**
 * Supported AWS Bedrock models
 */
export const BEDROCK_MODELS = {
    // Anthropic Claude models
    CLAUDE_3_OPUS: 'anthropic.claude-3-opus-20240229-v1:0',
    CLAUDE_3_SONNET: 'anthropic.claude-3-sonnet-20240229-v1:0',
    CLAUDE_3_HAIKU: 'anthropic.claude-3-haiku-20240307-v1:0',
    CLAUDE_3_5_SONNET: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    CLAUDE_3_5_SONNET_V2: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    CLAUDE_3_5_HAIKU: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    // Meta Llama models
    LLAMA_2_13B: 'meta.llama2-13b-chat-v1',
    LLAMA_2_70B: 'meta.llama2-70b-chat-v1',
    LLAMA_3_8B: 'meta.llama3-8b-instruct-v1:0',
    LLAMA_3_70B: 'meta.llama3-70b-instruct-v1:0',
    LLAMA_3_1_8B: 'meta.llama3-1-8b-instruct-v1:0',
    LLAMA_3_1_70B: 'meta.llama3-1-70b-instruct-v1:0',
    LLAMA_3_1_405B: 'meta.llama3-1-405b-instruct-v1:0',
    LLAMA_3_2_1B: 'meta.llama3-2-1b-instruct-v1:0',
    LLAMA_3_2_3B: 'meta.llama3-2-3b-instruct-v1:0',
    LLAMA_3_2_11B: 'meta.llama3-2-11b-instruct-v1:0',
    LLAMA_3_2_90B: 'meta.llama3-2-90b-instruct-v1:0',
    // Amazon Titan models
    TITAN_TEXT_G1: 'amazon.titan-text-express-v1',
    TITAN_TEXT_PREMIER: 'amazon.titan-text-premier-v1:0',
    TITAN_EMBED_G1: 'amazon.titan-embed-text-v1',
    // Mistral models
    MISTRAL_7B: 'mistral.mistral-7b-instruct-v0:2',
    MIXTRAL_8X7B: 'mistral.mixtral-8x7b-instruct-v0:1',
    MISTRAL_LARGE: 'mistral.mistral-large-2402-v1:0',
    // AI21 Jurassic models
    JURASSIC_2_MID: 'ai21.j2-mid-v1',
    JURASSIC_2_ULTRA: 'ai21.j2-ultra-v1',
    // Cohere models
    COHERE_COMMAND: 'cohere.command-text-v14',
    COHERE_COMMAND_LIGHT: 'cohere.command-light-text-v14',
    COHERE_EMBED_ENGLISH: 'cohere.embed-english-v3',
    // Stability AI models
    STABLE_DIFFUSION_XL: 'stability.stable-diffusion-xl-v1',
};
/**
 * AllternitBedrock provides a client for AWS Bedrock
 */
export class AllternitBedrock {
    config;
    constructor(config) {
        this.config = {
            region: config.region,
            accessKeyId: config.accessKeyId || '',
            secretAccessKey: config.secretAccessKey || '',
            sessionToken: config.sessionToken || '',
            defaultModel: config.defaultModel || BEDROCK_MODELS.CLAUDE_3_5_SONNET,
        };
    }
    /**
     * Get the base URL for Bedrock API
     */
    getBaseURL() {
        return `https://bedrock-runtime.${this.config.region}.amazonaws.com`;
    }
    /**
     * Get AWS signature headers (simplified - in production use AWS SDK)
     */
    async getHeaders(body) {
        // In a real implementation, you'd use AWS Signature Version 4
        // For now, return basic headers - users should configure CORS/proxy
        return {
            'Content-Type': 'application/json',
            'X-Amz-Region': this.config.region,
        };
    }
    /**
     * Transform internal messages to Bedrock Converse API format
     */
    transformMessages(messages) {
        const bedrockMessages = [];
        let systemPrompts;
        for (const msg of messages) {
            if (msg.role === 'system') {
                if (!systemPrompts)
                    systemPrompts = [];
                systemPrompts.push({ text: msg.content });
                continue;
            }
            const role = msg.role === 'user' ? 'user' : 'assistant';
            const content = [];
            // Add text content
            if (msg.content) {
                content.push({ text: msg.content });
            }
            // Add tool calls
            if (msg.tool_calls) {
                for (const tc of msg.tool_calls) {
                    content.push({
                        toolUse: {
                            toolUseId: tc.id,
                            name: tc.name,
                            input: tc.arguments,
                        },
                    });
                }
            }
            // Add tool results
            if (msg.tool_call_id && msg.content) {
                // Tool results go in the next user message
                const lastMsg = bedrockMessages[bedrockMessages.length - 1];
                if (lastMsg?.role === 'user') {
                    lastMsg.content.push({
                        toolResult: {
                            toolUseId: msg.tool_call_id,
                            content: [{ text: msg.content }],
                        },
                    });
                }
                continue;
            }
            bedrockMessages.push({ role, content });
        }
        return { messages: bedrockMessages, system: systemPrompts };
    }
    /**
     * Transform tools to Bedrock format
     */
    transformTools(tools) {
        if (!tools?.length)
            return undefined;
        return {
            tools: tools.map(tool => ({
                toolSpec: {
                    name: tool.name,
                    description: tool.description,
                    inputSchema: {
                        json: tool.parameters,
                    },
                },
            })),
        };
    }
    /**
     * Handle API errors
     */
    handleError(error, response) {
        if (error instanceof HarnessError)
            throw error;
        if (response) {
            if (response.status === 403) {
                throw new HarnessError(HarnessErrorCode.AUTHENTICATION_ERROR, 'AWS credentials invalid or missing Bedrock permissions', error);
            }
            if (response.status === 429) {
                throw new HarnessError(HarnessErrorCode.RATE_LIMITED, 'AWS Bedrock rate limit exceeded', error);
            }
            if (response.status === 404) {
                throw new HarnessError(HarnessErrorCode.PROVIDER_NOT_FOUND, 'AWS Bedrock model not found or not enabled', error);
            }
            if (response.status === 413) {
                throw new HarnessError(HarnessErrorCode.API_ERROR, 'Input too large for AWS Bedrock model', error);
            }
            if (response.status >= 500) {
                throw new HarnessError(HarnessErrorCode.API_ERROR, `AWS Bedrock error: ${response.status} ${response.statusText}`, error);
            }
        }
        throw new HarnessError(HarnessErrorCode.UNKNOWN_ERROR, error instanceof Error ? error.message : 'Unknown error', error);
    }
    /**
     * Non-streaming chat completion using Converse API
     */
    async chat(messages, options) {
        try {
            const transformed = this.transformMessages(messages);
            const request = {
                modelId: options?.model || this.config.defaultModel,
                messages: transformed.messages,
                system: transformed.system,
                inferenceConfig: {
                    temperature: options?.temperature,
                    maxTokens: options?.maxTokens,
                    topP: options?.topP,
                    stopSequences: options?.stopSequences,
                },
                toolConfig: this.transformTools(options?.tools),
            };
            const body = JSON.stringify(request);
            const headers = await this.getHeaders(body);
            const response = await fetch(`${this.getBaseURL()}/model/${request.modelId}/converse`, {
                method: 'POST',
                headers,
                body,
            });
            if (!response.ok) {
                this.handleError(new Error(`HTTP ${response.status}`), response);
            }
            const data = await response.json();
            // Extract text and tool calls from response
            let content = '';
            const toolCalls = [];
            for (const item of data.output.message?.content || []) {
                if ('text' in item) {
                    content += item.text;
                }
                if ('toolUse' in item) {
                    toolCalls.push({
                        id: item.toolUse.toolUseId,
                        name: item.toolUse.name,
                        arguments: item.toolUse.input,
                    });
                }
            }
            return {
                content,
                toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                usage: {
                    promptTokens: data.usage.inputTokens,
                    completionTokens: data.usage.outputTokens,
                    totalTokens: data.usage.totalTokens,
                },
            };
        }
        catch (error) {
            if (error instanceof HarnessError)
                throw error;
            this.handleError(error);
        }
    }
    /**
     * Streaming chat completion using ConverseStream API
     */
    async *chatStream(messages, options) {
        try {
            const transformed = this.transformMessages(messages);
            const request = {
                modelId: options?.model || this.config.defaultModel,
                messages: transformed.messages,
                system: transformed.system,
                inferenceConfig: {
                    temperature: options?.temperature,
                    maxTokens: options?.maxTokens,
                    topP: options?.topP,
                    stopSequences: options?.stopSequences,
                },
                toolConfig: this.transformTools(options?.tools),
            };
            const body = JSON.stringify(request);
            const headers = await this.getHeaders(body);
            const response = await fetch(`${this.getBaseURL()}/model/${request.modelId}/converse-stream`, {
                method: 'POST',
                headers: {
                    ...headers,
                    'Accept': 'application/vnd.amazon.eventstream',
                },
                body,
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
                    if (!trimmed)
                        continue;
                    try {
                        const event = JSON.parse(trimmed);
                        // Handle content block delta (text)
                        if (event.contentBlockDelta?.delta?.text) {
                            yield { content: event.contentBlockDelta.delta.text };
                        }
                        // Handle tool use start
                        if (event.contentBlockStart?.start?.toolUse) {
                            const tool = event.contentBlockStart.start.toolUse;
                            yield {
                                toolCalls: [{
                                        id: tool.toolUseId || '',
                                        name: tool.name || '',
                                        arguments: JSON.stringify(tool.input || {}),
                                    }],
                            };
                        }
                        // Handle tool use delta (partial input)
                        if (event.contentBlockDelta?.delta?.toolUse?.input) {
                            const partial = event.contentBlockDelta.delta.toolUse;
                            yield {
                                toolCalls: [{
                                        id: partial.toolUseId || '',
                                        name: '',
                                        arguments: partial.input,
                                    }],
                            };
                        }
                    }
                    catch {
                        // Skip invalid JSON lines
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
     * List available models (requires proper AWS permissions)
     * Note: This uses the Bedrock Control Plane API, not the Runtime API
     */
    async listModels() {
        try {
            // Bedrock Control Plane endpoint
            const controlPlaneUrl = `https://bedrock.${this.config.region}.amazonaws.com/foundation-models`;
            const response = await fetch(controlPlaneUrl, {
                method: 'GET',
                headers: await this.getHeaders(''),
            });
            if (!response.ok) {
                this.handleError(new Error(`HTTP ${response.status}`), response);
            }
            const data = await response.json();
            return (data.modelSummaries || []).map((model) => ({
                id: model.modelId,
                name: model.modelName,
                provider: model.providerName,
            }));
        }
        catch (error) {
            if (error instanceof HarnessError)
                throw error;
            this.handleError(error);
        }
    }
    /**
     * Invoke a model directly (for non-converse models)
     */
    async invokeModel(modelId, body) {
        try {
            const response = await fetch(`${this.getBaseURL()}/model/${modelId}/invoke`, {
                method: 'POST',
                headers: await this.getHeaders(JSON.stringify(body)),
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                this.handleError(new Error(`HTTP ${response.status}`), response);
            }
            return await response.json();
        }
        catch (error) {
            if (error instanceof HarnessError)
                throw error;
            this.handleError(error);
        }
    }
}
export default AllternitBedrock;
