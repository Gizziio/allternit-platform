/**
 * @allternit/sdk/computer-use - Computer Use Engine Client
 */
export const COMPUTER_USE_CONTRACT_VERSION = "1.0.0-alpha.1";
export class AllternitComputerUseClient {
    baseUrl;
    fetch;
    headers;
    constructor(config = {}) {
        this.baseUrl = resolveComputerUseBaseUrl(config.baseUrl);
        this.fetch = config.fetch || globalThis.fetch;
        this.headers = config.headers || {};
    }
    async execute(request) {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/execute`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...this.headers,
            },
            body: JSON.stringify(request),
        });
        if (!response.ok) {
            throw new Error(`Computer use execution failed: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
    async executeStream(request) {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/execute?stream=true`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...this.headers },
            body: JSON.stringify(request),
        });
        if (!response.ok)
            throw new Error(`Computer use stream failed: ${response.status} ${response.statusText}`);
        return response;
    }
    /** Compatibility-only atomic action transport for products migrating to canonical transactions. */
    async executeCompatibilityAction(request) {
        const response = await this.fetch(`${this.baseUrl}/v1/computer`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...this.headers },
            body: JSON.stringify({
                ...request,
                run_id: request.run_id ?? `sdk-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
                parameters: request.parameters ?? {},
            }),
        });
        if (!response.ok)
            throw new Error(`Compatibility action failed: ${response.status} ${response.statusText}`);
        return response.json();
    }
    /** Compatibility-only physical browser session creation; logical ownership remains canonical. */
    async createCompatibilitySession() {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/sessions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...this.headers },
        });
        if (!response.ok)
            throw new Error(`Compatibility session creation failed: ${response.status} ${response.statusText}`);
        return response.json();
    }
    async listCanonicalProviders() {
        return (await this.getCanonicalProviderCatalog()).providers;
    }
    async getCanonicalProviderCatalog() {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical/providers`, {
            method: "GET",
            headers: this.headers,
        });
        if (!response.ok)
            throw new Error(`Provider discovery failed: ${response.status} ${response.statusText}`);
        return response.json();
    }
    async observeCanonical(request) {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical/observe`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...this.headers },
            body: JSON.stringify(request),
        });
        if (!response.ok)
            throw new Error(`Canonical observation failed: ${response.status} ${response.statusText}`);
        return response.json();
    }
    async findCanonicalRoots(request) {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical/roots`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...this.headers },
            body: JSON.stringify(request),
        });
        if (!response.ok)
            throw new Error(`Canonical root discovery failed: ${response.status} ${response.statusText}`);
        return response.json();
    }
    async executeCanonicalTransaction(transaction, providerId = "browser.playwright.canonical") {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical/transactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...this.headers },
            body: JSON.stringify({ provider_id: providerId, transaction }),
        });
        if (!response.ok)
            throw new Error(`Canonical transaction failed: ${response.status} ${response.statusText}`);
        return response.json();
    }
    async approveCanonicalTransaction(transaction, approvedBy, ttlSeconds = 120) {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical/approvals`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...this.headers },
            body: JSON.stringify({ transaction, approved_by: approvedBy, ttl_seconds: ttlSeconds }),
        });
        if (!response.ok)
            throw new Error(`Canonical approval failed: ${response.status} ${response.statusText}`);
        return response.json();
    }
    async getCanonicalEvents(sessionId, afterSequence = 0) {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical/sessions/${encodeURIComponent(sessionId)}/events?after_sequence=${afterSequence}`, { method: "GET", headers: this.headers });
        if (!response.ok)
            throw new Error(`Canonical event query failed: ${response.status} ${response.statusText}`);
        return response.json();
    }
    async listCanonicalEnvironmentProviders() {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical/environment-providers`, {
            method: "GET", headers: this.headers,
        });
        if (!response.ok)
            throw new Error(`Environment provider discovery failed: ${response.status} ${response.statusText}`);
        return (await response.json()).providers;
    }
    async createCanonicalEnvironment(request) {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical/environments`, {
            method: "POST", headers: { "Content-Type": "application/json", ...this.headers }, body: JSON.stringify(request),
        });
        if (!response.ok)
            throw new Error(`Environment creation failed: ${response.status} ${response.statusText}`);
        return response.json();
    }
    async approveCanonicalEnvironmentOperation(request) {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical/operation-approvals`, {
            method: "POST", headers: { "Content-Type": "application/json", ...this.headers }, body: JSON.stringify(request),
        });
        if (!response.ok)
            throw new Error(`Operation approval failed: ${response.status} ${response.statusText}`);
        return response.json();
    }
    async provisionCanonicalEnvironment(environmentId, control) {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical/environments/${encodeURIComponent(environmentId)}/provision`, { method: "POST", headers: { "Content-Type": "application/json", ...this.headers }, body: JSON.stringify(control) });
        if (!response.ok)
            throw new Error(`Environment provisioning failed: ${response.status} ${response.statusText}`);
        return response.json();
    }
    async stopCanonicalEnvironment(environmentId, control) {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical/environments/${encodeURIComponent(environmentId)}/stop`, { method: "POST", headers: { "Content-Type": "application/json", ...this.headers }, body: JSON.stringify(control) });
        if (!response.ok)
            throw new Error(`Environment stop failed: ${response.status} ${response.statusText}`);
        return response.json();
    }
    async acquireCanonicalEnvironmentLease(environmentId, holderId, kind, ttlSeconds = 300) {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical/environments/${encodeURIComponent(environmentId)}/leases`, {
            method: "POST", headers: { "Content-Type": "application/json", ...this.headers },
            body: JSON.stringify({ holder_id: holderId, kind, ttl_seconds: ttlSeconds }),
        });
        if (!response.ok)
            throw new Error(`Environment lease failed: ${response.status} ${response.statusText}`);
        return response.json();
    }
    async getCanonicalTrajectory(sessionId) {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical/sessions/${encodeURIComponent(sessionId)}/trajectory`, { method: "GET", headers: this.headers });
        if (!response.ok)
            throw new Error(`Canonical trajectory failed: ${response.status} ${response.statusText}`);
        return response.json();
    }
    async canonicalPost(path, body) {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical${path}`, {
            method: "POST", headers: { "Content-Type": "application/json", ...this.headers }, body: JSON.stringify(body),
        });
        if (!response.ok)
            throw new Error(`Canonical operation failed: ${response.status} ${response.statusText}`);
        return response.json();
    }
    async releaseCanonicalEnvironmentLease(leaseId, holderId) {
        return this.canonicalPost(`/leases/${encodeURIComponent(leaseId)}/release`, { holder_id: holderId });
    }
    async executeCanonicalEnvironmentCommand(environmentId, request) {
        return this.canonicalPost(`/environments/${encodeURIComponent(environmentId)}/exec`, request);
    }
    async readCanonicalEnvironmentFile(environmentId, request) {
        return this.canonicalPost(`/environments/${encodeURIComponent(environmentId)}/files/read`, request);
    }
    async writeCanonicalEnvironmentFile(environmentId, request) {
        return this.canonicalPost(`/environments/${encodeURIComponent(environmentId)}/files/write`, request);
    }
    async canonicalEnvironmentClipboard(environmentId, request) {
        return this.canonicalPost(`/environments/${encodeURIComponent(environmentId)}/clipboard`, request);
    }
    async executeCanonicalMobileAction(environmentId, request) {
        return this.canonicalPost(`/environments/${encodeURIComponent(environmentId)}/mobile/actions`, request);
    }
    async watch(options) {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/runs/${options.runId}/events`, {
            method: "GET",
            headers: this.headers,
            signal: options.signal,
        });
        if (!response.ok) {
            throw new Error(`Watch failed: ${response.status} ${response.statusText}`);
        }
        return response;
    }
    async getReceipts(runId) {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/runs/${runId}`, {
            method: "GET",
            headers: this.headers,
        });
        if (!response.ok) {
            throw new Error(`Get receipts failed: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
    async getSnapshot(runId) {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/runs/${runId}`, {
            method: "GET",
            headers: this.headers,
        });
        if (!response.ok) {
            throw new Error(`Get snapshot failed: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
    async approveRun(runId, options = {}) {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/runs/${runId}/approve`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...this.headers,
            },
            body: JSON.stringify({
                decision: "approve",
                ...options,
            }),
        });
        if (!response.ok) {
            throw new Error(`Approve run failed: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
    async denyRun(runId, options = {}) {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/runs/${runId}/approve`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...this.headers,
            },
            body: JSON.stringify({
                decision: "deny",
                ...options,
            }),
        });
        if (!response.ok) {
            throw new Error(`Deny run failed: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
    async cancelRun(runId, options = {}) {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/runs/${runId}/cancel`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...this.headers,
            },
            body: JSON.stringify(options),
        });
        if (!response.ok) {
            throw new Error(`Cancel run failed: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
    async captureRunScreenshot(runId) {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/runs/${encodeURIComponent(runId)}/screenshot`, {
            method: "POST", headers: this.headers,
        });
        if (!response.ok)
            throw new Error(`Screenshot failed: ${response.status} ${response.statusText}`);
        return response.json();
    }
    async pauseRun(runId, options = {}) {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/runs/${runId}/pause`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...this.headers,
            },
            body: JSON.stringify(options),
        });
        if (!response.ok) {
            throw new Error(`Pause run failed: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
    async resumeRun(runId, options = {}) {
        const response = await this.fetch(`${this.baseUrl}/v1/computer-use/runs/${runId}/resume`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...this.headers,
            },
            body: JSON.stringify(options),
        });
        if (!response.ok) {
            throw new Error(`Resume run failed: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
    async *watchRun(runId, options = {}) {
        const { intervalMs = 1000, signal } = options;
        let nextIndex = 0;
        while (!signal?.aborted) {
            const response = await this.fetch(`${this.baseUrl}/v1/computer-use/runs/${runId}/events?after_index=${nextIndex}`, {
                method: "GET",
                headers: this.headers,
                signal,
            });
            if (!response.ok) {
                throw new Error(`Watch run failed: ${response.status} ${response.statusText}`);
            }
            const batch = await response.json();
            yield batch;
            if (batch.completed)
                break;
            nextIndex = batch.next_index ?? nextIndex + 1;
            if (intervalMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, intervalMs));
            }
        }
    }
    async waitForRun(runId, options = {}) {
        const { intervalMs = 1000, signal } = options;
        while (!signal?.aborted) {
            const snapshot = await this.getSnapshot(runId);
            if (snapshot.status === "needs_approval" ||
                snapshot.status === "paused" ||
                snapshot.status === "completed" ||
                snapshot.status === "failed" ||
                snapshot.status === "cancelled") {
                return snapshot;
            }
            if (intervalMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, intervalMs));
            }
        }
        throw new Error("Wait for run was aborted");
    }
}
export function createComputerUseClient(config) {
    return new AllternitComputerUseClient(config);
}
export function resolveComputerUseBaseUrl(url) {
    if (!url) {
        return (process.env.ALLTERNIT_BASE_URL || process.env.GIZZI_SERVER_URL || "http://localhost:4096").replace(/\/+$/g, "");
    }
    return String(url).replace(/\/+$/g, "");
}
