/**
 * Allternit Cohere Provider
 *
 * Cohere API client for Allternit SDK
 * API: https://api.cohere.com/v1
 */
export interface AllternitCohereOptions {
    apiKey: string;
    baseURL?: string;
}
export interface CohereMessage {
    role: 'SYSTEM' | 'USER' | 'CHATBOT';
    message: string;
}
export interface CohereTool {
    name: string;
    description: string;
    parameterDefinitions?: Record<string, {
        description?: string;
        type: string;
        required?: boolean;
    }>;
}
export interface CohereChatOptions {
    model: string;
    message: string;
    chatHistory?: CohereMessage[];
    preamble?: string;
    temperature?: number;
    maxTokens?: number;
    k?: number;
    p?: number;
    seed?: number;
    stream?: boolean;
    tools?: CohereTool[];
    forceSingleStep?: boolean;
}
export interface CohereChatResponse {
    response_id: string;
    text: string;
    generation_id: string;
    chat_history: CohereMessage[];
    finish_reason: string;
    meta: {
        api_version: {
            version: string;
        };
        billed_units: {
            input_tokens: number;
            output_tokens: number;
        };
        tokens: {
            input_tokens: number;
            output_tokens: number;
        };
    };
    tool_calls?: Array<{
        name: string;
        parameters: Record<string, unknown>;
    }>;
}
export interface CohereStreamChunk {
    text?: string;
    tool_calls?: Array<{
        name: string;
        parameters: Record<string, unknown>;
    }>;
    finish_reason?: string;
    is_finished?: boolean;
    response?: {
        response_id?: string;
        text?: string;
        tool_calls?: Array<{
            name: string;
            parameters: Record<string, unknown>;
        }>;
    };
}
export declare const COHERE_MODELS: {
    readonly COMMAND: "command";
    readonly COMMAND_LIGHT: "command-light";
    readonly COMMAND_R: "command-r";
    readonly COMMAND_R_PLUS: "command-r-plus";
};
export declare class AllternitCohere {
    private apiKey;
    private baseURL;
    constructor(options: AllternitCohereOptions);
    chat(options: CohereChatOptions): Promise<CohereChatResponse>;
    chatStream(options: CohereChatOptions): AsyncGenerator<CohereStreamChunk>;
    listModels(): Promise<string[]>;
}
export default AllternitCohere;
//# sourceMappingURL=index.d.ts.map