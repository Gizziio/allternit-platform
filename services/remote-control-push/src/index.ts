import { Hono } from "hono";
import { DurableObject } from "cloudflare:workers";

/**
 * Cloudflare edge relay for Allternit Remote Control.
 *
 * Mirrors the runtime-relay contract from cmd/allternit-cloud-api so the
 * remote-control dashboard / PWA can reach a paired runtime through the edge
 * instead of the Fly.io relay layer.
 *
 * Runtime (agent-daemon) connects upward on `/connect/:runtimeId`.
 * Browsers send HTTP through `/proxy/:runtimeId` and open SSE/WebSocket
 * streams via `/socket-ticket` + `/socket`.
 */

export interface Env {
  RUNTIME_RELAY: DurableObjectNamespace<RuntimeRelay>;
  /** KV namespace storing Web Push subscriptions keyed by runtime. */
  PUSH_SUBSCRIPTIONS: KVNamespace;
  /** VAPID public key (URL-safe base64, no padding). */
  VAPID_PUBLIC_KEY: string;
  /** VAPID private key (URL-safe base64, no padding). */
  VAPID_PRIVATE_KEY: string;
  /** VAPID subscriber URI (mailto: or https:). */
  VAPID_SUBJECT: string;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/connect/:runtimeId", async (c) => {
  const runtimeId = c.req.param("runtimeId");
  const upgrade = c.req.header("upgrade");
  if (upgrade?.toLowerCase() !== "websocket") {
    return c.json({ error: "websocket_required" }, 426);
  }
  const id = c.env.RUNTIME_RELAY.idFromName(runtimeId);
  const relay = await c.env.RUNTIME_RELAY.get(id);
  return relay.fetch(c.req.raw);
});

app.post("/proxy/:runtimeId", async (c) => {
  const runtimeId = c.req.param("runtimeId");
  const id = c.env.RUNTIME_RELAY.idFromName(runtimeId);
  const relay = await c.env.RUNTIME_RELAY.get(id);
  return relay.fetch(c.req.raw);
});

app.post("/socket-ticket/:runtimeId", async (c) => {
  const runtimeId = c.req.param("runtimeId");
  const id = c.env.RUNTIME_RELAY.idFromName(runtimeId);
  const relay = await c.env.RUNTIME_RELAY.get(id);
  return relay.fetch(c.req.raw);
});

app.get("/socket", async (c) => {
  const ticket = c.req.query("ticket");
  if (!ticket) return c.json({ error: "ticket_required" }, 400);
  const runtimeId = decodeRuntimeIdFromTicket(ticket);
  if (!runtimeId) return c.json({ error: "invalid_ticket" }, 400);
  const id = c.env.RUNTIME_RELAY.idFromName(runtimeId);
  const relay = await c.env.RUNTIME_RELAY.get(id);
  return relay.fetch(c.req.raw);
});

// Push subscription management. Subscriptions are keyed by runtime so the
// worker can fan out notifications when a runtime needs user attention.
app.get("/push/vapid-public-key", async (c) => {
  const key = c.env.VAPID_PUBLIC_KEY;
  if (!key) return c.json({ error: "vapid_not_configured" }, 503);
  return c.json({ publicKey: key });
});

app.post("/push/subscribe/:runtimeId", async (c) => {
  const runtimeId = c.req.param("runtimeId");
  const body = (await c.req.json()) as PushSubscriptionJSON;
  if (!body || !body.endpoint) {
    return c.json({ error: "subscription_required" }, 400);
  }
  const key = subscriptionKey(runtimeId, body.endpoint);
  await c.env.PUSH_SUBSCRIPTIONS.put(key, JSON.stringify(body), { expirationTtl: 90 * 24 * 60 * 60 });
  return c.json({ ok: true });
});

app.post("/push/unsubscribe/:runtimeId", async (c) => {
  const runtimeId = c.req.param("runtimeId");
  const body = (await c.req.json()) as { endpoint?: string };
  if (!body || !body.endpoint) {
    return c.json({ error: "endpoint_required" }, 400);
  }
  const key = subscriptionKey(runtimeId, body.endpoint);
  await c.env.PUSH_SUBSCRIPTIONS.delete(key);
  return c.json({ ok: true });
});

