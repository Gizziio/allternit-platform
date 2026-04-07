/**
 * Allternit Azure OpenAI Provider
 *
 * Azure OpenAI API client for Allternit SDK
 * API: https://{resource}.openai.azure.com/openai/deployments/{deployment}
 */
import { HarnessError } from '../../harness/types.js';
export class AllternitAzureOpenAI {
    apiKey;
    baseURL;
    apiVersion;
    constructor(options) {
        this.apiKey = options.apiKey;
        this.apiVersion = options.apiVersion || '2024-02-01';
        if (options.baseURL) {
            this.baseURL = options.baseURL;
        }
        else if (options.resourceName && options.deploymentName) {
            this.baseURL = `https://${options.resourceName}.openai.azure.com/openai/deployments/${options.deploymentName}`;
        }
        else {
            throw new HarnessError('Either baseURL or both resourceName and deploymentName must be provided', HarnessErrorCode.INVALID_CONFIG);
        }
    }
    async chat(options) {
        const url = `${this.baseURL}/chat/completions?api-version=${this.apiVersion}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': this.apiKey,
            },
            body: JSON.stringify({
                messages: options.messages,
                temperature: options.temperature,
                max_tokens: options.maxTokens,
                top_p: options.topP,
                frequency_penalty: options.frequencyPenalty,
                presence_penalty: options.presencePenalty,
                stop: options.stop,
                stream: false,
                functions: options.functions,
                function_call: options.functionCall,
                tools: options.tools,
                tool_choice: options.toolChoice,
                seed: options.seed,
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            throw new HarnessError(error.error?.message || `Azure OpenAI error: ${response.status}`, HarnessErrorCode.PROVIDER_ERROR, { statusCode: response.status });
        }
        const data = await response.json();
        return data;
    }
    async *chatStream(options) {
        const url = `${this.baseURL}/chat/completions?api-version=${this.apiVersion}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': this.apiKey,
                'Accept': 'text/event-stream',
            },
            body: JSON.stringify({
                messages: options.messages,
                temperature: options.temperature,
                max_tokens: options.maxTokens,
                top_p: options.topP,
                frequency_penalty: options.frequencyPenalty,
                presence_penalty: options.presencePenalty,
                stop: options.stop,
                stream: true,
                functions: options.functions,
                function_call: options.functionCall,
                tools: options.tools,
                tool_choice: options.toolChoice,
                seed: options.seed,
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            throw new HarnessError(error.error?.message || `Azure OpenAI error: ${response.status}`, HarnessErrorCode.PROVIDER_ERROR, { statusCode: response.status });
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
        // Azure doesn't have a standard models endpoint
        // Return known Azure OpenAI models
        return [
            { id: 'gpt-4', object: 'model', created: 1687882411, owned_by: 'azure-openai' },
            { id: 'gpt-4-turbo', object: 'model', created: 1687882411, owned_by: 'azure-openai' },
            { id: 'gpt-35-turbo', object: 'model', created: 1677649963, owned_by: 'azure-openai' },
            { id: 'gpt-35-turbo-16k', object: 'model', created: 1677649963, owned_by: 'azure-openai' },
        ];
    }
}
export { AllternitAzureOpenAI as AllternitAzure };
export default AllternitAzureOpenAI;
//# sourceMappingURL=index.js.map