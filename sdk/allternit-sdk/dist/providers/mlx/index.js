/**
 * AllternitMLX Provider
 * Apple MLX local inference adapter for the Allternit harness.
 * Communicates with an MLX serving process (e.g. mlx_lm.server)
 * that exposes an OpenAI-compatible HTTP API on localhost.
 */
export class AllternitMLX {
    config;
    constructor(config) {
        this.config = {
            baseURL: config.baseURL.replace(/\/$/, ''),
            defaultModel: config.defaultModel || 'default',
            timeout: config.timeout ?? 120_000,
        };
    }
    async listModels() {
        const response = await fetch(`${this.config.baseURL}/v1/models`, {
            signal: AbortSignal.timeout(this.config.timeout),
        });
        if (!response.ok) {
            throw new Error(`MLX model listing failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return (data.data || []);
    }
    async *chat(request) {
        const response = await fetch(`${this.config.baseURL}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: request.model || this.config.defaultModel,
                messages: request.messages,
                stream: true,
                temperature: request.temperature,
                top_p: request.top_p,
                max_tokens: request.max_tokens,
                tools: request.tools,
                stop: request.stop,
            }),
            signal: AbortSignal.timeout(this.config.timeout),
        });
        if (!response.ok) {
            throw new Error(`MLX chat failed: ${response.status} ${response.statusText}`);
        }
        yield* this.readStream(response);
    }
    async *generate(request) {
        const response = await fetch(`${this.config.baseURL}/v1/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: request.model || this.config.defaultModel,
                prompt: request.prompt,
                stream: true,
                temperature: request.temperature,
                top_p: request.top_p,
                max_tokens: request.max_tokens,
                stop: request.stop,
            }),
            signal: AbortSignal.timeout(this.config.timeout),
        });
        if (!response.ok) {
            throw new Error(`MLX completion failed: ${response.status} ${response.statusText}`);
        }
        yield* this.readStream(response);
    }
    async isAvailable() {
        try {
            const response = await fetch(`${this.config.baseURL}/v1/models`, {
                signal: AbortSignal.timeout(5000),
            });
            return response.ok;
        }
        catch {
            return false;
        }
    }
    async *readStream(response) {
        const reader = response.body?.getReader();
        if (!reader)
            throw new Error('No response body');
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
                if (!trimmed || !trimmed.startsWith('data: '))
                    continue;
                const payload = trimmed.slice(6);
                if (payload === '[DONE]')
                    return;
                try {
                    const parsed = JSON.parse(payload);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content)
                        yield content;
                }
                catch {
                    // skip malformed SSE lines
                }
            }
        }
    }
}
export * from '../../harness/types';
