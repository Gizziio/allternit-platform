import type {
  BotAgent,
  CloudSession,
  CloudSessionEvent,
  CloudTurn,
  CreateBotOptions,
  CreateCloudSessionOptions,
  SendCloudSessionEvent,
} from "./types.js";

export interface AllternitOptions {
  apiKey?: string;
  baseURL: string;
  fetch?: typeof globalThis.fetch;
}

/**
 * Client for the Allternit Agents Cloud Agents API (`/api/v1/sessions`).
 *
 * This is the Allternit public session surface — the same kind of product as
 * hosted agent sessions, on Allternit's own session model. It is not an
 * OpenAI or Anthropic Agents API client and does not require beta headers.
 */
export class Allternit {
  private readonly baseURL: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  readonly sessions: CloudSessionsResource;
  readonly bots: CloudBotsResource;

  constructor(options: AllternitOptions) {
    this.baseURL = options.baseURL.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.sessions = new CloudSessionsResource(this);
    this.bots = new CloudBotsResource(this);
  }

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "application/json");
    if (this.apiKey && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${this.apiKey}`);
    }
    const response = await this.fetchImpl(`${this.baseURL}${path}`, {
      ...init,
      headers,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Allternit request failed: HTTP ${response.status}${detail ? ` — ${detail}` : ""}`,
      );
    }
    return response.json() as Promise<T>;
  }

  /** Raw GET for SSE endpoints (the event stream is not JSON). */
  async requestStream(path: string): Promise<Response> {
    const headers = new Headers();
    if (this.apiKey) {
      headers.set("Authorization", `Bearer ${this.apiKey}`);
    }
    const response = await this.fetchImpl(`${this.baseURL}${path}`, { headers });
    if (!response.ok) {
      throw new Error(`Allternit request failed: HTTP ${response.status}`);
    }
    return response;
  }
}

export class CloudSessionsResource {
  constructor(private readonly client: Allternit) {}

  /** Create a Cloud Agent session. */
  async create(options: CreateCloudSessionOptions): Promise<CloudSession> {
    const body = await this.client.request<{ session: CloudSession }>(
      "/api/v1/sessions",
      {
        method: "POST",
        body: JSON.stringify({
          agent: options.agent,
          computer: options.computer ?? { kind: "none" },
          input: options.input,
          stream: false,
          vault_ids: options.vaultIds,
          budget: options.budget,
          metadata: options.metadata,
          brain_id: options.brainId,
          parent_thread_id: options.parent_thread_id,
          permission: options.permission,
          bot_id: options.botId,
        }),
      },
    );
    return body.session;
  }

  /** Retrieve one session by id. */
  async retrieve(sessionId: string): Promise<CloudSession> {
    const body = await this.client.request<{ session: CloudSession }>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}`,
    );
    return body.session;
  }

  /** Archive a session. Further event sends to it fail. */
  async archive(sessionId: string): Promise<{ archived: boolean }> {
    return this.client.request(`/api/v1/sessions/${encodeURIComponent(sessionId)}/archive`, {
      method: "POST",
      body: "{}",
    });
  }

  readonly events = new CloudSessionEventsResource(this.client);
  readonly turns = new CloudSessionTurnsResource(this.client);

  async threads(sessionId: string): Promise<CloudSession[]> {
    const body = await this.client.request<{ threads: CloudSession[] }>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/threads`,
    );
    return body.threads;
  }

  async outputs(sessionId: string): Promise<unknown[]> {
    const body = await this.client.request<{ outputs: unknown[] }>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/outputs`,
    );
    return body.outputs;
  }
}

export class CloudSessionTurnsResource {
  constructor(private readonly client: Allternit) {}

  /** List turns for a session, oldest first. */
  async list(sessionId: string): Promise<CloudTurn[]> {
    const body = await this.client.request<{ turns: CloudTurn[] }>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/turns`,
    );
    return body.turns;
  }
}

export class CloudSessionEventsResource {
  constructor(private readonly client: Allternit) {}

