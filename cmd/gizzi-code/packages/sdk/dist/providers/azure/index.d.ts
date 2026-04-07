/**
 * Allternit Azure OpenAI Provider
 *
 * Azure OpenAI API client for Allternit SDK
 * API: https://{resource}.openai.azure.com/openai/deployments/{deployment}
 */
export interface AllternitAzureOptions {
    apiKey: string;
    resourceName: string;
    deploymentName: string;
    apiVersion?: string;
    baseURL?: string;
}
export interface AzureMessage {
    role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
    content: string;
    name?: string;
    function_call?: {
        name: string;
        arguments: string;
    };
}
export interface AzureFunction {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}
export interface AzureChatOptions {
    messages: AzureMessage[];
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stop?: string | string[];
    stream?: boolean;
    functions?: AzureFunction[];
    functionCall?: 'auto' | 'none' | {
        name: string;
    };
    tools?: Array<{
        type: 'function';
        function: AzureFunction;
    }>;
    toolChoice?: 'auto' | 'none' | {
        type: 'function';
        function: {
            name: string;
        };
    };
    seed?: number;
}
export interface AzureChatResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: AzureMessage;
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
export interface AzureStreamChunk {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        delta: Partial<AzureMessage>;
        finish_reason: string | null;
    }>;
}
export declare class AllternitAzureOpenAI {
    private apiKey;
    private baseURL;
    private apiVersion;
    constructor(options: AllternitAzureOptions);
    chat(options: AzureChatOptions): Promise<AzureChatResponse>;
    chatStream(options: AzureChatOptions): AsyncGenerator<AzureStreamChunk>;
    listModels(): Promise<Array<{
        id: string;
        object: string;
        created: number;
        owned_by: string;
    }>>;
}
export { AllternitAzureOpenAI as AllternitAzure };
export default AllternitAzureOpenAI;
//# sourceMappingURL=index.d.ts.map