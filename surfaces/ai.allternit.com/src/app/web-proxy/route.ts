import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-encoding",
  "content-length",
  "x-frame-options",
  "frame-options",
  "content-security-policy",
  "content-security-policy-report-only",
  "cross-origin-opener-policy",
  "cross-origin-embedder-policy",
  "cross-origin-resource-policy",
]);

function patchHtml(html: string, targetUrl: string) {
  const baseTag = `<base href="${new URL(targetUrl).origin}/">`;
  const script = `
<script>
(() => {
  const send = (url) => {
    try { window.parent.postMessage({ type: "allternit-navigate", url }, "*"); }
    catch {}
  };
  const absolute = (value) => {
    try { return new URL(value, window.location.href).toString(); }
    catch { return value; }
  };
  document.addEventListener("click", (event) => {
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    event.preventDefault();
    send(absolute(href));
  }, true);
  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const method = (form.method || "get").toLowerCase();
    if (method !== "get") return;
    event.preventDefault();
    const url = new URL(form.action || window.location.href, window.location.href);
    for (const [key, value] of new FormData(form).entries()) {
      url.searchParams.set(key, typeof value === "string" ? value : value.name);
    }
    send(url.toString());
  }, true);
  const wrap = (fn) => function(...args) {
    const result = fn.apply(this, args);
    send(window.location.href);
    return result;
  };
  history.pushState = wrap(history.pushState);
  history.replaceState = wrap(history.replaceState);
  window.addEventListener("popstate", () => send(window.location.href));
})();
</script>`;

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}${script}`);
  }
  return `${baseTag}${script}${html}`;
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!rawUrl) {
    return new Response("Missing url parameter", { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return new Response("Invalid target URL", { status: 400 });
  }

  if (!["http:", "https:"].includes(targetUrl.protocol)) {
    return new Response("Unsupported protocol", { status: 400 });
  }

  const upstream = await fetch(targetUrl.toString(), {
    redirect: "follow",
    headers: {
      "user-agent":
        request.headers.get("user-agent") ??
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
      accept:
        request.headers.get("accept") ??
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": request.headers.get("accept-language") ?? "en-US,en;q=0.9",
    },
  });

  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  headers.set("cache-control", "no-store");
  headers.set("access-control-allow-origin", "*");

  const contentType = upstream.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    const html = patchHtml(await upstream.text(), targetUrl.toString());
    headers.set("content-type", "text/html; charset=utf-8");
    return new Response(html, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
