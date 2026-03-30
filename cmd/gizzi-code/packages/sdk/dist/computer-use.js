// packages/sdk/js/src/computer-use.ts
class A2RComputerUseClient {
  baseUrl;
  fetch;
  headers;
  constructor(config = {}) {
    this.baseUrl = resolveComputerUseBaseUrl(config.baseUrl);
    this.fetch = config.fetch || globalThis.fetch;
    this.headers = config.headers || {};
  }
  async execute(request) {
    const response = await this.fetch(`${this.baseUrl}/v1/engine/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers
      },
      body: JSON.stringify(request)
    });
    if (!response.ok) {
      throw new Error(`Computer use execution failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
  async watch(options) {
    const response = await this.fetch(`${this.baseUrl}/v1/engine/watch/${options.runId}`, {
      method: "GET",
      headers: this.headers,
      signal: options.signal
    });
    if (!response.ok) {
      throw new Error(`Watch failed: ${response.status} ${response.statusText}`);
    }
    return response;
  }
  async getReceipts(runId) {
    const response = await this.fetch(`${this.baseUrl}/v1/engine/receipts/${runId}`, {
      method: "GET",
      headers: this.headers
    });
    if (!response.ok) {
      throw new Error(`Get receipts failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
  async getSnapshot(runId) {
    const response = await this.fetch(`${this.baseUrl}/v1/engine/snapshot/${runId}`, {
      method: "GET",
      headers: this.headers
    });
    if (!response.ok) {
      throw new Error(`Get snapshot failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
  async approveRun(runId, options = {}) {
    const response = await this.fetch(`${this.baseUrl}/v1/engine/runs/${runId}/approval`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers
      },
      body: JSON.stringify({
        decision: "approve",
        ...options
      })
    });
    if (!response.ok) {
      throw new Error(`Approve run failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
  async denyRun(runId, options = {}) {
    const response = await this.fetch(`${this.baseUrl}/v1/engine/runs/${runId}/approval`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers
      },
      body: JSON.stringify({
        decision: "deny",
        ...options
      })
    });
    if (!response.ok) {
      throw new Error(`Deny run failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
  async cancelRun(runId, options = {}) {
    const response = await this.fetch(`${this.baseUrl}/v1/engine/runs/${runId}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers
      },
      body: JSON.stringify(options)
    });
    if (!response.ok) {
      throw new Error(`Cancel run failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
  async pauseRun(runId, options = {}) {
    const response = await this.fetch(`${this.baseUrl}/v1/engine/runs/${runId}/pause`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers
      },
      body: JSON.stringify(options)
    });
    if (!response.ok) {
      throw new Error(`Pause run failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
  async resumeRun(runId, options = {}) {
    const response = await this.fetch(`${this.baseUrl}/v1/engine/runs/${runId}/resume`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers
      },
      body: JSON.stringify(options)
    });
    if (!response.ok) {
      throw new Error(`Resume run failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
  async* watchRun(runId, options = {}) {
    const { intervalMs = 1000, signal } = options;
    let nextIndex = 0;
    while (!signal?.aborted) {
      const response = await this.fetch(`${this.baseUrl}/v1/engine/runs/${runId}/events?next_index=${nextIndex}`, {
        method: "GET",
        headers: this.headers,
        signal
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
      if (snapshot.status === "needs_approval" || snapshot.status === "paused" || snapshot.status === "completed" || snapshot.status === "failed" || snapshot.status === "cancelled") {
        return snapshot;
      }
      if (intervalMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }
    throw new Error("Wait for run was aborted");
  }
}
function createComputerUseClient(config) {
  return new A2RComputerUseClient(config);
}
function resolveComputerUseBaseUrl(url) {
  if (!url) {
    return (process.env.A2R_BASE_URL || process.env.GIZZI_SERVER_URL || "http://localhost:4096").replace(/\/+$/g, "");
  }
  return String(url).replace(/\/+$/g, "");
}
export {
  resolveComputerUseBaseUrl,
  createComputerUseClient,
  A2RComputerUseClient
};
