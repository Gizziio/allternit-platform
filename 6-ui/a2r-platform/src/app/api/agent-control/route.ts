import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-sqlite";

export const runtime = "nodejs";

const DEFAULT_GATEWAY_PORT = Number(
  process.env.A2R_OPENCLAW_HOST_PORT
    || process.env.A2R_PORT
    || process.env.OPENCLAW_PORT
    || 18789,
);

const DEFAULT_GATEWAY_WS_URL = (
  process.env.A2R_OPENCLAW_GATEWAY_WS_URL
  || process.env.OPENCLAW_GATEWAY_WS_URL
  || process.env.A2R_OPENCLAW_HOST_URL
  || process.env.OPENCLAW_HOST_URL
  || `ws://127.0.0.1:${DEFAULT_GATEWAY_PORT}`
).trim();

const DEFAULT_GATEWAY_TOKEN = (
  process.env.A2R_GATEWAY_TOKEN
  || process.env.OPENCLAW_GATEWAY_TOKEN
  || process.env.A2R_OPENCLAW_GATEWAY_TOKEN
  || null
);

const DEFAULT_GATEWAY_PASSWORD = (
  process.env.A2R_GATEWAY_PASSWORD
  || process.env.OPENCLAW_GATEWAY_PASSWORD
  || null
);

const ALLOWED_METHODS = new Set([
  "node.list",
  "cron.update",
  "cron.run",
  "skills.update",
  "config.apply",
  "update.run",
  "config.get",
  "config.set",
  "skills.status",
  "cron.list",
]);

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeWsUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed
    .replace(/^http:\/\//i, "ws://")
    .replace(/^https:\/\//i, "wss://")
    .replace(/\/+$/, "");
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

interface GatewayResFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { message?: string };
}

interface GatewayEventFrame {
  type: "event";
  event: string;
  payload?: unknown;
}

function asResFrame(frame: unknown): GatewayResFrame | null {
  if (!isRecord(frame)) return null;
  if (frame.type !== "res") return null;
  if (typeof frame.id !== "string") return null;
  if (typeof frame.ok !== "boolean") return null;
  return frame as unknown as GatewayResFrame;
}

function asEventFrame(frame: unknown): GatewayEventFrame | null {
  if (!isRecord(frame)) return null;
  if (frame.type !== "event") return null;
  if (typeof frame.event !== "string") return null;
  return frame as unknown as GatewayEventFrame;
}

async function callGatewayMethod(options: {
  gatewayWsUrl: string;
  gatewayToken: string | null;
  gatewayPassword: string | null;
  method: string;
  params: unknown;
  signal: AbortSignal;
}): Promise<unknown> {
  const { gatewayWsUrl, gatewayToken, gatewayPassword, method, params, signal } = options;

  return await new Promise<unknown>((resolve, reject) => {
    let socket: WebSocket | null = null;
    let connectReqId = "";
    let requestReqId = "";
    let connected = false;
    let resolved = false;
    let challengeRetries = 0;

    const finish = (error?: Error, payload?: unknown) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutHandle);
      signal.removeEventListener("abort", abortHandler);
      if (socket) {
        try {
          socket.close(1000, "done");
        } catch (error) {
          console.error("[Agent Control] Failed to close WebSocket:", error);
        }
        socket = null;
      }
      if (error) {
        reject(error);
      } else {
        resolve(payload);
      }
    };

    const sendReq = (id: string, methodName: string, requestParams: unknown) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        throw new Error("gateway socket is not open");
      }
      socket.send(JSON.stringify({
        type: "req",
        id,
        method: methodName,
        params: requestParams,
      }));
    };

    const sendConnect = () => {
      connectReqId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `connect-${Date.now()}-${Math.random()}`;

      sendReq(connectReqId, "connect", {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "openclaw-control-ui",
          version: "a2r-agent-control-1",
          platform: "node",
          mode: "webchat",
          instanceId: `a2r-agent-control-${Date.now()}`,
        },
        role: "operator",
        scopes: ["operator.read", "operator.write", "operator.admin"],
        caps: [],
        auth: (gatewayToken || gatewayPassword)
          ? {
              token: gatewayToken || undefined,
              password: gatewayPassword || undefined,
            }
          : undefined,
        userAgent: "a2r-agent-control/1",
        locale: "en-US",
      });
    };

    const sendMethodCall = () => {
      requestReqId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `req-${Date.now()}-${Math.random()}`;
      sendReq(requestReqId, method, params ?? {});
    };

    const timeoutHandle = setTimeout(() => {
      finish(new Error("Gateway request timed out"));
    }, 30_000);

    const abortHandler = () => {
      finish(new Error("Request aborted"));
    };
    signal.addEventListener("abort", abortHandler, { once: true });

    try {
      socket = new WebSocket(gatewayWsUrl);
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    socket.onopen = () => {
      try {
        sendConnect();
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    };

    socket.onmessage = (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(event.data ?? ""));
      } catch (error) {
        console.error("[Agent Control] Failed to parse WebSocket message:", error);
        return;
      }

      const eventFrame = asEventFrame(parsed);
      if (eventFrame) {
        if (eventFrame.event === "connect.challenge" && challengeRetries < 2) {
          challengeRetries += 1;
          try {
            sendConnect();
          } catch (error) {
            console.error("[Agent Control] Failed to send connect request:", error);
            finish(error instanceof Error ? error : new Error(String(error)));
          }
        }
        return;
      }

      const resFrame = asResFrame(parsed);
      if (!resFrame) return;

      if (resFrame.id === connectReqId) {
        if (!resFrame.ok) {
          finish(new Error(resFrame.error?.message || "connect failed"));
          return;
        }
        connected = true;
        try {
          sendMethodCall();
        } catch (error) {
          console.error("[Agent Control] Failed to send method call:", error);
          finish(error instanceof Error ? error : new Error(String(error)));
        }
        return;
      }

      if (connected && resFrame.id === requestReqId) {
        if (!resFrame.ok) {
          finish(new Error(resFrame.error?.message || `${method} failed`));
          return;
        }
        finish(undefined, resFrame.payload);
      }
    };

    socket.onerror = () => {
      finish(new Error("gateway websocket error"));
    };

    socket.onclose = (event) => {
      if (resolved) return;
      const reason = event.reason ? `: ${event.reason}` : "";
      finish(new Error(`Gateway closed (${event.code})${reason}`));
    };
  });
}

export async function POST(req: NextRequest) {
  try {
    await auth.api.getSession({ headers: req.headers });

    const body = await req.json() as JsonRecord;
    const method = getString(body.method);
    if (!method || !ALLOWED_METHODS.has(method)) {
      return NextResponse.json(
        { error: "Method not allowed", allowed: Array.from(ALLOWED_METHODS) },
        { status: 400 },
      );
    }

    const gatewayWsUrl = normalizeWsUrl(
      getString(body.gatewayWsUrl)
      || getString(body.gatewayUrl)
      || DEFAULT_GATEWAY_WS_URL,
    );
    const gatewayToken = getString(body.gatewayToken) || DEFAULT_GATEWAY_TOKEN;
    const gatewayPassword = getString(body.gatewayPassword) || DEFAULT_GATEWAY_PASSWORD;

    if (!gatewayWsUrl) {
      return NextResponse.json(
        { error: "Missing gateway WebSocket URL" },
        { status: 400 },
      );
    }

    const payload = await callGatewayMethod({
      gatewayWsUrl,
      gatewayToken,
      gatewayPassword,
      method,
      params: body.params ?? {},
      signal: req.signal,
    });

    return NextResponse.json({
      ok: true,
      method,
      payload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
