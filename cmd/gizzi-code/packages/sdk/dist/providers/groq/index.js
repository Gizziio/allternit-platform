/**
 * Allternit Groq Provider
 *
 * Groq API client for Allternit SDK
 * API: https://api.groq.com/openai/v1 (OpenAI-compatible)
 */
import { HarnessError, HarnessErrorCode } from '../../harness/errors.js';
export class AllternitGroq {
    apiKey;
    baseURL;
    constructor(options) {
        this.apiKey = options.apiKey;
        this.baseURL = options.baseURL || 'https://api.groq.com/openai/v1';
    }
    async complete(options) {
        const response = await fetch(`${this.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(options),
        });
        if (!response.ok) {
            throw new HarnessError(`Groq API error: ${response.status} ${response.statusText}`, HarnessErrorCode.PROVIDER_NOT_FOUND);
        }
        return response.json();
    }
    async *stream(options) {
        const response = await fetch(`${this.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ...options, stream: true }),
        });
        if (!response.ok) {
            throw new HarnessError(`Groq API error: ${response.status} ${response.statusText}`, HarnessErrorCode.PROVIDER_NOT_FOUND);
        }
        const reader = response.body?.getReader();
        if (!reader)
            throw new HarnessError('No response body', HarnessErrorCode.STREAM_ERROR);
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
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]')
                        return;
                    try {
                        yield JSON.parse(data);
                    }
                    catch { }
                }
            }
        }
    }
}
export default AllternitGroq;
//# sourceMappingURL=index.js.map