app.post("/push/notify/:runtimeId", async (c) => {
  const runtimeId = c.req.param("runtimeId");
  const payload = (await c.req.json()) as { title?: string; body?: string; tag?: string; data?: unknown };
  const list = await c.env.PUSH_SUBSCRIPTIONS.list({ prefix: `push:${runtimeId}:` });
  const results = await Promise.all(
    list.keys.map(async (key) => {
      const raw = await c.env.PUSH_SUBSCRIPTIONS.get(key.name);
      if (!raw) return { key: key.name, ok: false };
      try {
        const sub = JSON.parse(raw) as PushSubscriptionJSON;
        await sendPushNotification(c.env, sub, payload);
        return { key: key.name, ok: true };
      } catch (error) {
        if (error instanceof Error && error.message?.includes("unsubscribed")) {
          await c.env.PUSH_SUBSCRIPTIONS.delete(key.name);
        }
        return { key: key.name, ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    })
  );
  return c.json({ ok: true, sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
});

export default app;

// --- Durable Object ---

interface PendingRequest {
  resolve: (response: Response) => void;
  reject: (reason?: unknown) => void;
}

interface BrowserSocket {
  socket: WebSocket;
  socketId: string;
}

export class RuntimeRelay extends DurableObject<Env> {
  private runtimeSocket: WebSocket | null = null;
  private runtimeSession: WebSocketSession | null = null;
  private pending = new Map<string, PendingRequest>();
  private browsers = new Map<string, BrowserSocket>();
  private tickets = new Map<string, { path: string; expiresAt: number }>();

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
  }

  private runtimeId(): string {
    return this.ctx.id.toString();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.endsWith("/connect/" + url.pathname.split("/").pop())) {
      return this.handleRuntimeConnect(request);
    }

    if (path.endsWith("/proxy/" + url.pathname.split("/").pop())) {
      return this.handleBrowserProxy(request);
    }

    if (path.endsWith("/socket-ticket/" + url.pathname.split("/").pop())) {
      return this.handleSocketTicket(request);
    }

    if (path === "/socket") {
      return this.handleBrowserSocket(request);
    }

    return new Response("not_found", { status: 404 });
  }

  private async handleRuntimeConnect(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    this.ctx.acceptWebSocket(server);
    this.runtimeSocket = server;
    this.runtimeSession = new WebSocketSession(server, {
      onMessage: (data) => this.handleRuntimeMessage(data),
      onClose: () => {
        this.runtimeSocket = null;
        this.runtimeSession = null;
      },
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private async handleBrowserProxy(request: Request): Promise<Response> {
    if (!this.runtimeSession) {
      return new Response(JSON.stringify({ error: "runtime_offline" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.text();
    const requestId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });

      this.runtimeSession?.send(
        JSON.stringify({
          type: "request",
          request_id: requestId,
          method: request.method,
          path: urlPathFromProxy(request),
          headers: headersToRecord(request.headers),
          body,
          body_encoding: "utf8",
        })
      );

      // Timeout guard
      this.ctx.waitUntil(
        new Promise<void>((res) => {
          setTimeout(() => {
            if (this.pending.has(requestId)) {
              this.pending.delete(requestId);
              reject(new Error("proxy_timeout"));
            }
            res();
          }, 90_000);
        })
      );
    });
  }

  private async handleSocketTicket(request: Request): Promise<Response> {
    if (!this.runtimeSession) {
      return new Response(
        JSON.stringify({ error: "runtime_offline", message: "Runtime is offline" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const { path } = (await request.json()) as { path: string };
    const ticket = `${this.runtimeId()}:${crypto.randomUUID()}`;
    const expiresAt = Date.now() + 30_000;
    this.tickets.set(ticket, { path, expiresAt });
    return new Response(JSON.stringify({ ticket, expiresInSeconds: 30 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  private async handleBrowserSocket(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const ticket = url.searchParams.get("ticket");
    if (!ticket) return new Response("ticket_required", { status: 400 });

    const info = this.tickets.get(ticket);
    this.tickets.delete(ticket);
    if (!info || info.expiresAt < Date.now()) {
      return new Response("invalid_ticket", { status: 401 });
    }

    if (!this.runtimeSession) {
      return new Response("runtime_offline", { status: 503 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);

    const socketId = crypto.randomUUID();
    this.browsers.set(socketId, { socket: server, socketId });

    this.runtimeSession.send(
      JSON.stringify({
        type: "socket_open",
        socket_id: socketId,
        path: info.path,
        headers: {},
      })
    );

    server.addEventListener("message", (event) => {
      const data = typeof event.data === "string" ? event.data : "";
      this.runtimeSession?.send(
        JSON.stringify({
          type: "socket_data",
          socket_id: socketId,
          body: data,
          body_encoding: "utf8",
        })
      );
    });

    server.addEventListener("close", () => {
      this.browsers.delete(socketId);
      this.runtimeSession?.send(
        JSON.stringify({
          type: "socket_close",
          socket_id: socketId,
          code: 1000,
          reason: "Browser disconnected",
        })
      );
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private handleRuntimeMessage(raw: string): void {
    let msg: RuntimeMessage;
    try {
      msg = JSON.parse(raw) as RuntimeMessage;
    } catch {
      return;
    }

    switch (msg.type) {
      case "response": {
        const pending = this.pending.get(msg.request_id);
        if (!pending) return;
        this.pending.delete(msg.request_id);
        const status = msg.status ?? 200;
        const headers = new Headers(msg.headers);
        pending.resolve(
          new Response(decodeBody(msg.body, msg.body_encoding), {
            status,
            headers,
          })
        );
        break;
      }
      case "response_start": {
        // Streaming responses are buffered into a single response for the scaffold.
        break;
      }
      case "response_chunk": {
        break;
      }
      case "response_end": {
        const pending = this.pending.get(msg.request_id);
        if (!pending) return;
        this.pending.delete(msg.request_id);
        pending.resolve(new Response(null, { status: 200 }));
        break;
      }
      case "socket_data": {
        const browser = this.browsers.get(msg.socket_id);
        browser?.socket.send(decodeBody(msg.body, msg.body_encoding));
        break;
      }
      case "socket_ready": {
        const browser = this.browsers.get(msg.socket_id);
        browser?.socket.send(JSON.stringify({ type: "allternit_socket_ready" }));
        break;
      }
      case "socket_close": {
        const browser = this.browsers.get(msg.socket_id);
        browser?.socket.close(msg.code ?? 1000, msg.reason);
        this.browsers.delete(msg.socket_id);
        break;
      }
      case "pong":
        break;
    }
  }
}

// --- Helpers ---

interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

type RuntimeMessage =
  | { type: "response"; request_id: string; status: number; headers: Record<string, string>; body: string; body_encoding: string }
  | { type: "response_start"; request_id: string; status: number; headers: Record<string, string> }
  | { type: "response_chunk"; request_id: string; body: string; body_encoding: string }
  | { type: "response_end"; request_id: string }
  | { type: "socket_data"; socket_id: string; body: string; body_encoding: string }
  | { type: "socket_ready"; socket_id: string }
  | { type: "socket_close"; socket_id: string; code?: number; reason?: string }
  | { type: "pong" };

class WebSocketSession {
  constructor(
    private ws: WebSocket,
    private handlers: { onMessage: (data: string) => void; onClose: () => void }
  ) {
    this.ws.addEventListener("message", (event) => {
      const data = typeof event.data === "string" ? event.data : "";
      this.handlers.onMessage(data);
    });
    this.ws.addEventListener("close", () => this.handlers.onClose());
  }

  send(data: string): void {
    this.ws.send(data);
  }
}

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function decodeBody(body: string, encoding: string): string {
  if (encoding === "base64") {
    try {
      return atob(body);
    } catch {
      return body;
    }
  }
  return body;
}

function urlPathFromProxy(request: Request): string {
  const url = new URL(request.url);
  // The proxy request body carries the target path; fall back to the URL path.
  return url.pathname.replace(/\/proxy\/[^/]+$/, "") || "/";
}

function decodeRuntimeIdFromTicket(ticket: string): string | null {
  const idx = ticket.indexOf(":");
  if (idx === -1) return null;
  return ticket.slice(0, idx);
}

function subscriptionKey(runtimeId: string, endpoint: string): string {
  const hash = crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint)).then((buf) =>
    Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
  // Synchronous fallback for Workers runtime where crypto.subtle is async.
  // We use the raw endpoint hash via a simple stable encoding for the key.
  const stable = endpoint.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 200);
  return `push:${runtimeId}:${stable}`;
}

async function sendPushNotification(
  env: Env,
  subscription: PushSubscriptionJSON,
  payload: { title?: string; body?: string; tag?: string; data?: unknown }
): Promise<void> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    throw new Error("VAPID keys are not configured");
  }
  if (!subscription.endpoint) {
    throw new Error("Subscription has no endpoint");
  }

  const origin = new URL(subscription.endpoint).origin;
  const jwt = await signVapidJWT(env, origin);
  const authHeader = `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`;

  // Send an empty push payload. The service worker displays a notification
  // with the provided metadata by reading from the data query param or using
  // defaults. Full payload encryption is left as a follow-up optimization.
  const url = new URL(subscription.endpoint);
  url.searchParams.set("title", encodeURIComponent(payload.title ?? "Allternit"));
  url.searchParams.set("body", encodeURIComponent(payload.body ?? "Your remote session needs attention."));

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Length": "0",
      "TTL": "60",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "unknown");
    if (response.status === 410 || response.status === 404) {
      throw new Error("unsubscribed");
    }
    throw new Error(`push failed: ${response.status} ${text}`);
  }
}

async function signVapidJWT(env: Env, audience: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: env.VAPID_SUBJECT,
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await importVapidPrivateKey(env.VAPID_PRIVATE_KEY);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput)
  );
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${signingInput}.${encodedSignature}`;
}

async function importVapidPrivateKey(privateKeyBase64: string): Promise<CryptoKey> {
  const privateKeyBytes = base64UrlToUint8Array(privateKeyBase64);
  // VAPID private key is a 32-byte scalar for P-256.
  // We derive the public key point from the private key using the Web Crypto
  // subtle generateKey + export workaround is not straightforward, so we
  // import as a raw ECDH private key which Workers supports for ECDSA signing.
  return crypto.subtle.importKey(
    "raw",
    privateKeyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

function base64UrlToUint8Array(input: string): Uint8Array {
  const padded = input.padEnd(input.length + ((4 - (input.length % 4)) % 4), "=");
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