  /**
   * Send user events (`user.message`, `user.interrupt`, `user.tool_result`)
   * into a session. `user.message` enqueues a run; `user.interrupt` cancels
   * queued work and returns the session to `idle`.
   */
  async send(
    sessionId: string,
    events: SendCloudSessionEvent[],
  ): Promise<{ accepted: boolean }> {
    return this.client.request(`/api/v1/sessions/${encodeURIComponent(sessionId)}/events`, {
      method: "POST",
      body: JSON.stringify({ events }),
    });
  }

  /**
   * SSE stream of a session's events as an async iterator. Events use
   * Allternit type names (`session.created`, `turn.started`, `agent.message`,
   * …). Replays stored history from `after` (exclusive) before live events.
   */
  async *stream(
    sessionId: string,
    options: { after?: number } = {},
  ): AsyncGenerator<CloudSessionEvent> {
    const query = options.after ? `?after=${options.after}` : "";
    const response = await this.client.requestStream(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/events/stream${query}`,
    );
    if (!response.body) {
      throw new Error("Allternit event stream returned no body");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
        const dataLine = frame
          .split("\n")
          .find((line) => line.startsWith("data:"));
        if (!dataLine) continue;
        const jsonText = dataLine.slice(5).trim();
        if (!jsonText) continue;
        try {
          yield JSON.parse(jsonText) as CloudSessionEvent;
        } catch {
          // Skip malformed frames; the stream is best-effort per frame.
        }
      }
    }
  }
}

function asBot(row: Record<string, unknown>): BotAgent {
  const config =
    row.config && typeof row.config === "object"
      ? (row.config as Record<string, unknown>)
      : {};
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    description: typeof row.description === "string" ? row.description : undefined,
    isBot: Boolean(row.isBot ?? row.is_bot ?? config.isBot),
    botProfile: (row.botProfile ?? row.bot_profile ?? config.botProfile) as BotAgent["botProfile"],
    model: typeof row.model === "string" ? row.model : undefined,
    provider: typeof row.provider === "string" ? row.provider : undefined,
    status: typeof row.status === "string" ? row.status : undefined,
    brain: row.brain ?? config.botBrain,
    brainId: (row.brainId ?? row.brain_id ?? config.brainId) as string | undefined,
  };
}

/**
 * Packaged bots on the same agents table (`isBot` / `botProfile`).
 * Sessions for a bot reuse `/api/v1/sessions` with `bot_id`.
 */
export class CloudBotsResource {
  constructor(private readonly client: Allternit) {}

  async create(options: CreateBotOptions): Promise<BotAgent> {
    const body = await this.client.request<{ agent?: BotAgent } & BotAgent>("/api/v1/agents", {
      method: "POST",
      body: JSON.stringify({
        name: options.name,
        description: options.description ?? options.botProfile.tagline ?? "",
        model: options.model ?? "default",
        provider: options.provider ?? "custom",
        system_prompt: options.systemPrompt,
        is_bot: true,
        bot_profile: options.botProfile,
      }),
    });
    const row = (body.agent ?? body) as unknown as Record<string, unknown>;
    return asBot({ ...row, isBot: true, botProfile: options.botProfile });
  }

  async list(): Promise<BotAgent[]> {
    const body = await this.client.request<{ agents?: unknown[] } | unknown[]>("/api/v1/agents");
    const rows = Array.isArray(body)
      ? body
      : Array.isArray((body as { agents?: unknown[] }).agents)
        ? (body as { agents: unknown[] }).agents
        : [];
    return (rows as Record<string, unknown>[])
      .map(asBot)
      .filter((bot) => bot.isBot === true);
  }

  async get(botId: string): Promise<BotAgent> {
    const body = await this.client.request<{ agent?: BotAgent } & BotAgent>(
      `/api/v1/agents/${encodeURIComponent(botId)}`,
    );
    const row = (body.agent ?? body) as unknown as Record<string, unknown>;
    return asBot(row);
  }

  async archive(botId: string): Promise<{ archived: boolean }> {
    return this.client.request(`/api/v1/agents/${encodeURIComponent(botId)}/archive`, {
      method: "POST",
      body: "{}",
    });
  }
}
