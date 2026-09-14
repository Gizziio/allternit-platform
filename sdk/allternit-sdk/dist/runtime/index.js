/**
 * Allternit Runtime SDK
 *
 * Thin client for the Allternit runtime API. Talks to the self-hosted platform
 * API by default; in local-dev mode it can talk directly to a gizzi-code
 * runtime over HTTP(S).
 */
export class FabricSessionClient {
    baseUrl;
    runtimeId;
    getToken;
    direct;
    constructor(options) {
        this.baseUrl = options.baseUrl.replace(/\/$/, "");
        this.runtimeId = options.runtimeId;
        this.getToken = options.getToken;
        this.direct = options.direct ?? false;
    }
    apiPath(path) {
        return this.direct ? `${this.baseUrl}/v1${path}` : `${this.baseUrl}/api/v1${path}`;
    }
    async authHeaders() {
        const headers = { "Content-Type": "application/json" };
        const token = this.getToken ? await this.getToken() : undefined;
        if (token)
            headers["Authorization"] = `Bearer ${token}`;
        return headers;
    }
    isLoopbackBase() {
        try {
            const host = new URL(this.baseUrl).hostname;
            return host === "127.0.0.1" || host === "localhost";
        }
        catch {
            return false;
        }
    }
    isCloudBase() {
        try {
            const host = new URL(this.baseUrl).hostname.toLowerCase();
            return host === "api.allternit.com"
                || host === "fabrictransport.allternit.com"
                || host === "fabric-session.allternit.com";
        }
        catch {
            return false;
        }
    }
    shouldUseRuntimeRelay() {
        return Boolean(this.runtimeId) && !this.direct && !this.isLoopbackBase() && this.isCloudBase();
    }
    async request(path, init = {}) {
        const headers = await this.authHeaders();
        const merged = { ...headers, ...init.headers };
        if (this.direct) {
            return fetch(`${this.baseUrl}/v1${path}`, { ...init, headers: merged });
        }
        // Desktop / local gateway already exposes /api/v1/fabric and /session-worker.
        const runtimeId = this.runtimeId;
        if (!runtimeId || !this.shouldUseRuntimeRelay()) {
            return fetch(`${this.baseUrl}/api/v1${path}`, {
                ...init,
                headers: merged,
                credentials: "include",
            });
        }
        // Hosted clients reach this desktop through the paired runtime relay.
        const body = init.body ? String(init.body) : "";
        return fetch(`${this.baseUrl}/api/v1/runtime-devices/${encodeURIComponent(runtimeId)}/proxy`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
            body: JSON.stringify({
                method: init.method ?? "GET",
                path: `/api/v1${path}`,
                headers: merged,
                body,
                body_encoding: "utf8",
            }),
        });
    }
    async json(path, init = {}) {
        const res = await this.request(path, init);
        const text = await res.text();
        if (!res.ok)
            throw new RuntimeApiError(`Fabric session request failed`, res.status, text);
        return JSON.parse(text);
    }
    async requestFullPath(fullPath, init = {}) {
        const headers = await this.authHeaders();
        const merged = { ...headers, ...init.headers };
        if (this.direct) {
            return fetch(`${this.baseUrl}${fullPath}`, { ...init, headers: merged });
        }
        const runtimeId = this.runtimeId;
        if (!runtimeId || !this.shouldUseRuntimeRelay()) {
            return fetch(`${this.baseUrl}${fullPath}`, {
                ...init,
                headers: merged,
                credentials: "include",
            });
        }
        const body = init.body ? String(init.body) : "";
        return fetch(`${this.baseUrl}/api/v1/runtime-devices/${encodeURIComponent(runtimeId)}/proxy`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
            body: JSON.stringify({
                method: init.method ?? "GET",
                path: fullPath,
                headers: merged,
                body,
                body_encoding: "utf8",
            }),
            signal: init.signal,
        });
    }
    async jsonFullPath(fullPath, init = {}) {
        const res = await this.requestFullPath(fullPath, init);
        const text = await res.text();
        if (!res.ok)
            throw new RuntimeApiError(`Fabric session request failed`, res.status, text);
        return JSON.parse(text);
    }
    async lease(capabilityId, ttlSeconds = 300) {
        return this.json("/fabric/leases", {
            method: "POST",
            body: JSON.stringify({ capabilityId, grantee: "web-client", ttlSeconds }),
        });
    }
    async invoke(capability, inputs, lease) {
        const headers = {};
        if (lease)
            headers["X-Allternit-Lease"] = lease.signature ?? encodeLease(lease);
        return this.json("/session-worker/invoke", {
            method: "POST",
            headers,
            body: JSON.stringify({ capability, inputs }),
        });
    }
    async listSessions() {
        const lease = await this.lease("harness.session");
        const result = await this.invoke("harness.session", {}, lease);
        return result?.result ?? result;
    }
    async getSession(sessionID) {
        const lease = await this.lease("harness.session.get");
        const result = await this.invoke("harness.session.get", { sessionID }, lease);
        return result?.result ?? result;
    }
    async sendMessage(sessionID, input) {
        const lease = await this.lease("harness.session.message");
        return this.invoke("harness.session.message", {
            sessionID,
            text: input.text,
            attachments: input.attachments,
            agent: input.agent,
            model: input.model,
        }, lease);
    }
    async abortSession(sessionID) {
        const lease = await this.lease("harness.session.abort");
        return this.invoke("harness.session.abort", { sessionID }, lease);
    }
    async createSession(input) {
        const lease = await this.lease("harness.session.create");
        const result = await this.invoke("harness.session.create", input ?? {}, lease);
        return result?.result ?? result;
    }
    async listBrains() {
        const paths = ["/api/v1/providers", "/v1/provider"];
        const results = await Promise.allSettled(paths.map((path) => this.jsonFullPath(path, { signal: AbortSignal.timeout(8000) })));
        for (const result of results) {
            if (result.status !== "fulfilled")
                continue;
            const brains = parseFabricBrains(result.value);
            if (brains.length > 0)
                return brains;
        }
        return [];
    }
    async listBots() {
        const paths = ["/api/v1/agents", "/v1/agent/list"];
        const results = await Promise.allSettled(paths.map((path) => this.jsonFullPath(path, { signal: AbortSignal.timeout(8000) })));
        for (const result of results) {
            if (result.status !== "fulfilled")
                continue;
            const bots = parseFabricBots(result.value);
            if (bots.length > 0)
                return bots;
        }
        return [];
    }
    async listPendingPermissions() {
        const lease = await this.lease("harness.session.permissions.list");
        const result = await this.invoke("harness.session.permissions.list", {}, lease);
        return result?.result ?? result;
    }
    async replyPermission(requestID, reply, message) {
        const lease = await this.lease("harness.session.permissions.reply");
        const result = await this.invoke("harness.session.permissions.reply", { requestID, reply, message }, lease);
        return result?.result ?? result;
    }
    async listPendingQuestions() {
        const lease = await this.lease("harness.session.questions.list");
        const result = await this.invoke("harness.session.questions.list", {}, lease);
        return result?.result ?? result;
    }
    async replyQuestion(requestID, answers) {
        const lease = await this.lease("harness.session.questions.reply");
        const result = await this.invoke("harness.session.questions.reply", { requestID, answers }, lease);
        return result?.result ?? result;
    }
    async rejectQuestion(requestID) {
        const lease = await this.lease("harness.session.questions.reject");
        const result = await this.invoke("harness.session.questions.reject", { requestID }, lease);
        return result?.result ?? result;
    }
    streamEvents(sessionID) {
        // One HTTP SSE through the runtime proxy. Do not EventSource the PWA
        // origin (reconnects mint leases) and do not mint relay socket tickets.
        const path = `/api/v1/session-worker/sessions/${encodeURIComponent(sessionID)}/events`;
        return this.proxySse(path);
    }
    async startAci(input) {
        return this.jsonFullPath("/api/aci/run", {
            method: "POST",
            body: JSON.stringify({
                goal: input.goal,
                model: input.model,
                sessionPersistence: "dont-keep",
            }),
        });
    }
    streamAci(runId) {
        return this.proxySse(`/api/aci/stream/${encodeURIComponent(runId)}`);
    }
    proxySse(fullPath) {
        const self = this;
        return {
            [Symbol.asyncIterator]() {
                return createProxySseIterator((signal) => self.requestFullPath(fullPath, {
                    method: "GET",
                    headers: { Accept: "text/event-stream" },
                    signal,
                }));
            },
        };
    }
}
export class WebPushClient {
    baseUrl;
    pushBaseUrl;
    runtimeId;
    getToken;
    constructor(options) {
        this.baseUrl = options.baseUrl.replace(/\/$/, "");
        this.pushBaseUrl = this.baseUrl;
        this.runtimeId = options.runtimeId;
        this.getToken = options.getToken;
    }
    async authHeaders() {
        const headers = { "Content-Type": "application/json" };
        const token = this.getToken ? await this.getToken() : undefined;
        if (token)
            headers["Authorization"] = `Bearer ${token}`;
        return headers;
    }
    async getVapidPublicKey() {
        const url = `${this.pushBaseUrl}/vapid-public-key`;
        const res = await fetch(url, { headers: await this.authHeaders() });
        if (!res.ok)
            throw new RuntimeApiError("Failed to fetch VAPID public key", res.status, await res.text());
        return res.text();
    }
    async subscribePush(subscription) {
        const runtimeId = this.assertRuntimeId();
        const url = `${this.pushBaseUrl}/subscribe`;
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(await this.authHeaders()) },
            body: JSON.stringify({ ...subscription, runtimeId }),
        });
        if (!res.ok)
            throw new RuntimeApiError("Failed to subscribe push", res.status, await res.text());
        return res.json();
    }
    async unsubscribePush(endpoint) {
        const runtimeId = this.assertRuntimeId();
        const url = `${this.pushBaseUrl}/unsubscribe`;
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(await this.authHeaders()) },
            body: JSON.stringify({ runtimeId, endpoint }),
        });
        if (!res.ok)
            throw new RuntimeApiError("Failed to unsubscribe push", res.status, await res.text());
        return res.json();
    }
    assertRuntimeId() {
        if (!this.runtimeId) {
            throw new Error("WebPushClient requires runtimeId for push subscription");
        }
        return this.runtimeId;
    }
}
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
export class RemoteControlClient {
    baseUrl;
    pushBaseUrl;
    runtimeId;
    getToken;
    direct;
    constructor(options) {
        this.baseUrl = options.baseUrl.replace(/\/$/, "");
        this.pushBaseUrl = options.pushBaseUrl?.replace(/\/$/, "");
        this.runtimeId = options.runtimeId;
        this.getToken = options.getToken;
        this.direct = options.direct ?? false;
    }
    async authHeaders() {
        const headers = { "Content-Type": "application/json" };
        const token = this.getToken ? await this.getToken() : undefined;
        if (token)
            headers["Authorization"] = `Bearer ${token}`;
        return headers;
    }
    runtimePath(path) {
        return `/v1/remote-control${path}`;
    }
    async request(path, init = {}) {
        return this.v1Raw(this.runtimePath(path), init);
    }
    async v1Raw(path, init = {}) {
        const headers = await this.authHeaders();
        if (this.direct) {
            const url = `${this.baseUrl}${path}`;
            return fetch(url, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
        }
        if (!this.runtimeId) {
            throw new Error("RemoteControlClient requires runtimeId in platform relay mode");
        }
        const body = init.body ? init.body : "";
        const payload = {
            method: init.method ?? "GET",
            path,
            headers,
            body: typeof body === "string" ? body : JSON.stringify(body),
            body_encoding: "utf8",
        };
        const url = `${this.baseUrl}/api/v1/runtime-devices/${encodeURIComponent(this.runtimeId)}/proxy`;
        return fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
            body: JSON.stringify(payload),
        });
    }
    async json(path, init = {}) {
        const res = await this.request(path, init);
        const text = await res.text();
        if (!res.ok)
            throw new RuntimeApiError(`Remote control request failed`, res.status, text);
        return JSON.parse(text);
    }
    async v1Json(path, init = {}) {
        const res = await this.v1Raw(path, init);
        const text = await res.text();
        if (!res.ok)
            throw new RuntimeApiError(`Runtime v1 request failed`, res.status, text);
        return JSON.parse(text);
    }
    async listSessions() {
        return this.json("/sessions");
    }
    async getSession(sessionID) {
        return this.json(`/sessions/${encodeURIComponent(sessionID)}`);
    }
    async sendMessage(sessionID, input) {
        return this.json(`/sessions/${encodeURIComponent(sessionID)}/messages`, {
            method: "POST",
            body: JSON.stringify(input),
        });
    }
    async abortSession(sessionID) {
        return this.json(`/sessions/${encodeURIComponent(sessionID)}/abort`, { method: "POST" });
    }
    async createSession(input) {
        return this.v1Json("/v1/session", {
            method: "POST",
            body: JSON.stringify(input ?? {}),
        });
    }
    async listPendingPermissions() {
        return this.v1Json("/v1/permission");
    }
    async replyPermission(requestID, reply, message) {
        return this.v1Json(`/v1/permission/${encodeURIComponent(requestID)}/reply`, {
            method: "POST",
            body: JSON.stringify({ reply, message }),
        });
    }
    async listPendingQuestions() {
        return this.v1Json("/v1/question");
    }
    async replyQuestion(requestID, answers) {
        return this.v1Json(`/v1/question/${encodeURIComponent(requestID)}/reply`, {
            method: "POST",
            body: JSON.stringify({ answers }),
        });
    }
    async rejectQuestion(requestID) {
        return this.v1Json(`/v1/question/${encodeURIComponent(requestID)}/reject`, {
            method: "POST",
        });
    }
    async getVapidPublicKey() {
        const url = `${this.pushBaseUrl ?? this.baseUrl}/vapid-public-key`;
        const res = await fetch(url, { headers: await this.authHeaders() });
        if (!res.ok)
            throw new RuntimeApiError("Failed to fetch VAPID public key", res.status, await res.text());
        return res.text();
    }
    async subscribePush(subscription) {
        const runtimeId = this.assertRuntimeId();
        const url = `${this.pushBaseUrl ?? this.baseUrl}/subscribe`;
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(await this.authHeaders()) },
            body: JSON.stringify({
                ...subscription,
                runtimeId,
            }),
        });
        if (!res.ok)
            throw new RuntimeApiError("Failed to subscribe push", res.status, await res.text());
        return res.json();
    }
    async unsubscribePush(endpoint) {
        const runtimeId = this.assertRuntimeId();
        const url = `${this.pushBaseUrl ?? this.baseUrl}/unsubscribe`;
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(await this.authHeaders()) },
            body: JSON.stringify({ runtimeId, endpoint }),
        });
        if (!res.ok)
            throw new RuntimeApiError("Failed to unsubscribe push", res.status, await res.text());
        return res.json();
    }
    assertRuntimeId() {
        if (!this.runtimeId) {
            throw new Error("RemoteControlClient requires runtimeId for push subscription");
        }
        return this.runtimeId;
    }
    streamEvents(sessionID) {
        const path = `/sessions/${encodeURIComponent(sessionID)}/events`;
        if (this.direct) {
            const url = `${this.baseUrl}${this.runtimePath(path)}`;
            return streamEventsAs(url, this.getToken);
        }
        if (!this.runtimeId) {
            throw new Error("RemoteControlClient requires runtimeId in platform relay mode");
        }
        const ticketUrl = `${this.baseUrl}/api/v1/runtime-devices/${encodeURIComponent(this.runtimeId)}/socket-ticket`;
        const socketUrlBase = `${this.baseUrl}/api/v1/runtime-devices/${encodeURIComponent(this.runtimeId)}/socket`;
        const fullPath = this.runtimePath(path);
        const getToken = this.getToken;
        return {
            [Symbol.asyncIterator]() {
                return createRelayEventStreamIterator({
                    ticketUrl,
                    socketUrlBase,
                    path: fullPath,
                    getToken,
                });
            },
        };
    }
}
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
}
function parseFabricBrainModels(raw) {
    if (Array.isArray(raw)) {
        return raw.flatMap((item) => {
            if (typeof item === "string" && item.trim())
                return [{ id: item, name: item }];
            const rec = asRecord(item);
            const id = typeof rec?.id === "string" ? rec.id : typeof rec?.modelID === "string" ? rec.modelID : "";
            if (!id)
                return [];
            const name = typeof rec?.name === "string" && rec.name.trim() ? rec.name : id;
            return [{ id, name }];
        });
    }
    const rec = asRecord(raw);
    if (!rec)
        return [];
    return Object.entries(rec).flatMap(([key, value]) => {
        const model = asRecord(value);
        const id = typeof model?.id === "string" ? model.id : key;
        if (!id)
            return [];
        const name = typeof model?.name === "string" && model.name.trim() ? model.name : id;
        return [{ id, name }];
    });
}
export function parseFabricBrains(payload) {
    const root = asRecord(payload) ?? {};
    const connected = new Set((Array.isArray(root.connected) ? root.connected : [])
        .filter((id) => typeof id === "string"));
    const providers = Array.isArray(root.providers) ? root.providers : [];
    const all = Array.isArray(root.all) ? root.all : [];
    const list = (all.length >= providers.length ? all : providers).length > 0
        ? (all.length >= providers.length ? all : providers)
        : Array.isArray(payload)
            ? payload
            : [];
    return list.flatMap((item) => {
        const rec = asRecord(item);
        if (!rec)
            return [];
        const id = typeof rec.id === "string" ? rec.id : "";
        if (!id)
            return [];
        const name = typeof rec.name === "string" && rec.name.trim() ? rec.name : id;
        const status = typeof rec.status === "string" ? rec.status : undefined;
        const models = parseFabricBrainModels(rec.models);
        const kind = typeof rec.provider_type === "string" ? rec.provider_type : "";
        const isConnected = connected.has(id) ||
            rec.connected === true ||
            rec.api_key_set === true ||
            status === "active" ||
            status === "connected" ||
            kind === "subprocess" ||
            kind === "local" ||
            kind === "cli";
        return [{ id, name, status, connected: isConnected, models }];
    });
}
export function parseFabricBots(payload) {
    const root = asRecord(payload) ?? {};
    const list = Array.isArray(root.agents)
        ? root.agents
        : Array.isArray(root.bots)
            ? root.bots
            : Array.isArray(payload)
                ? payload
                : [];
    return list.flatMap((item) => {
        const rec = asRecord(item);
        if (!rec)
            return [];
        if (rec.hidden === true)
            return [];
        if (rec.mode === "subagent")
            return [];
        const id = typeof rec.id === "string" ? rec.id : typeof rec.name === "string" ? rec.name : "";
        if (!id)
            return [];
        const name = typeof rec.name === "string" && rec.name.trim() ? rec.name : id;
        const modelRef = asRecord(rec.model);
        const model = typeof rec.model === "string"
            ? rec.model
            : typeof modelRef?.modelID === "string"
                ? modelRef.modelID
                : undefined;
        const provider = typeof rec.provider === "string"
            ? rec.provider
            : typeof modelRef?.providerID === "string"
                ? modelRef.providerID
                : undefined;
        return [{
                id,
                name,
                description: typeof rec.description === "string" ? rec.description : undefined,
                status: typeof rec.status === "string" ? rec.status : typeof rec.mode === "string" ? rec.mode : undefined,
                model,
                provider,
            }];
    });
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
    return streamEventsAs(url, getToken);
}
function streamEventsAs(url, getToken) {
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
function toWebSocketUrl(url) {
    if (url.startsWith("https:"))
        return `wss:${url.slice("https:".length)}`;
    if (url.startsWith("http:"))
        return `ws:${url.slice("http:".length)}`;
    return url;
}
function createRelayEventStreamIterator(options) {
    let ws;
    let done = false;
    let error;
    const buffer = [];
    let notify = () => { };
    const start = async () => {
        try {
            const headers = { "Content-Type": "application/json" };
            const token = options.getToken ? await options.getToken() : undefined;
            if (token)
                headers["Authorization"] = `Bearer ${token}`;
            const ticketRes = await fetch(options.ticketUrl, {
                method: "POST",
                headers,
                body: JSON.stringify({ path: options.path }),
            });
            if (!ticketRes.ok) {
                const text = await ticketRes.text();
                throw new RuntimeApiError("Failed to create relay socket ticket", ticketRes.status, text);
            }
            const { ticket } = (await ticketRes.json());
            const socketUrl = `${toWebSocketUrl(options.socketUrlBase)}?ticket=${encodeURIComponent(ticket)}`;
            ws = new WebSocket(socketUrl);
            ws.onmessage = (event) => {
                try {
                    const parsed = JSON.parse(event.data);
                    buffer.push(parsed);
                }
                catch {
                    // Ignore malformed events.
                }
                notify();
            };
            ws.onerror = (event) => {
                if (!done) {
                    done = true;
                    error = error ?? new Error("WebSocket error");
                }
                notify();
            };
            ws.onclose = () => {
                done = true;
                notify();
            };
        }
        catch (err) {
            done = true;
            error = err instanceof Error ? err : new Error(String(err));
            notify();
        }
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
            ws?.close();
            done = true;
            return { value: undefined, done: true };
        },
    };
}
function encodeLease(lease) {
    const json = JSON.stringify(lease);
    if (typeof Buffer !== "undefined") {
        return Buffer.from(json, "utf8").toString("base64url");
    }
    return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function createProxySseIterator(open) {
    let done = false;
    let error;
    const buffer = [];
    let notify = () => { };
    let abort;
    const start = async () => {
        try {
            abort = new AbortController();
            const res = await open(abort.signal);
            if (!res.ok) {
                throw new RuntimeApiError("SSE request failed", res.status, await res.text().catch(() => ""));
            }
            const reader = res.body?.getReader();
            if (!reader) {
                done = true;
                notify();
                return;
            }
            const decoder = new TextDecoder();
            let leftover = "";
            while (!done) {
                const next = await reader.read();
                if (next.done)
                    break;
                leftover += decoder.decode(next.value, { stream: true });
                const frames = leftover.split("\n\n");
                leftover = frames.pop() ?? "";
                for (const frame of frames) {
                    const data = frame
                        .split("\n")
                        .filter((line) => line.startsWith("data:"))
                        .map((line) => line.slice(5).trim())
                        .join("\n");
                    if (!data || data === "[DONE]")
                        continue;
                    try {
                        buffer.push(JSON.parse(data));
                    }
                    catch {
                        // ignore malformed frames
                    }
                }
                if (buffer.length)
                    notify();
            }
        }
        catch (err) {
            if (!done)
                error = err instanceof Error ? err : new Error(String(err));
        }
        finally {
            done = true;
            notify();
        }
    };
    start();
    return {
        async next() {
            while (!done || buffer.length > 0) {
                if (buffer.length > 0) {
                    return { value: buffer.shift(), done: false };
                }
                await new Promise((resolve) => {
                    notify = resolve;
                });
            }
            if (error)
                throw error;
            return { value: undefined, done: true };
        },
        async return() {
            done = true;
            abort?.abort();
            notify();
            return { value: undefined, done: true };
        },
    };
}
function createFabricEventStreamIterator(url, leasePromise, getToken) {
    let es;
    let done = false;
    let error;
    const buffer = [];
    let notify = () => { };
    const start = async () => {
        try {
            const lease = await leasePromise;
            const token = getToken ? await getToken() : undefined;
            const params = new URLSearchParams();
            if (lease) {
                params.set("x-allternit-lease", lease.signature ?? encodeLease(lease));
            }
            if (token) {
                params.set("token", token);
            }
            const qs = params.toString();
            const fullUrl = qs ? `${url}${url.includes("?") ? "&" : "?"}${qs}` : url;
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
        }
        catch (err) {
            done = true;
            error = err instanceof Error ? err : new Error(String(err));
            notify();
        }
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
