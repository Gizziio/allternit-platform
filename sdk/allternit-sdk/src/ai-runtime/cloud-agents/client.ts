import type {
  CloudSession,
  CloudSessionEvent,
  CloudTurn,
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

  constructor(options: AllternitOptions) {
    this.baseURL = options.baseURL.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.sessions = new CloudSessionsResource(this);
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
