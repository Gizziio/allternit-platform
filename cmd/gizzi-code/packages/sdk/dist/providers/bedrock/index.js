/**
 * Allternit AWS Bedrock Provider
 *
 * AWS Bedrock API client for Allternit SDK
 * Uses AWS SDK for Bedrock Runtime
 */
import { HarnessError } from '../../harness/types.js';
export const BEDROCK_MODELS = {
    CLAUDE_3_OPUS: 'anthropic.claude-3-opus-20240229-v1:0',
    CLAUDE_3_SONNET: 'anthropic.claude-3-sonnet-20240229-v1:0',
    CLAUDE_3_HAIKU: 'anthropic.claude-3-haiku-20240307-v1:0',
    CLAUDE_3_5_SONNET: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    LLAMA2_13B: 'meta.llama2-13b-chat-v1',
    LLAMA2_70B: 'meta.llama2-70b-chat-v1',
    LLAMA3_8B: 'meta.llama3-8b-instruct-v1:0',
    LLAMA3_70B: 'meta.llama3-70b-instruct-v1:0',
    MISTRAL_7B: 'mistral.mistral-7b-instruct-v0:2',
    MISTRAL_8X7B: 'mistral.mixtral-8x7b-instruct-v0:1',
    MISTRAL_LARGE: 'mistral.mistral-large-2402-v1:0',
    TITAN_EXPRESS: 'amazon.titan-text-express-v1',
};
export class AllternitBedrock {
    region;
    credentials;
    baseURL;
    constructor(options = {}) {
        this.region = options.region || process.env.AWS_REGION || 'us-east-1';
        this.credentials = {
            accessKeyId: options.accessKeyId || process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY,
            sessionToken: options.sessionToken || process.env.AWS_SESSION_TOKEN,
        };
        this.baseURL = `https://bedrock-runtime.${this.region}.amazonaws.com`;
    }
    async signRequest(request) {
        // AWS Signature Version 4 signing
        // This is a simplified version - in production, use aws4fetch or similar
        const { accessKeyId, secretAccessKey, sessionToken } = this.credentials;
        if (!accessKeyId || !secretAccessKey) {
            throw new HarnessError('AWS credentials not provided. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.', HarnessErrorCode.AUTH_ERROR);
        }
        // For now, return request as-is (AWS SDK should handle signing)
        // In production, implement proper SigV4 signing or use aws4fetch
        return request;
    }
    async chat(options) {
        const url = `${this.baseURL}/model/${options.modelId}/converse`;
        const body = {
            messages: options.messages,
            system: options.system ? [{ text: options.system }] : undefined,
            inferenceConfig: {
                maxTokens: options.maxTokens,
                temperature: options.temperature,
                topP: options.topP,
                stopSequences: options.stopSequences,
            },
            toolConfig: options.tools ? {
                tools: options.tools,
                toolChoice: options.toolChoice,
            } : undefined,
        };
        let request = new Request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        request = await this.signRequest(request);
        const response = await fetch(request);
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new HarnessError(error.message || `Bedrock error: ${response.status}`, HarnessErrorCode.PROVIDER_ERROR, { statusCode: response.status });
        }
        const data = await response.json();
        return data;
    }
    async *chatStream(options) {
        const url = `${this.baseURL}/model/${options.modelId}/converse-stream`;
        const body = {
            messages: options.messages,
            system: options.system ? [{ text: options.system }] : undefined,
            inferenceConfig: {
                maxTokens: options.maxTokens,
                temperature: options.temperature,
                topP: options.topP,
                stopSequences: options.stopSequences,
            },
            toolConfig: options.tools ? {
                tools: options.tools,
                toolChoice: options.toolChoice,
            } : undefined,
        };
        let request = new Request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        request = await this.signRequest(request);
        const response = await fetch(request);
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new HarnessError(error.message || `Bedrock error: ${response.status}`, HarnessErrorCode.PROVIDER_ERROR, { statusCode: response.status });
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
                    if (line.trim() === '' || !line.startsWith('data: '))
                        continue;
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
        finally {
            reader.releaseLock();
        }
    }
    async listModels() {
        // Return known Bedrock models
        return Object.entries(BEDROCK_MODELS).map(([key, id]) => {
            const provider = id.split('.')[0];
            return {
                id,
                name: key,
                provider,
            };
        });
    }
}
export default AllternitBedrock;
//# sourceMappingURL=index.js.map