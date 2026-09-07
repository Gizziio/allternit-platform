/**
 * Same-origin API + WebSocket proxy for the Fabric Transport PWA.
 *
 * Live cloud-api CORS on mail may lag this hostname, so the browser cannot
 * always call https://api.allternit.com from fabrictransport.allternit.com.
 * This worker owns fabrictransport.allternit.com/api/* and forwards HTTP,
 * SSE, and WebSocket upgrades to the control plane.
 */
const UPSTREAM = "https://api.allternit.com";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return new Response("Not found", { status: 404 });
    }

    const target = `${UPSTREAM}${url.pathname}${url.search}`;
    const upgrade = request.headers.get("Upgrade");
    if (upgrade && upgrade.toLowerCase() === "websocket") {
      const wsRequest = new Request(target, request);
      return fetch(wsRequest);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.set("X-Forwarded-Host", url.host);
    headers.set("X-Forwarded-Proto", "https");

    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    });

    const out = new Headers(upstream.headers);
    const cors = corsHeaders(request);
    for (const [key, value] of cors.entries()) out.set(key, value);
    // SSE / proxy streams must not be buffered by the edge.
    if ((out.get("content-type") || "").includes("text/event-stream")) {
      out.set("Cache-Control", "no-cache, no-transform");
      out.set("X-Accel-Buffering", "no");
    }
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "https://fabrictransport.allternit.com";
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "authorization,content-type,accept,x-requested-with,x-client-version,x-allternit-tenant-id,x-allternit-lease,last-event-id",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  });
}
