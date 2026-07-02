/**
 * Allternit Mock Provider
 *
 * Deterministic echo provider for tests and offline demos.
 * Repeats the last user message back so outputs are reproducible
 * and no external API key is required.
 */
export class AllternitMock {
    options;
    constructor(options = {}) {
        this.options = options;
    }
    resolveContent(messages) {
        if (this.options.mockResponse)
            return this.options.mockResponse;
        const lastUser = [...messages].reverse().find((m) => m.role === 'user');
        return lastUser?.content ?? 'Mock response';
    }
    async chat(options) {
        if (this.options.responseDelay) {
            await new Promise((resolve) => setTimeout(resolve, this.options.responseDelay));
        }
        const content = this.resolveContent(options.messages);
        return {
            id: `mock_${Date.now()}`,
            model: 'mock-echo',
            content,
            usage: {
                input_tokens: options.messages.reduce((sum, m) => sum + m.content.length, 0),
                output_tokens: content.length,
            },
        };
    }
    async *chatStream(options) {
        const content = this.resolveContent(options.messages);
        const chunkSize = 4;
        for (let i = 0; i < content.length; i += chunkSize) {
            if (this.options.responseDelay) {
                await new Promise((resolve) => setTimeout(resolve, this.options.responseDelay));
            }
            yield {
                id: `mock_${Date.now()}`,
                model: 'mock-echo',
                content: content.slice(i, i + chunkSize),
                usage: {
                    input_tokens: i === 0
                        ? options.messages.reduce((sum, m) => sum + m.content.length, 0)
                        : 0,
                    output_tokens: Math.min(chunkSize, content.length - i),
                },
            };
        }
    }
    async listModels() {
        return [
            { id: 'mock-gpt', name: 'Mock GPT' },
            { id: 'mock-claude', name: 'Mock Claude' },
            { id: 'mock-local', name: 'Mock Local' },
        ];
    }
}
//# sourceMappingURL=index.js.map