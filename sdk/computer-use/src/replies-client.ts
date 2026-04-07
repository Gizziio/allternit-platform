/**
 * A2R Replies Client
 *
 * TypeScript SDK for the A2R Replies API.
 * Follows Anthropic/OpenAI SDK patterns:
 *   - client.replies.create()  — stream a new reply (SSE, AsyncIterable<ReplyEvent>)
 *   - client.replies.retrieve() — get a reply by ID
 *   - client.replies.cancel()   — cancel an in-progress reply
 *   - client.conversations.create()  — create a conversation
 *   - client.conversations.retrieve() — get a conversation
 *   - client.conversations.replies.list() — list replies for a conversation
 *
 * Usage:
 *   const client = new A2RClient({ baseURL: 'http://localhost:3000' });
 *
 *   // Streaming (Anthropic-style)
 *   const stream = client.replies.stream({
 *     conversationId: 'sess_abc',
 *     message: 'Explain quantum computing',
 *     model: 'claude/claude-sonnet-4-6',
 *   });
 *   for await (const event of stream) {
 *     if (event.type === 'reply.text.delta') process.stdout.write(event.delta);
 *   }
 *
 *   // Collect full text
 *   const text = await client.replies.stream({ ... }).text();
 */

import type {
  ReplyEvent,
  Reply,
  ConversationReplyState,
} from "@allternit/replies-contract";
import {
  createConversationReplyState,
  reduceReplyEvent,
} from "@allternit/replies-reducer";

// ---------------------------------------------------------------------------
// Client config
// ---------------------------------------------------------------------------

export interface A2RClientConfig {
  /** Base URL of the A2R platform (e.g. "http://localhost:3000") */
  baseURL: string;
  /** Optional API key sent as Bearer token */
  apiKey?: string;
  /** Additional headers merged into every request */
  headers?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Request/response shapes
// ---------------------------------------------------------------------------

export interface CreateReplyRequest {
  /** Conversation (session) ID — create one via client.conversations.create() */
  conversationId: string;
  /** User message text */
  message: string;
  /** Model slug, e.g. "claude/claude-sonnet-4-6" or "kimi/kimi-k2.5" */
  model?: string;
  /** Runtime model override */
  runtimeModel?: string;
  /** Explicit gateway URL */
  gatewayUrl?: string;
  /** Gateway auth token */
  gatewayToken?: string;
}

export interface CreateConversationRequest {
  /** Stable ID — supply for idempotent creation, omit to auto-generate */
  conversationId?: string;
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  object: "conversation";
  created_at: number | null;
  metadata: Record<string, unknown>;
}

export interface ReplyList {
  object: "list";
  conversation_id: string;
  data: Reply[];
  has_more: boolean;
}

// ---------------------------------------------------------------------------
// ReplyStream — AsyncIterable<ReplyEvent> with convenience helpers
// ---------------------------------------------------------------------------

export class ReplyStream implements AsyncIterable<ReplyEvent> {
  private _state: ConversationReplyState = createConversationReplyState();
  private _abortController = new AbortController();

  /** Internal — populated by the resource that created this stream */
  _onAbort?: () => void;

  constructor(private readonly _fetch: () => Promise<Response>) {}

  /** Abort the underlying request */
  abort(): void {
    this._abortController.abort();
    this._onAbort?.();
  }

  /** Convenience: collect all text delta events into a string */
  async text(): Promise<string> {
    let out = "";
    for await (const event of this) {
      if (event.type === "reply.text.delta") out += event.delta;
    }
    return out;
  }

  /** Convenience: reduce all events to a final ConversationReplyState */
  async finalState(): Promise<ConversationReplyState> {
    for await (const _ of this) { /* drain */ }
    return this._state;
  }

  /** Convenience: get the first Reply from the final state */
  async finalReply(): Promise<Reply | undefined> {
    const state = await this.finalState();
    const id = state.orderedReplyIds[0];
    return id ? state.replies[id] : undefined;
  }

  [Symbol.asyncIterator](): AsyncIterator<ReplyEvent> {
    let started = false;
    const queue: ReplyEvent[] = [];
    let done = false;
    let error: unknown = null;

    // Resolve/reject functions for the waiting next() call
    let waitResolve: ((result: IteratorResult<ReplyEvent>) => void) | null = null;
    let waitReject: ((err: unknown) => void) | null = null;

    const push = (event: ReplyEvent) => {
      this._state = reduceReplyEvent(this._state, event);
      if (waitResolve) {
        const resolve = waitResolve;
        waitResolve = null;
        waitReject = null;
        resolve({ value: event, done: false });
      } else {
        queue.push(event);
      }
    };

    const finish = () => {
      done = true;
      if (waitResolve) {
        const resolve = waitResolve;
        waitResolve = null;
        waitReject = null;
        resolve({ value: undefined as unknown as ReplyEvent, done: true });
      }
    };

    const fail = (err: unknown) => {
      error = err;
      done = true;
      if (waitReject) {
        const reject = waitReject;
        waitResolve = null;
        waitReject = null;
        reject(err);
      }
    };

    const run = async () => {
      try {
        const res = await this._fetch();
        if (!res.ok) {
          const text = await res.text().catch(() => res.statusText);
          fail(new Error(`A2R API error ${res.status}: ${text}`));
          return;
        }
        if (!res.body) { finish(); return; }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { value, done: streamDone } = await reader.read();
          if (streamDone) break;
          buf += decoder.decode(value, { stream: true });

          let nl: number;
          while ((nl = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            try {
              const event = JSON.parse(line.slice(5).trim()) as ReplyEvent;
              push(event);
            } catch { /* skip malformed */ }
          }
        }
        finish();
      } catch (err) {
        fail(err);
      }
    };

    return {
      next(): Promise<IteratorResult<ReplyEvent>> {
        if (!started) { started = true; run(); }

        if (queue.length > 0) {
          const event = queue.shift()!;
          return Promise.resolve({ value: event, done: false });
        }
        if (done && !error) {
          return Promise.resolve({ value: undefined as unknown as ReplyEvent, done: true });
        }
        if (error) return Promise.reject(error);

        return new Promise<IteratorResult<ReplyEvent>>((resolve, reject) => {
          waitResolve = resolve;
          waitReject = reject;
        });
      },
      return(): Promise<IteratorResult<ReplyEvent>> {
        done = true;
        return Promise.resolve({ value: undefined as unknown as ReplyEvent, done: true });
      },
    };
  }
}

// ---------------------------------------------------------------------------
// RepliesResource
// ---------------------------------------------------------------------------

class RepliesResource {
  constructor(private readonly _client: A2RClient) {}

