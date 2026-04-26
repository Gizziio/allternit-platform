/**
 * AllternitOllama Provider
 * Local Ollama model integration for the Allternit harness
 */
/**
 * AllternitOllama provides a client for local Ollama instances
 */
export class AllternitOllama {
    config;
    constructor(config) {
        this.config = {
            baseURL: config.baseURL.replace(/\/$/, ''), // Remove trailing slash
            defaultModel: config.defaultModel || 'llama2',
        };
    }
    /**
     * List available models from the Ollama server
     */
    async listModels() {
        const response = await fetch(`${this.config.baseURL}/api/tags`);
        if (!response.ok) {
            throw new Error(`Failed to list models: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return (data.models || []).map((model) => ({
            name: model.name,
            size: model.size,
            digest: model.digest,
            modified: model.modified_at,
        }));
    }
    /**
     * Pull a model from Ollama
     */
    async pullModel(model) {
        const response = await fetch(`${this.config.baseURL}/api/pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: model, stream: false }),
        });
        if (!response.ok) {
            throw new Error(`Failed to pull model: ${response.status} ${response.statusText}`);
        }
    }
    /**
     * Generate completion using Ollama
     */
    async *generate(request) {
        const response = await fetch(`${this.config.baseURL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: request.model,
                prompt: request.prompt,
                system: request.system,
                stream: true,
                options: request.options,
            }),
        });
        if (!response.ok) {
            throw new Error(`Generation failed: ${response.status} ${response.statusText}`);
        }
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body');
        }
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim());
            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (data.response) {
                        yield data.response;
                    }
                }
                catch {
                    // Skip invalid JSON lines
                }
            }
        }
    }
    /**
     * Chat completion using Ollama
     */
    async *chat(request) {
        const response = await fetch(`${this.config.baseURL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: request.model,
                messages: request.messages,
                stream: true,
                tools: request.tools,
                options: request.options,
            }),
        });
        if (!response.ok) {
            throw new Error(`Chat failed: ${response.status} ${response.statusText}`);
        }
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body');
        }
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim());
            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (data.message?.content) {
                        yield data.message.content;
                    }
                }
                catch {
                    // Skip invalid JSON lines
                }
            }
        }
    }
    /**
     * Check if Ollama server is available
     */
    async isAvailable() {
        try {
            const response = await fetch(`${this.config.baseURL}/api/tags`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000),
            });
            return response.ok;
        }
        catch {
            return false;
        }
    }
}
// Re-export types
export * from '../../harness/types';
