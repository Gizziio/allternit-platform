/**
 * Allternit Runtime SDK
 *
 * Thin client for the Allternit runtime API. Talks to the self-hosted platform
 * API by default; in local-dev mode it can talk directly to a gizzi-code
 * runtime over HTTP(S).
 */
export class RuntimeClient {
    baseUrl;
    getToken;
    direct;
    constructor(options) {
        this.baseUrl = options.baseUrl.replace(/\/$/, "");
        this.getToken = options.getToken;
        this.direct = options.direct ?? false;
    }
    prefix() {
        return this.direct ? `${this.baseUrl}/v1/runtime` : `${this.baseUrl}/api/v1/runtime`;
    }
    async authHeaders() {
        const headers = { "Content-Type": "application/json" };
        const token = this.getToken ? await this.getToken() : undefined;
        if (token)
            headers["X-Runtime-Token"] = token;
        return headers;
    }
    async request(path, init = {}) {
        const url = `${this.prefix()}${path}`;
        const headers = await this.authHeaders();
        return fetch(url, {
            ...init,
            headers: { ...headers, ...(init.headers ?? {}) },
        });
    }
    async listRuntimes() {
        const res = await this.request("/");
        if (!res.ok)
            throw new RuntimeApiError("Failed to list runtimes", res.status, await res.text());
        return res.json();
    }
    async getRuntime(id) {
        const res = await this.request(`/${encodeURIComponent(id)}`);
        if (!res.ok)
            throw new RuntimeApiError(`Failed to get runtime ${id}`, res.status, await res.text());
        return res.json();
    }
    async deleteRuntime(id) {
        const res = await this.request(`/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok)
            throw new RuntimeApiError(`Failed to delete runtime ${id}`, res.status, await res.text());
        return res.json();
    }
    async heartbeat(id) {
        const res = await this.request(`/${encodeURIComponent(id)}/heartbeat`, { method: "POST" });
        if (!res.ok)
            throw new RuntimeApiError(`Failed to heartbeat runtime ${id}`, res.status, await res.text());
        return res.json();
    }
    async listLogs(id, limit) {
        const query = limit !== undefined ? `?limit=${limit}` : "";
        const res = await this.request(`/${encodeURIComponent(id)}/logs${query}`);
        if (!res.ok)
            throw new RuntimeApiError(`Failed to list logs for ${id}`, res.status, await res.text());
        return res.json();
    }
    async assignTask(runtimeId, cliName, task) {
        const body = { cliName, ...task };
        const res = await this.request(`/${encodeURIComponent(runtimeId)}/tasks`, {
            method: "POST",
            body: JSON.stringify(body),
        });
        if (!res.ok)
            throw new RuntimeApiError(`Failed to assign task`, res.status, await res.text());
        return res.json();
    }
    async abortTask(runtimeId, taskId) {
        const res = await this.request(`/${encodeURIComponent(runtimeId)}/tasks/${encodeURIComponent(taskId)}/abort`, { method: "POST" });
        if (!res.ok)
            throw new RuntimeApiError(`Failed to abort task`, res.status, await res.text());
        return res.json();
    }
    async inspectTask(runtimeId, taskId) {
        const res = await this.request(`/${encodeURIComponent(runtimeId)}/tasks/${encodeURIComponent(taskId)}`);
        if (!res.ok)
            throw new RuntimeApiError(`Failed to inspect task`, res.status, await res.text());
        return res.json();
    }
    streamTask(runtimeId, taskId) {
        const url = `${this.prefix()}/${encodeURIComponent(runtimeId)}/tasks/${encodeURIComponent(taskId)}/stream`;
        return streamEvents(url, this.getToken);
    }
}
export class RuntimeApiError extends Error {
    status;
    body;
    constructor(message, status, body) {
        super(message);
        this.status = status;
        this.body = body;
        this.name = "RuntimeApiError";
    }
}
function streamEvents(url, getToken) {
    return {
        [Symbol.asyncIterator]() {
            return createEventStreamIterator(url, getToken);
        },
    };
}
function createEventStreamIterator(url, getToken) {
    let es;
    let done = false;
    let error;
    const buffer = [];
    let notify = () => { };
    const start = async () => {
        const token = getToken ? await getToken() : undefined;
        const fullUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;
        es = new EventSource(fullUrl);
        es.onmessage = (event) => {
            try {
                const parsed = JSON.parse(event.data);
                if (parsed.type === "stream-end") {
                    done = true;
                }
                else {
                    buffer.push(parsed);
                }
            }
            catch {
                // Ignore malformed events.
            }
            notify();
        };
        es.onerror = () => {
            if (!done) {
                done = true;
                error = error ?? new Error("EventSource error");
            }
            notify();
        };
    };
    start();
    return {
        async next() {
            while (!done || buffer.length > 0) {
                if (buffer.length > 0) {
                    return { value: buffer.shift(), done: false };
                }
                await new Promise((r) => {
                    notify = r;
                });
            }
            if (error)
                throw error;
            return { value: undefined, done: true };
        },
        async return() {
            es?.close();
            done = true;
            return { value: undefined, done: true };
        },
    };
}
