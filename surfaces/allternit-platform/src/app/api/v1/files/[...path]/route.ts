/**
 * /api/v1/files/[...path] — File system proxy
 *
 * Forwards file system requests from the browser to the Allternit gateway
 * (which runs on a different port and can't be hit directly due to CORS).
 * Falls back to the gizzi terminal server if the gateway is unavailable.
 */

import { type NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/server-auth";
import {
  resolveRuntimeBackendForAuthUserId,
  toGatewayAuthorizationHeader,
} from "@/lib/runtime-backend";

const GATEWAY_BASE_URL =
  process.env.VITE_ALLTERNIT_GATEWAY_URL?.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "") ??
  "http://127.0.0.1:8013";

const TERMINAL_SERVER_URL =
  process.env.TERMINAL_SERVER_URL ?? "http://127.0.0.1:4096";

type RouteParams = { params: Promise<{ path: string[] }> };

async function proxyFilesRequest(
  req: NextRequest,
  { params }: RouteParams,
): Promise<Response> {
  const { path } = await params;
  const endpoint = path.join("/");
  const search = req.nextUrl.search;
  const authState = await getAuth();
  const resolvedRuntime =
    authState.userId
      ? await resolveRuntimeBackendForAuthUserId(authState.userId)
      : null;
  const resolvedGatewayBase =
    resolvedRuntime?.mode === "byoc-vps"
      ? resolvedRuntime.gatewayUrl
      : null;
  const proxyBases = [
    resolvedGatewayBase,
    GATEWAY_BASE_URL,
    TERMINAL_SERVER_URL,
  ].filter((base, index, list): base is string => Boolean(base) && list.indexOf(base) === index);

  // Try gateway first, then gizzi fallback
  for (const base of proxyBases) {
    const targetUrl = `${base}/api/v1/files/${endpoint}${search}`;
    try {
      const headers: Record<string, string> = {
        "Content-Type": req.headers.get("Content-Type") ?? "application/json",
      };
      const auth = req.headers.get("Authorization");
      const resolvedToken =
        resolvedRuntime?.mode === "byoc-vps" ? resolvedRuntime.gatewayToken : null;
      if (auth) {
        headers["Authorization"] = auth;
      } else if (resolvedToken && base === resolvedGatewayBase) {
        const authorization = toGatewayAuthorizationHeader(resolvedToken);
        if (authorization) {
          headers["Authorization"] = authorization;
        }
      }

      const upstream = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
        signal: AbortSignal.timeout(15_000),
        // @ts-expect-error duplex required for streaming body
        duplex: "half",
      });

      if (upstream.ok || upstream.status < 500) {
        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    } catch {
      // try next upstream
    }
  }

  return NextResponse.json(
    { error: "File system service unavailable" },
    { status: 503 },
  );
}

export const GET = proxyFilesRequest;
export const POST = proxyFilesRequest;
export const PUT = proxyFilesRequest;
export const DELETE = proxyFilesRequest;
export const PATCH = proxyFilesRequest;
