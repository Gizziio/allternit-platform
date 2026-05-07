/**
 * /api/v1/files/[...path] — File system proxy
 *
 * Forwards file system requests from the browser to the Allternit gateway
 * (which runs on a different port and can't be hit directly due to CORS).
 * Falls back to direct local filesystem access when the gateway is unavailable.
 */

import { type NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/server-auth";
import {
  resolveRuntimeBackendForAuthUserId,
  toGatewayAuthorizationHeader,
} from "@/lib/runtime-backend";
import fs from "fs";
import path from "path";
import os from "os";

const GATEWAY_BASE_URL =
  process.env.VITE_ALLTERNIT_GATEWAY_URL?.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "") ??
  "http://127.0.0.1:8013";

const TERMINAL_SERVER_URL =
  process.env.TERMINAL_SERVER_URL ?? "http://127.0.0.1:4096";

type RouteParams = { params: Promise<{ path: string[] }> };

function safeResolvePath(rawPath: string | null): string | null {
  if (!rawPath) return null;
  // Accept absolute paths starting with / or ~
  if (rawPath.startsWith("~")) {
    return path.join(os.homedir(), rawPath.slice(1));
  }
  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }
  // Relative paths: resolve from home dir
  return path.join(os.homedir(), rawPath);
}

function localList(rawPath: string): NextResponse {
  const resolved = safeResolvePath(rawPath);
  if (!resolved) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  try {
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    return NextResponse.json({
      path: resolved,
      entries: entries.map((entry) => {
        const entryPath = path.join(resolved, entry.name);
        let size: number | undefined;
        let modifiedAt: string | undefined;
        try {
          const stat = fs.statSync(entryPath);
          size = stat.size;
          modifiedAt = stat.mtime.toISOString();
        } catch {
          // ignore stat errors
        }
        return {
          name: entry.name,
          path: entryPath,
          type: entry.isDirectory() ? "directory" : "file",
          size,
          modifiedAt,
        };
      }),
    });
  } catch {
    return NextResponse.json({ error: "Cannot list directory" }, { status: 404 });
  }
}

function localRead(rawPath: string): NextResponse {
  const resolved = safeResolvePath(rawPath);
  if (!resolved) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  try {
    const content = fs.readFileSync(resolved, "utf-8");
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ error: "Cannot read file" }, { status: 404 });
  }
}

function localExists(rawPath: string): NextResponse {
  const resolved = safeResolvePath(rawPath);
  if (!resolved) return new NextResponse(null, { status: 400 });
  return fs.existsSync(resolved)
    ? new NextResponse(null, { status: 200 })
    : new NextResponse(null, { status: 404 });
}

function localMkdir(rawPath: string): NextResponse {
  const resolved = safeResolvePath(rawPath);
  if (!resolved) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  try {
    fs.mkdirSync(resolved, { recursive: true });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Cannot create directory" }, { status: 500 });
  }
}

function localDelete(rawPath: string): NextResponse {
  const resolved = safeResolvePath(rawPath);
  if (!resolved) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  try {
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      fs.rmSync(resolved, { recursive: true, force: true });
    } else {
      fs.unlinkSync(resolved);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Cannot delete" }, { status: 500 });
  }
}

function localWrite(rawPath: string, content: string): NextResponse {
  const resolved = safeResolvePath(rawPath);
  if (!resolved) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  try {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, content, "utf-8");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Cannot write file" }, { status: 500 });
  }
}

async function proxyFilesRequest(
  req: NextRequest,
  { params }: RouteParams,
): Promise<Response> {
  const { path: pathSegments } = await params;
  const endpoint = pathSegments.join("/");
  const search = req.nextUrl.search;
  const searchParams = req.nextUrl.searchParams;

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

  // Try gateway first
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
        signal: AbortSignal.timeout(3_000),
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

  // Gateway unavailable — fall back to local filesystem
  const filePath = searchParams.get("path") ?? "";
  const method = req.method.toUpperCase();

  if (endpoint === "list" && method === "GET") {
    return localList(filePath);
  }
  if (endpoint === "read" && method === "GET") {
    return localRead(filePath);
  }
  if (endpoint === "exists" && method === "HEAD") {
    return localExists(filePath);
  }
  if (endpoint === "mkdir" && method === "POST") {
    return localMkdir(filePath);
  }
  if (endpoint === "delete" && method === "DELETE") {
    return localDelete(filePath);
  }
  if (endpoint === "write" && method === "POST") {
    let body: { path?: string; content?: string } = {};
    try {
      body = await req.json();
    } catch {
      // ignore parse error
    }
    return localWrite(body.path ?? filePath, body.content ?? "");
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
export const HEAD = proxyFilesRequest;
