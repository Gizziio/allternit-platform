export class RemoteAgentsClient {
    baseUrl;
    apiKey;
    fetchImpl;
    constructor(options) {
        this.baseUrl = options.baseUrl.replace(/\/+$/, "");
        this.apiKey = options.apiKey;
        this.fetchImpl = options.fetch ?? globalThis.fetch;
    }
    async request(path, init) {
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
        return response.json();
    }
    async listModels() {
        return this.request("/api/agents/v1/models", {
            method: "GET",
        });
    }
    async getModel(model) {
        return this.request(`/api/agents/v1/models/${encodeURIComponent(model)}`, {
            method: "GET",
        });
    }
    async createChatCompletion(request) {
        return this.request("/api/agents/v1/chat/completions", {
            method: "POST",
            body: JSON.stringify(request),
        });
    }
    async createResponse(request) {
        return this.request("/api/agents/v1/responses", {
            method: "POST",
            body: JSON.stringify(request),
        });
    }
    async listResponseModels() {
        return this.request("/api/agents/v1/responses/models", {
            method: "GET",
        });
    }
    async getResponse(responseId) {
        return this.request(`/api/agents/v1/responses/${encodeURIComponent(responseId)}`, {
            method: "GET",
        });
    }
    async listDeferredTools(model) {
        const params = new URLSearchParams({ model });
        return this.request(`/api/agents/v1/tools?${params.toString()}`, {
            method: "GET",
        });
    }
    async searchDeferredTools(request) {
        return this.request("/api/agents/v1/tools/search", {
            method: "POST",
            body: JSON.stringify(request),
        });
    }
    async activateDeferredTools(request) {
        return this.request("/api/agents/v1/tools/activate", {
            method: "POST",
            body: JSON.stringify(request),
        });
    }
}
