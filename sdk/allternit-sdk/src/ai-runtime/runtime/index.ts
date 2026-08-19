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
  return {
    [Symbol.asyncIterator](): AsyncIterator<AgentEvent> {
      return createEventStreamIterator(url, getToken);
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
