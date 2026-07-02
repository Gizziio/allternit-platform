/**
 * Allternit Kimi (Moonshot AI) Provider
 *
 * Moonshot AI API client for Allternit SDK
 * API: https://api.moonshot.cn/v1
 */
export interface AllternitKimiOptions {
    apiKey: string;
    baseURL?: string;
}
export interface KimiMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
}
export interface KimiCompletionOptions {
    model: string;
    messages: KimiMessage[];
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    stream?: boolean;
}
export declare class AllternitKimi {
    private apiKey;
    private baseURL;
    constructor(options: AllternitKimiOptions);
    complete(options: KimiCompletionOptions): Promise<any>;
    stream(options: KimiCompletionOptions): AsyncGenerator<any>;
}
export default AllternitKimi;
//# sourceMappingURL=index.d.ts.map