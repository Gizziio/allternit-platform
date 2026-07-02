/**
 * Allternit Groq Provider
 *
 * Groq API client for Allternit SDK
 * API: https://api.groq.com/openai/v1 (OpenAI-compatible)
 */
export interface AllternitGroqOptions {
    apiKey: string;
    baseURL?: string;
}
export interface GroqMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
    tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
            name: string;
            arguments: string;
        };
    }>;
}
export interface GroqCompletionOptions {
    model: string;
    messages: GroqMessage[];
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    stream?: boolean;
    tools?: Array<{
        type: 'function';
        function: {
            name: string;
            description?: string;
            parameters: Record<string, any>;
        };
    }>;
}
export declare class AllternitGroq {
    private apiKey;
    private baseURL;
    constructor(options: AllternitGroqOptions);
    complete(options: GroqCompletionOptions): Promise<any>;
    stream(options: GroqCompletionOptions): AsyncGenerator<any>;
}
export default AllternitGroq;
//# sourceMappingURL=index.d.ts.map