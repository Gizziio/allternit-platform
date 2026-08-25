/**
 * Allternit Runtime SDK
 *
 * Thin client for the Allternit runtime API. Talks to the self-hosted platform
 * API by default; in local-dev mode it can talk directly to a gizzi-code
 * runtime over HTTP(S).
 */

export type RuntimeStatus = "online" | "offline" | "busy";
export type RuntimeTransport = "local" | "websocket" | "uds";

export interface DiscoveredCli {
  name: string;
  path: string;
  version: string;
  icon: string;
}

export interface RegisteredRuntime {
  id: string;
  name: string;
  host: string;
  transport: RuntimeTransport;
  status: RuntimeStatus;
  lastHeartbeatAt?: number;
  registeredAt: number;
  workspaceId?: string;
  metadata?: {
    cwd?: string;
    env?: Record<string, string>;
    websocketUrl?: string;
    udsSocket?: string;
    token?: string;
  };
  agentClis: DiscoveredCli[];
}

export interface AgentTask {
  taskId: string;
  prompt: string;
  cwd?: string;
  env?: Record<string, string>;
  systemPrompt?: string;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    content: string | Uint8Array;
  }>;
}

export interface TaskHandle {
  taskId: string;
  runtimeId: string;
  cliName: string;
}

export type AgentEvent =
  | { type: "status"; status: "queued" | "running" | "completed" | "failed" | "cancelled" }
  | { type: "text_delta"; delta: string }
  | { type: "tool_call"; id: string; name: string; arguments: unknown }
  | { type: "tool_result"; id: string; content: string; isError?: boolean }
  | { type: "error"; error: unknown }
  | {
      type: "finish";
      finishReason: string;
      usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
    };

export interface ExecutionLog {
  taskId: string;
  runtimeId: string;
  cliName: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  startedAt?: number;
  finishedAt?: number;
  events: AgentEvent[];
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
  exitCode?: number;
  errorMessage?: string;
}

export interface RuntimeClientOptions {
  /** Base URL of the platform API or gizzi-code runtime. */
  baseUrl: string;
  /** Optional async token provider for authenticated requests. */
  getToken?: () => Promise<string | null | undefined>;
  /** Optional static auth token. */
  token?: string;
  /**
   * When true, baseUrl is treated as a direct gizzi-code runtime rather than
   * the platform API. Paths are prefixed with /v1 instead of /api/v1.
   */
  direct?: boolean;
}

export class RuntimeClient {
  private readonly baseUrl: string;
  private readonly getToken?: () => Promise<string | null | undefined>;
  private readonly direct: boolean;

  constructor(options: RuntimeClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.getToken = options.getToken;
    this.direct = options.direct ?? false;
  }

  private prefix(): string {
    return this.direct ? `${this.baseUrl}/v1/runtime` : `${this.baseUrl}/api/v1/runtime`;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = this.getToken ? await this.getToken() : undefined;
    if (token) headers["X-Runtime-Token"] = token;
    return headers;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const url = `${this.prefix()}${path}`;
    const headers = await this.authHeaders();
    return fetch(url, {
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
    });
  }

  async listRuntimes(): Promise<{ runtimes: RegisteredRuntime[] }> {
    const res = await this.request("/");
    if (!res.ok) throw new RuntimeApiError("Failed to list runtimes", res.status, await res.text());
    return res.json() as Promise<{ runtimes: RegisteredRuntime[] }>;
  }

  async getRuntime(id: string): Promise<{ runtime: RegisteredRuntime }> {
    const res = await this.request(`/${encodeURIComponent(id)}`);
    if (!res.ok) throw new RuntimeApiError(`Failed to get runtime ${id}`, res.status, await res.text());
    return res.json() as Promise<{ runtime: RegisteredRuntime }>;
  }

