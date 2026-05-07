import type { ActivateDeferredToolsRequest, ActivateDeferredToolsResponse, AgentChatCompletionRequest, AgentChatCompletionResponse, AgentResponsesRequest, AgentResponsesResponse, DeferredToolList, RemoteAgentModel, RemoteAgentModelList, SearchDeferredToolsRequest } from "./types.js";
export interface RemoteAgentsClientOptions {
    baseUrl: string;
    apiKey?: string;
    fetch?: typeof globalThis.fetch;
}
export declare class RemoteAgentsClient {
    private readonly baseUrl;
    private readonly apiKey?;
    private readonly fetchImpl;
    constructor(options: RemoteAgentsClientOptions);
    private request;
    listModels(): Promise<RemoteAgentModelList>;
    getModel(model: string): Promise<RemoteAgentModel>;
    createChatCompletion(request: AgentChatCompletionRequest): Promise<AgentChatCompletionResponse>;
    createResponse(request: AgentResponsesRequest): Promise<AgentResponsesResponse>;
    listResponseModels(): Promise<RemoteAgentModelList>;
    getResponse(responseId: string): Promise<AgentResponsesResponse>;
    listDeferredTools(model: string): Promise<DeferredToolList>;
    searchDeferredTools(request: SearchDeferredToolsRequest): Promise<DeferredToolList>;
    activateDeferredTools(request: ActivateDeferredToolsRequest): Promise<ActivateDeferredToolsResponse>;
}
