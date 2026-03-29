import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/server-auth";
import {
  resolveRuntimeBackendForAuthUserId,
  toGatewayAuthorizationHeader,
} from "@/lib/runtime-backend";

const GATEWAY_BASE_URL =
  process.env.VITE_A2R_GATEWAY_URL?.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "") ??
  process.env.NEXT_PUBLIC_A2R_GATEWAY_URL?.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "") ??
  "http://127.0.0.1:8013";

type ProxyCandidate = {
  base: string;
  authorization?: string | null;
};

function uniqueCandidates(candidates: Array<ProxyCandidate | null | undefined>): ProxyCandidate[] {
  const seen = new Set<string>();
  const result: ProxyCandidate[] = [];

  for (const candidate of candidates) {
    if (!candidate?.base) continue;
    const base = candidate.base.replace(/\/+$/, "");
    if (!base || seen.has(base)) continue;
    seen.add(base);
    result.push({
      base,
      authorization: candidate.authorization ?? null,
    });
  }

  return result;
}

async function getGatewayCandidates(): Promise<ProxyCandidate[]> {
  const authState = await getAuth();
  const resolvedRuntime =
    authState.userId
      ? await resolveRuntimeBackendForAuthUserId(authState.userId).catch(() => null)
      : null;

  return uniqueCandidates([
    resolvedRuntime?.mode === "byoc-vps" && resolvedRuntime.gatewayUrl
      ? {
          base: resolvedRuntime.gatewayUrl,
          authorization: toGatewayAuthorizationHeader(
            resolvedRuntime.gatewayToken,
          ),
        }
      : null,
    {
      base: GATEWAY_BASE_URL,
      authorization: null,
    },
  ]);
}

function buildHeaders(
  request: NextRequest,
  candidate: ProxyCandidate,
  options?: { accept?: string; contentType?: string | null },
): Headers {
  const headers = new Headers();
  const contentType =
    options?.contentType ?? request.headers.get("content-type");
  const accept = options?.accept ?? request.headers.get("accept");
  const authorization = request.headers.get("authorization");

  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  if (accept) {
    headers.set("Accept", accept);
  }
  if (authorization) {
    headers.set("Authorization", authorization);
  } else if (candidate.authorization) {
    headers.set("Authorization", candidate.authorization);
  }

  return headers;
}

function buildResponse(upstream: Response): Response {
  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  const cacheControl = upstream.headers.get("cache-control");
  const connection = upstream.headers.get("connection");

  if (contentType) headers.set("Content-Type", contentType);
  if (cacheControl) headers.set("Cache-Control", cacheControl);
  if (connection) headers.set("Connection", connection);

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}

export async function proxyGatewayRequest(
  request: NextRequest,
  upstreamPath: string,
  options?: {
    allowStatusesUnder500?: boolean;
    accept?: string;
    contentType?: string | null;
    retryOnStatuses?: number[];
  },
): Promise<Response> {
  const candidates = await getGatewayCandidates();
  const allowStatusesUnder500 = options?.allowStatusesUnder500 ?? true;
  const retryOnStatuses = new Set(options?.retryOnStatuses ?? []);
  const method = request.method.toUpperCase();
  const bodyBuffer =
    method === "GET" || method === "HEAD"
      ? null
      : Buffer.from(await request.arrayBuffer());

  for (const candidate of candidates) {
    const targetUrl = `${candidate.base}${upstreamPath}`;
    try {
      const upstream = await fetch(targetUrl, {
        method,
        headers: buildHeaders(request, candidate, options),
        body: bodyBuffer && bodyBuffer.byteLength > 0 ? bodyBuffer : undefined,
        signal: AbortSignal.timeout(15_000),
        // @ts-expect-error duplex required for streamed request bodies
        duplex: bodyBuffer ? "half" : undefined,
      });

      if (retryOnStatuses.has(upstream.status)) {
        continue;
      }

      if (upstream.ok || (allowStatusesUnder500 && upstream.status < 500)) {
        return buildResponse(upstream);
      }
    } catch {
      // Try the next candidate.
    }
  }

  return NextResponse.json(
    { error: "Runtime backend is unavailable" },
    { status: 503 },
  );
}