  async deleteRuntime(id: string): Promise<{ ok: boolean }> {
    const res = await this.request(`/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) throw new RuntimeApiError(`Failed to delete runtime ${id}`, res.status, await res.text());
    return res.json() as Promise<{ ok: boolean }>;
  }

  async heartbeat(id: string): Promise<{ ok: boolean }> {
    const res = await this.request(`/${encodeURIComponent(id)}/heartbeat`, { method: "POST" });
    if (!res.ok) throw new RuntimeApiError(`Failed to heartbeat runtime ${id}`, res.status, await res.text());
    return res.json() as Promise<{ ok: boolean }>;
  }

  async listLogs(id: string, limit?: number): Promise<{ logs: ExecutionLog[] }> {
    const query = limit !== undefined ? `?limit=${limit}` : "";
    const res = await this.request(`/${encodeURIComponent(id)}/logs${query}`);
    if (!res.ok) throw new RuntimeApiError(`Failed to list logs for ${id}`, res.status, await res.text());
    return res.json() as Promise<{ logs: ExecutionLog[] }>;
  }

  async assignTask(
    runtimeId: string,
    cliName: string,
    task: Omit<AgentTask, "taskId">
  ): Promise<{ handle: TaskHandle }> {
    const body = { cliName, ...task };
    const res = await this.request(`/${encodeURIComponent(runtimeId)}/tasks`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new RuntimeApiError(`Failed to assign task`, res.status, await res.text());
    return res.json() as Promise<{ handle: TaskHandle }>;
  }

  async abortTask(runtimeId: string, taskId: string): Promise<{ ok: boolean }> {
    const res = await this.request(
      `/${encodeURIComponent(runtimeId)}/tasks/${encodeURIComponent(taskId)}/abort`,
      { method: "POST" }
    );
    if (!res.ok) throw new RuntimeApiError(`Failed to abort task`, res.status, await res.text());
    return res.json() as Promise<{ ok: boolean }>;
  }

  async inspectTask(runtimeId: string, taskId: string): Promise<{ log: ExecutionLog }> {
    const res = await this.request(
      `/${encodeURIComponent(runtimeId)}/tasks/${encodeURIComponent(taskId)}`
    );
    if (!res.ok) throw new RuntimeApiError(`Failed to inspect task`, res.status, await res.text());
    return res.json() as Promise<{ log: ExecutionLog }>;
  }

  streamTask(runtimeId: string, taskId: string): AsyncIterable<AgentEvent> {
    const url = `${this.prefix()}/${encodeURIComponent(runtimeId)}/tasks/${encodeURIComponent(
      taskId
    )}/stream`;
    return streamEvents(url, this.getToken);
  }
}

export interface RemoteSession {
  id: string;
  slug: string;
  projectID: string;
  directory: string;
  parentID?: string;
  title: string;
  version: string;
  time: {
    created: number;
    updated: number;
    compacting?: number;
    archived?: number;
  };
  permission?: unknown;
  agentID?: string;
  surface?: "chat" | "cowork" | "code" | "browser" | "design";
  harness?: unknown;
  summary?: {
    additions: number;
    deletions: number;
    files: number;
    diffs?: unknown[];
  };
  share?: { url: string };
  revert?: unknown;
}

export interface RemoteSessionStatus {
  type: "idle" | "busy" | "retry";
  attempt?: number;
  message?: string;
  next?: number;
}

export interface RemoteSessionWithStatus {
  session: RemoteSession;
  status: RemoteSessionStatus;
}

export interface RemoteMessage {
  info: {
    id: string;
    sessionID: string;
    role: "user" | "assistant";
    parentID?: string;
    time: { created: number };
    [key: string]: unknown;
  };
  parts: Array<Record<string, unknown>>;
}

export interface RemoteSessionDetail {
  session: RemoteSession;
  status: RemoteSessionStatus;
  messages: RemoteMessage[];
}

export interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

export interface RemoteControlClientOptions {
  /** Base URL of the platform API or a direct gizzi-code runtime. */
  baseUrl: string;
  /** Runtime ID when talking through the platform relay. Omit for direct mode. */
  runtimeId?: string;
  /** Async Clerk/session token provider for authenticated platform requests. */
  getToken?: () => Promise<string | null | undefined>;
  /** Static auth token. */
  token?: string;
  /**
   * When true, baseUrl is treated as a direct gizzi-code runtime. Paths are
   * prefixed with /v1 instead of /api/v1 and no runtime relay proxy is used.
   */
  direct?: boolean;
  /**
   * Optional base URL of the Cloudflare push worker. When provided the client
   * can register Web Push subscriptions for proactive remote-control
   * notifications.
   */
  pushBaseUrl?: string;
}

export type RemoteControlEvent =
  | { type: "remote.connected"; properties: { sessionID: string; status: RemoteSessionStatus } }
  | { type: "remote.heartbeat"; properties: { sessionID: string } }
  | { type: "session.updated"; properties: { info: RemoteSession } }
  | { type: "message.updated"; properties: { info: RemoteMessage["info"] } }
  | { type: "message.part.updated"; properties: { part: Record<string, unknown> } }
  | { type: "session.status"; properties: { sessionID: string; status: RemoteSessionStatus } }
  | { type: "permission.asked"; properties: RemotePermissionRequest }
  | { type: "question.asked"; properties: RemoteQuestionRequest }
  | { type: string; properties: Record<string, unknown> };

export interface RemotePermissionRequest {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
  always: string[];
  tool?: { messageID: string; callID: string };
}

export interface RemoteQuestionRequest {
  id: string;
  sessionID: string;
  questions: Array<{
    question: string;
    header: string;
    options: Array<{ label: string; description: string }>;
    multiple?: boolean;
    custom?: boolean;
  }>;
  tool?: { messageID: string; callID: string };
}

export class RemoteControlClient {
  private readonly baseUrl: string;
  private readonly pushBaseUrl?: string;
  private readonly runtimeId?: string;
  private readonly getToken?: () => Promise<string | null | undefined>;
  private readonly direct: boolean;

  constructor(options: RemoteControlClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.pushBaseUrl = options.pushBaseUrl?.replace(/\/$/, "");
    this.runtimeId = options.runtimeId;
    this.getToken = options.getToken;
    this.direct = options.direct ?? false;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = this.getToken ? await this.getToken() : undefined;
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  private runtimePath(path: string): string {
    return `/v1/remote-control${path}`;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    return this.v1Raw(this.runtimePath(path), init);
  }

  private async v1Raw(path: string, init: RequestInit = {}): Promise<Response> {
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

  private async json<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await this.request(path, init);
    const text = await res.text();
    if (!res.ok) throw new RuntimeApiError(`Remote control request failed`, res.status, text);
    return JSON.parse(text) as T;
  }

  private async v1Json<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await this.v1Raw(path, init);
    const text = await res.text();
    if (!res.ok) throw new RuntimeApiError(`Runtime v1 request failed`, res.status, text);
    return JSON.parse(text) as T;
  }

  async listSessions(): Promise<RemoteSessionWithStatus[]> {
    return this.json("/sessions");
  }

  async getSession(sessionID: string): Promise<RemoteSessionDetail> {
    return this.json(`/sessions/${encodeURIComponent(sessionID)}`);
  }

  async sendMessage(
    sessionID: string,
    input: { text: string; attachments?: Array<{ mime: string; url: string; filename?: string }> }
  ): Promise<{ accepted: boolean; sessionID: string }> {
    return this.json(`/sessions/${encodeURIComponent(sessionID)}/messages`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async abortSession(sessionID: string): Promise<boolean> {
    return this.json(`/sessions/${encodeURIComponent(sessionID)}/abort`, { method: "POST" });
  }

  async listPendingPermissions(): Promise<RemotePermissionRequest[]> {
    return this.v1Json<RemotePermissionRequest[]>("/v1/permission");
  }

  async replyPermission(
    requestID: string,
    reply: "once" | "always" | "reject",
    message?: string
  ): Promise<boolean> {
    return this.v1Json<boolean>(`/v1/permission/${encodeURIComponent(requestID)}/reply`, {
      method: "POST",
      body: JSON.stringify({ reply, message }),
    });
  }

  async listPendingQuestions(): Promise<RemoteQuestionRequest[]> {
    return this.v1Json<RemoteQuestionRequest[]>("/v1/question");
  }

  async replyQuestion(requestID: string, answers: string[][]): Promise<boolean> {
    return this.v1Json<boolean>(`/v1/question/${encodeURIComponent(requestID)}/reply`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    });
  }

  async rejectQuestion(requestID: string): Promise<boolean> {
    return this.v1Json<boolean>(`/v1/question/${encodeURIComponent(requestID)}/reject`, {
      method: "POST",
    });
  }

  async getVapidPublicKey(): Promise<string> {
    const url = `${this.pushBaseUrl ?? this.baseUrl}/push/vapid-public-key`;
    const res = await fetch(url, { headers: await this.authHeaders() });
    if (!res.ok) throw new RuntimeApiError("Failed to fetch VAPID public key", res.status, await res.text());
    const data = (await res.json()) as { publicKey: string };
    return data.publicKey;
  }

  async subscribePush(subscription: PushSubscriptionJSON): Promise<{ ok: boolean }> {
    const runtimeId = this.assertRuntimeId();
    const url = `${this.pushBaseUrl ?? this.baseUrl}/push/subscribe/${encodeURIComponent(runtimeId)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await this.authHeaders()) },
      body: JSON.stringify(subscription),
    });
    if (!res.ok) throw new RuntimeApiError("Failed to subscribe push", res.status, await res.text());
    return res.json() as Promise<{ ok: boolean }>;
  }

  async unsubscribePush(endpoint: string): Promise<{ ok: boolean }> {
    const runtimeId = this.assertRuntimeId();
    const url = `${this.pushBaseUrl ?? this.baseUrl}/push/unsubscribe/${encodeURIComponent(runtimeId)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await this.authHeaders()) },
      body: JSON.stringify({ endpoint }),
    });
    if (!res.ok) throw new RuntimeApiError("Failed to unsubscribe push", res.status, await res.text());
    return res.json() as Promise<{ ok: boolean }>;
  }

  private assertRuntimeId(): string {
    if (!this.runtimeId) {
      throw new Error("RemoteControlClient requires runtimeId for push subscription");
    }
    return this.runtimeId;
  }

  streamEvents(sessionID: string): AsyncIterable<RemoteControlEvent> {
    const path = `/sessions/${encodeURIComponent(sessionID)}/events`;
    if (this.direct) {
      const url = `${this.baseUrl}${this.runtimePath(path)}`;
      return streamEventsAs<RemoteControlEvent>(url, this.getToken);
    }

    if (!this.runtimeId) {
      throw new Error("RemoteControlClient requires runtimeId in platform relay mode");
    }

    const ticketUrl = `${this.baseUrl}/api/v1/runtime-devices/${encodeURIComponent(
      this.runtimeId
    )}/socket-ticket`;
    const socketUrlBase = `${this.baseUrl}/api/v1/runtime-devices/${encodeURIComponent(
      this.runtimeId
    )}/socket`;
    const fullPath = this.runtimePath(path);
    const getToken = this.getToken;

    return {
      [Symbol.asyncIterator](): AsyncIterator<RemoteControlEvent> {
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

export class RuntimeApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string
  ) {
    super(message);
    this.name = "RuntimeApiError";
  }
}

function streamEvents(
  url: string,
  getToken?: () => Promise<string | null | undefined>
): AsyncIterable<AgentEvent> {
  return streamEventsAs<AgentEvent>(url, getToken);
}

function streamEventsAs<T>(
  url: string,
  getToken?: () => Promise<string | null | undefined>
): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<T> {
      return createEventStreamIterator(url, getToken) as AsyncIterator<T>;
    },
  };
}

function createEventStreamIterator(
  url: string,
  getToken?: () => Promise<string | null | undefined>
): AsyncIterator<AgentEvent> {
  let es: EventSource | undefined;
  let done = false;
  let error: Error | undefined;
  const buffer: AgentEvent[] = [];
  let notify = () => {};

  const start = async () => {
    const token = getToken ? await getToken() : undefined;
    const fullUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;
    es = new EventSource(fullUrl);

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "stream-end") {
          done = true;
        } else {
          buffer.push(parsed as AgentEvent);
        }
      } catch {
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
    async next(): Promise<IteratorResult<AgentEvent>> {
      while (!done || buffer.length > 0) {
        if (buffer.length > 0) {
          return { value: buffer.shift()!, done: false };
        }
        await new Promise<void>((r) => {
          notify = r;
        });
      }
      if (error) throw error;
      return { value: undefined, done: true };
    },
    async return(): Promise<IteratorResult<AgentEvent>> {
      es?.close();
      done = true;
      return { value: undefined, done: true };
    },
  };
}

interface RelayEventStreamOptions {
  ticketUrl: string;
  socketUrlBase: string;
  path: string;
  getToken?: () => Promise<string | null | undefined>;
}

function createRelayEventStreamIterator(
  options: RelayEventStreamOptions
): AsyncIterator<RemoteControlEvent> {
  let ws: WebSocket | undefined;
  let done = false;
  let error: Error | undefined;
  const buffer: RemoteControlEvent[] = [];
  let notify = () => {};

  const start = async () => {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = options.getToken ? await options.getToken() : undefined;
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const ticketRes = await fetch(options.ticketUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ path: options.path }),
      });
      if (!ticketRes.ok) {
        const text = await ticketRes.text();
        throw new RuntimeApiError("Failed to create relay socket ticket", ticketRes.status, text);
      }
      const { ticket } = (await ticketRes.json()) as { ticket: string };
      const socketUrl = `${options.socketUrlBase}?ticket=${encodeURIComponent(ticket)}`;

      ws = new WebSocket(socketUrl);
      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data as string);
          buffer.push(parsed as RemoteControlEvent);
        } catch {
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
    } catch (err) {
      done = true;
      error = err instanceof Error ? err : new Error(String(err));
      notify();
    }
  };

  start();

  return {
    async next(): Promise<IteratorResult<RemoteControlEvent>> {
      while (!done || buffer.length > 0) {
        if (buffer.length > 0) {
          return { value: buffer.shift()!, done: false };
        }
        await new Promise<void>((r) => {
          notify = r;
        });
      }
      if (error) throw error;
      return { value: undefined, done: true };
    },
    async return(): Promise<IteratorResult<RemoteControlEvent>> {
      ws?.close();
      done = true;
      return { value: undefined, done: true };
    },
  };
}
