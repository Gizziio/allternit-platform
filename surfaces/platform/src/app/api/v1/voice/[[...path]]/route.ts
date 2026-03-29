import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const VOICE_SERVICE_BASE_URL =
  process.env.VOICE_SERVICE_URL?.replace(/\/+$/, "") ??
  process.env.NEXT_PUBLIC_VOICE_SERVICE_URL?.replace(/\/+$/, "") ??
  "http://127.0.0.1:8001";

export const dynamic = "force-dynamic";

function getUpstreamPath(pathname: string, search: string): string {
  if (pathname === "/api/v1/voice/health") {
    return `/health${search}`;
  }

  return `${pathname.replace(/^\/api/, "")}${search}`;
}

function buildResponse(upstream: Response): Response {
  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  const cacheControl = upstream.headers.get("cache-control");
  const contentLength = upstream.headers.get("content-length");

  if (contentType) headers.set("Content-Type", contentType);
  if (cacheControl) headers.set("Cache-Control", cacheControl);
  if (contentLength) headers.set("Content-Length", contentLength);

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}

async function proxy(request: NextRequest): Promise<Response> {
  const method = request.method.toUpperCase();
  const bodyBuffer =
    method === "GET" || method === "HEAD"
      ? null
      : Buffer.from(await request.arrayBuffer());

  try {
    const upstream = await fetch(
      `${VOICE_SERVICE_BASE_URL}${getUpstreamPath(request.nextUrl.pathname, request.nextUrl.search)}`,
      {
        method,
        headers: {
          ...(request.headers.get("accept")
            ? { Accept: request.headers.get("accept") as string }
            : {}),
          ...(request.headers.get("content-type")
            ? { "Content-Type": request.headers.get("content-type") as string }
            : {}),
        },
        body: bodyBuffer && bodyBuffer.byteLength > 0 ? bodyBuffer : undefined,
        signal: AbortSignal.timeout(15_000),
        // @ts-expect-error duplex required for streamed request bodies
        duplex: bodyBuffer ? "half" : undefined,
      },
    );

    return buildResponse(upstream);
  } catch {
    return NextResponse.json(
      { error: "Voice service is unavailable" },
      { status: 503 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
