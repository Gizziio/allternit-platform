import type {
  ActivateDeferredToolsRequest,
  ActivateDeferredToolsResponse,
  AgentChatCompletionRequest,
  AgentChatCompletionResponse,
  AgentResponsesRequest,
  AgentResponsesResponse,
  DeferredToolList,
  RemoteAgentModel,
  RemoteAgentModelList,
  SearchDeferredToolsRequest,
} from "./types.js";

export interface RemoteAgentsClientOptions {
  baseUrl: string;
  apiKey?: string;
  fetch?: typeof globalThis.fetch;
}

export class RemoteAgentsClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(options: RemoteAgentsClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "application/json");

    if (this.apiKey && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${this.apiKey}`);
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      throw new Error(`Remote agents request failed: HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  async listModels(): Promise<RemoteAgentModelList> {
    return this.request<RemoteAgentModelList>("/api/agents/v1/models", {
      method: "GET",
    });
  }

  async getModel(model: string): Promise<RemoteAgentModel> {
    return this.request<RemoteAgentModel>(`/api/agents/v1/models/${encodeURIComponent(model)}`, {
      method: "GET",
    });
  }

  async createChatCompletion(
    request: AgentChatCompletionRequest,
  ): Promise<AgentChatCompletionResponse> {
    return this.request<AgentChatCompletionResponse>(
      "/api/agents/v1/chat/completions",
      {
        method: "POST",
        body: JSON.stringify(request),
      },
    );
  }

  async createResponse(
    request: AgentResponsesRequest,
  ): Promise<AgentResponsesResponse> {
    return this.request<AgentResponsesResponse>("/api/agents/v1/responses", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async listResponseModels(): Promise<RemoteAgentModelList> {
    return this.request<RemoteAgentModelList>("/api/agents/v1/responses/models", {
      method: "GET",
    });
  }

  async getResponse(responseId: string): Promise<AgentResponsesResponse> {
    return this.request<AgentResponsesResponse>(
      `/api/agents/v1/responses/${encodeURIComponent(responseId)}`,
      {
        method: "GET",
      },
    );
  }

  async listDeferredTools(model: string): Promise<DeferredToolList> {
    const params = new URLSearchParams({ model });
    return this.request<DeferredToolList>(
      `/api/agents/v1/tools?${params.toString()}`,
      {
        method: "GET",
      },
    );
  }

  async searchDeferredTools(
    request: SearchDeferredToolsRequest,
  ): Promise<DeferredToolList> {
    return this.request<DeferredToolList>("/api/agents/v1/tools/search", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async activateDeferredTools(
    request: ActivateDeferredToolsRequest,
  ): Promise<ActivateDeferredToolsResponse> {
    return this.request<ActivateDeferredToolsResponse>(
      "/api/agents/v1/tools/activate",
      {
        method: "POST",
        body: JSON.stringify(request),
      },
    );
  }
}