  /**
   * Create and stream a new Reply.
   * Returns a ReplyStream (AsyncIterable<ReplyEvent>) with convenience helpers.
   *
   * @example
   * const stream = client.replies.stream({ conversationId, message });
   * for await (const event of stream) { ... }
   * const text = await stream.text();
   */
  stream(request: CreateReplyRequest): ReplyStream {
    const client = this._client;
    return new ReplyStream(() =>
      fetch(`${client.baseURL}/v1/replies`, {
        method: "POST",
        headers: client.buildHeaders(),
        body: JSON.stringify({
          conversation_id: request.conversationId,
          message: request.message,
          model: request.model,
          runtime_model: request.runtimeModel,
          gateway_url: request.gatewayUrl,
          gateway_token: request.gatewayToken,
          stream: true,
        }),
      }),
    );
  }

  /**
   * Retrieve a Reply by ID.
   * NOTE: Returns null until full persistence (Phase 8) ships.
   */
  async retrieve(replyId: string): Promise<Reply | null> {
    const res = await fetch(
      `${this._client.baseURL}/v1/replies/${encodeURIComponent(replyId)}`,
      { headers: this._client.buildHeaders() },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new A2RAPIError(res.status, await res.text());
    return res.json() as Promise<Reply>;
  }

  /**
   * Cancel an in-progress Reply.
   * Best-effort — returns 202 Accepted.
   */
  async cancel(replyId: string): Promise<{ reply_id: string; status: string }> {
    const res = await fetch(
      `${this._client.baseURL}/v1/replies/${encodeURIComponent(replyId)}/cancel`,
      { method: "POST", headers: this._client.buildHeaders() },
    );
    if (!res.ok) throw new A2RAPIError(res.status, await res.text());
    return res.json() as Promise<{ reply_id: string; status: string }>;
  }
}

// ---------------------------------------------------------------------------
// ConversationRepliesResource
// ---------------------------------------------------------------------------

class ConversationRepliesResource {
  constructor(private readonly _client: A2RClient, private readonly _conversationId: string) {}

  async list(): Promise<ReplyList> {
    const res = await fetch(
      `${this._client.baseURL}/v1/conversations/${encodeURIComponent(this._conversationId)}/replies`,
      { headers: this._client.buildHeaders() },
    );
    if (!res.ok) throw new A2RAPIError(res.status, await res.text());
    return res.json() as Promise<ReplyList>;
  }
}

// ---------------------------------------------------------------------------
// ConversationsResource
// ---------------------------------------------------------------------------

class ConversationsResource {
  constructor(private readonly _client: A2RClient) {}

  /** Create a new Conversation (session). */
  async create(request: CreateConversationRequest = {}): Promise<Conversation> {
    const res = await fetch(`${this._client.baseURL}/v1/conversations`, {
      method: "POST",
      headers: this._client.buildHeaders(),
      body: JSON.stringify({
        conversation_id: request.conversationId,
        metadata: request.metadata ?? {},
      }),
    });
    if (!res.ok) throw new A2RAPIError(res.status, await res.text());
    return res.json() as Promise<Conversation>;
  }

  /** Retrieve a Conversation by ID. */
  async retrieve(conversationId: string): Promise<Conversation | null> {
    const res = await fetch(
      `${this._client.baseURL}/v1/conversations/${encodeURIComponent(conversationId)}`,
      { headers: this._client.buildHeaders() },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new A2RAPIError(res.status, await res.text());
    return res.json() as Promise<Conversation>;
  }

  /** Access the replies sub-resource for a conversation. */
  replies(conversationId: string): ConversationRepliesResource {
    return new ConversationRepliesResource(this._client, conversationId);
  }
}

// ---------------------------------------------------------------------------
// A2RAPIError
// ---------------------------------------------------------------------------

export class A2RAPIError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`A2R API error ${status}: ${body}`);
    this.name = "A2RAPIError";
  }
}

// ---------------------------------------------------------------------------
// A2RClient — main entry point
// ---------------------------------------------------------------------------

export class A2RClient {
  readonly baseURL: string;
  private readonly _apiKey?: string;
  private readonly _headers: Record<string, string>;

  readonly replies: RepliesResource;
  readonly conversations: ConversationsResource;

  constructor(config: A2RClientConfig) {
    this.baseURL = config.baseURL.replace(/\/+$/, "");
    this._apiKey = config.apiKey;
    this._headers = config.headers ?? {};
    this.replies = new RepliesResource(this);
    this.conversations = new ConversationsResource(this);
  }

  /** @internal */
  buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this._headers,
    };
    if (this._apiKey) headers["Authorization"] = `Bearer ${this._apiKey}`;
    return headers;
  }
}
