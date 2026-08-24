import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Context, Env } from "hono";

interface PushSubscriptionRecord {
  runtimeId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  label?: string;
  createdAt: number;
}

interface PendingNotification {
  title: string;
  body: string;
  tag: string;
}

interface WorkerEnv {
  REMOTE_CONTROL_PUSH_KV: KVNamespace;
  VAPID_JWK: string;
  VAPID_PUBLIC_KEY: string;
  REMOTE_CONTROL_DASHBOARD_ORIGIN?: string;
}

function getDashboardOrigin(c: Context<{ Bindings: WorkerEnv }>): string {
  return c.env.REMOTE_CONTROL_DASHBOARD_ORIGIN ?? "https://remotecontrol.allternit.com";
}

function allowedOrigins(origin: string, dashboardOrigin: string): boolean {
  if (origin === dashboardOrigin) return true;
  if (origin.startsWith("http://localhost:")) return true;
  if (origin.startsWith("http://127.0.0.1:")) return true;
  return false;
}

async function hashEndpoint(endpoint: string): Promise<string> {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(endpoint));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

async function importVapidPrivateKey(jwkJson: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkJson);
  if (jwk.kty !== "EC" || jwk.crv !== "P-256") {
    throw new Error("VAPID_JWK must be a P-256 EC JWK");
  }
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

function base64UrlEncode(buffer: ArrayBuffer | ArrayBufferView): string {
  const bytes =
    buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function signVapidJWT(
  privateKey: CryptoKey,
  publicKey: string,
  audience: string,
  subject: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: subject,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(header))
  );
  const encodedPayload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(signingInput)
  );
  const encodedSignature = base64UrlEncode(signature);

  return `${signingInput}.${encodedSignature}`;
}

async function sendPushNotification(
  subscription: PushSubscriptionRecord,
  privateKey: CryptoKey,
  publicKey: string
): Promise<Response> {
  const audience = new URL(subscription.endpoint).origin;
  const jwt = await signVapidJWT(
    privateKey,
    publicKey,
    audience,
    "mailto:remote-control@allternit.com"
  );

  return fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      TTL: "60",
      Urgency: "high",
      Authorization: `vapid t=${jwt}, k=${publicKey}`,
    },
  });
}

const app = new Hono<{ Bindings: WorkerEnv }>();

app.use("*", async (c, next) => {
  const dashboardOrigin = getDashboardOrigin(c);
  return cors({
    origin: (origin) => (allowedOrigins(origin, dashboardOrigin) ? origin : null),
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    credentials: true,
  })(c, next);
});

app.get("/vapid-public-key", async (c) => {
  const publicKey = c.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return c.text("VAPID public key is not configured", 500);
  }
  return c.text(publicKey);
});

app.post("/subscribe", async (c) => {
  const body = await c.req.json<PushSubscriptionRecord>();
  if (!body.runtimeId || !body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return c.json({ error: "Missing required subscription fields" }, 400);
  }

  const record: PushSubscriptionRecord = {
    runtimeId: body.runtimeId,
    endpoint: body.endpoint,
    keys: body.keys,
    label: body.label,
    createdAt: Date.now(),
  };

  const keyHash = await hashEndpoint(body.endpoint);
  await c.env.REMOTE_CONTROL_PUSH_KV.put(
    `sub:${body.runtimeId}:${keyHash}`,
    JSON.stringify(record)
  );
  return c.json({ ok: true });
});

app.post("/unsubscribe", async (c) => {
  const body = await c.req.json<{ runtimeId?: string; endpoint?: string }>();
  if (!body.runtimeId || !body.endpoint) {
    return c.json({ error: "runtimeId and endpoint are required" }, 400);
  }
  const keyHash = await hashEndpoint(body.endpoint);
  await c.env.REMOTE_CONTROL_PUSH_KV.delete(`sub:${body.runtimeId}:${keyHash}`);
  await c.env.REMOTE_CONTROL_PUSH_KV.delete(`pending:${keyHash}`);
  return c.json({ ok: true });
});

app.post("/notify", async (c) => {
  const body = await c.req.json<{
    runtimeId?: string;
    title?: string;
    body?: string;
    tag?: string;
  }>();
  if (!body.runtimeId) {
    return c.json({ error: "runtimeId is required" }, 400);
  }

  const vapidJwk = c.env.VAPID_JWK;
  const vapidPublicKey = c.env.VAPID_PUBLIC_KEY;
  if (!vapidJwk || !vapidPublicKey) {
    return c.json({ error: "VAPID is not configured" }, 500);
  }

  const privateKey = await importVapidPrivateKey(vapidJwk);
  const pending: PendingNotification = {
    title: body.title ?? "Allternit Remote Control",
    body: body.body ?? "One of your machines needs input.",
    tag: body.tag ?? "remote-control",
  };

  const prefix = `sub:${body.runtimeId}:`;
  const list = await c.env.REMOTE_CONTROL_PUSH_KV.list({ prefix });
  const results = await Promise.all(
    list.keys.map(async (key) => {
      const raw = await c.env.REMOTE_CONTROL_PUSH_KV.get(key.name);
      if (!raw) return { ok: false, status: "missing" };
      const subscription: PushSubscriptionRecord = JSON.parse(raw);
      const endpointHash = await hashEndpoint(subscription.endpoint);
      await c.env.REMOTE_CONTROL_PUSH_KV.put(
        `pending:${endpointHash}`,
        JSON.stringify(pending),
        { expirationTtl: 300 }
      );

      try {
        const response = await sendPushNotification(
          subscription,
          privateKey,
          vapidPublicKey
        );
        if (response.status === 404 || response.status === 410) {
          await c.env.REMOTE_CONTROL_PUSH_KV.delete(key.name);
          return { ok: false, status: response.status };
        }
        return { ok: response.ok, status: response.status };
      } catch {
        return { ok: false, status: "exception" };
      }
    })
  );

  return c.json({ ok: true, delivered: results.filter((r) => r.ok).length, total: results.length });
});

app.get("/pending", async (c) => {
  const endpoint = c.req.query("endpoint");
  if (!endpoint) {
    return c.json({ error: "endpoint is required" }, 400);
  }
  const endpointHash = await hashEndpoint(endpoint);
  const raw = await c.env.REMOTE_CONTROL_PUSH_KV.get(`pending:${endpointHash}`);
  if (!raw) {
    return c.json({ title: "Allternit Remote Control", body: "One of your machines needs input.", tag: "remote-control" });
  }
  await c.env.REMOTE_CONTROL_PUSH_KV.delete(`pending:${endpointHash}`);
  return c.json(JSON.parse(raw));
});

app.get("/health", (c) => c.json({ ok: true }));

export default app;
