/**
 * Allternit Mock Provider
 *
 * Deterministic echo provider for tests and offline demos.
 * Repeats the last user message back so outputs are reproducible
 * and no external API key is required.
 */
export interface AllternitMockOptions {
    /** Artificial response delay in milliseconds. */
    responseDelay?: number;
    /** Whether chatStream should yield tokens or a single response. */
    shouldStream?: boolean;
    /** Optional fixed response text (defaults to echoing the last user message). */
    mockResponse?: string;
}
export interface MockMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface MockChatOptions {
    messages: MockMessage[];
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
}
export interface MockChatResponse {
    id: string;
    model: string;
    content: string;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}
export declare class AllternitMock {
    private options;
    constructor(options?: AllternitMockOptions);
    private resolveContent;
    chat(options: MockChatOptions): Promise<MockChatResponse>;
    chatStream(options: MockChatOptions): AsyncGenerator<MockChatResponse>;
    listModels(): Promise<Array<{
        id: string;
        name: string;
    }>>;
}
//# sourceMappingURL=index.d.ts.map