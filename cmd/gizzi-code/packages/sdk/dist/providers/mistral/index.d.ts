/**
 * Allternit Mistral Provider
 *
 * Mistral AI API client for Allternit SDK
 * API: https://api.mistral.ai/v1
 */
export interface AllternitMistralOptions {
    apiKey: string;
    baseURL?: string;
}
export interface MistralMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
}
export interface MistralCompletionOptions {
    model: string;
    messages: MistralMessage[];
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    stream?: boolean;
}
export declare class AllternitMistral {
    private apiKey;
    private baseURL;
    constructor(options: AllternitMistralOptions);
    complete(options: MistralCompletionOptions): Promise<any>;
    stream(options: MistralCompletionOptions): AsyncGenerator<any>;
}
export default AllternitMistral;
//# sourceMappingURL=index.d.ts.map