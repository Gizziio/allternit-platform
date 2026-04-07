/**
 * Allternit GitHub Copilot Provider
 *
 * GitHub Copilot API client for Allternit SDK
 * Uses GitHub's Copilot API or Copilot Chat API
 * Docs: https://docs.github.com/en/copilot
 *
 * Note: GitHub Copilot API access requires special authorization
 * This implementation supports both the Copilot API and Copilot Chat integration
 */
export interface AllternitCopilotOptions {
    token: string;
    baseURL?: string;
    githubApiURL?: string;
}
export interface CopilotMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface CopilotChatOptions {
    messages: CopilotMessage[];
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stream?: boolean;
    model?: string;
}
export interface CopilotChatResponse {
    id: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: CopilotMessage;
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
export interface CopilotStreamChunk {
    id: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        delta: Partial<CopilotMessage>;
        finish_reason: string | null;
    }>;
}
export declare const COPILOT_MODELS: {
    readonly GPT_4: "gpt-4";
    readonly GPT_4_TURBO: "gpt-4-turbo";
    readonly COPILOT_CHAT: "copilot-chat";
};
export declare class AllternitCopilot {
    private token;
    private baseURL;
    private githubApiURL;
    constructor(options: AllternitCopilotOptions);
    /**
     * Get Copilot token from GitHub
     * This exchanges a GitHub token for a Copilot-specific token
     */
    getCopilotToken(): Promise<string>;
    chat(options: CopilotChatOptions): Promise<CopilotChatResponse>;
    chatStream(options: CopilotChatOptions): AsyncGenerator<CopilotStreamChunk>;
    listModels(): Promise<Array<{
        id: string;
        name: string;
    }>>;
    /**
     * Check if Copilot is available for the authenticated user
     */
    checkAccess(): Promise<{
        hasAccess: boolean;
        seatType?: string;
    }>;
}
export { AllternitCopilot as AllternitGitHubCopilot };
export default AllternitCopilot;
//# sourceMappingURL=index.d.ts.map