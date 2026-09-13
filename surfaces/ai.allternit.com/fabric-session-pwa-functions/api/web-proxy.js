/**
 * Allternit Fabric Session PWA — public web proxy (Cloudflare Pages Function).
 *
 * Ports `cmd/allternit-api/src/web_proxy_routes.rs` for the hosted
 * fabrictransport.allternit.com PWA, where no local allternit-api gateway
 * exists to serve `/api/web-proxy`. The browser capsule iframes load through
 * this route so X-Frame-Options / CSP frame-ancestors are stripped and
 * navigations can be lifted to the parent via `allternit-navigate` messages.
 *
 * Public by design (parity with the Rust route): no auth, http/https only,
 * private/loopback hosts blocked. Do not add auth here — iframe subresource
 * requests cannot carry Authorization headers.
 */

const UPSTREAM_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.8",
};

function jsonError(status, message) {
  return Response.json({ error: message }, { status });
}

function isPrivateHost(hostname) {
  const host = String(hostname || "").trim().toLowerCase();
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return true;
  // IPv6 literals (with or without brackets).
  const v6 = host.replace(/^\[|\]$/g, "");
  if (v6.includes(":")) {
    if (v6 === "::1" || v6 === "::" ) return true;
    if (v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb")) return true; // link-local
    if (v6.startsWith("fc") || v6.startsWith("fd")) return true; // unique local
    if (v6.startsWith("ff")) return true; // multicast
    return false;
  }
  // IPv4 literals: dotted-quad only, otherwise it is a DNS name.
  const parts = host.split(".");
  if (parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p))) {
    const [a, b] = parts.map((p) => parseInt(p, 10));
    if (parts.some((p) => parseInt(p, 10) > 255)) return false;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  return false;
}

function proxifyUrl(raw, finalUrl) {
  if (
    !raw ||
    raw.startsWith("data:") ||
    raw.startsWith("blob:") ||
    raw.startsWith("javascript:") ||
    raw.startsWith("#") ||
    raw.startsWith("mailto:") ||
    raw.startsWith("tel:")
  ) {
    return raw;
  }
  if (raw.startsWith("/api/web-proxy?url=")) return raw;
  try {
    const abs = new URL(raw, finalUrl).toString();
    return `/api/web-proxy?url=${encodeURIComponent(abs)}`;
  } catch {
    return raw;
  }
}

const REWRITE_PATTERNS = [
  /(<iframe\b[^>]+\ssrc=)(["'])([^"']*)(["'])/g,
  /(<frame\b[^>]+\ssrc=)(["'])([^"']*)(["'])/g,
  /(<form\b[^>]+\saction=)(["'])([^"']*)(["'])/g,
  /(<a\b[^>]+\shref=)(["'])([^"']*)(["'])/g,
];

function rewriteHtml(bodyText, finalUrl) {
  let text = bodyText;
  const baseOrigin = new URL(finalUrl).origin;

  if (new URL(finalUrl).hostname.endsWith("login.microsoftonline.com")) {
    text = text
      .replace(/sso_reload=True/g, "")
      .replace(/"reloadOnFailure":true/g, '"reloadOnFailure":false')
      .replace(
        /"enabled":true,"type":"chrome","reason":"Pull is needed"/g,
        '"enabled":false,"type":"chrome","reason":"Disabled by embedded proxy"',
      );
  }

  for (const pattern of REWRITE_PATTERNS) {
    text = text.replace(pattern, (_match, prefix, openQuote, raw, closeQuote) => {
      const quote = openQuote || '"';
      return `${prefix}${quote}${proxifyUrl(raw, finalUrl)}${closeQuote || quote}`;
    });
  }

  const injectedHead = `<base href="${baseOrigin}/"><script>
(function(){
  var _proxyPrefix = '/api/web-proxy?url=';
  function toProxy(url) {
    if (!url || url.charAt(0) === '#') return url;
    try {
      var abs = new URL(url, '${finalUrl}').toString();
      if (abs.indexOf('/api/web-proxy?url=') !== -1) return abs;
      return _proxyPrefix + encodeURIComponent(abs);
    } catch(e) { return url; }
  }
  document.addEventListener('click', function(event) {
    var anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!anchor) return;
    var href = anchor.getAttribute('href');
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return;
    event.preventDefault();
    window.parent.postMessage({ type: 'allternit-navigate', url: toProxy(href) }, '*');
  }, true);
  var _push = history.pushState.bind(history);
  var _replace = history.replaceState.bind(history);
  history.pushState = function(state, title, url) {
    if (url) {
      window.parent.postMessage({ type: 'allternit-navigate', url: toProxy(String(url)) }, '*');
      return;
    }
    return _push(state, title, url);
  };
  history.replaceState = function(state, title, url) {
    if (url) {
      window.parent.postMessage({ type: 'allternit-navigate', url: toProxy(String(url)) }, '*');
      return;
    }
    return _replace(state, title, url);
  };
})();
</script>`;

  const headIdx = text.indexOf("<head>");
  if (headIdx !== -1) {
    text = text.slice(0, headIdx + "<head>".length) + injectedHead + text.slice(headIdx + "<head>".length);
  } else {
    const htmlIdx = text.indexOf("<html>");
    if (htmlIdx !== -1) {
      text = text.slice(0, htmlIdx + "<html>".length) + `<head>${injectedHead}</head>` + text.slice(htmlIdx + "<html>".length);
    } else {
      text = `<head>${injectedHead}</head>${text}`;
    }
  }
  return text;
}

export async function onRequestGet(context) {
  const target = new URL(context.request.url).searchParams.get("url");
  if (!target) return jsonError(400, "Missing ?url= query parameter");

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return jsonError(400, "Invalid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return jsonError(403, "Only http/https URLs are allowed");
  }
  if (isPrivateHost(parsed.hostname)) {
    return jsonError(403, "Requests to private/loopback addresses are blocked");
  }

  let upstream;
  try {
    upstream = await fetch(parsed.toString(), {
      headers: UPSTREAM_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return jsonError(502, "Failed to fetch upstream URL");
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  const isHtml = contentType.includes("text/html") || contentType === "";

  if (!isHtml) {
    const headers = new Headers();
    if (contentType) headers.set("content-type", contentType);
    headers.set("access-control-allow-origin", "*");
    return new Response(upstream.body, { status: upstream.status, headers });
  }

  let bodyText;
  try {
    bodyText = await upstream.text();
  } catch {
    return jsonError(502, "Failed to read response body");
  }

  bodyText = rewriteHtml(bodyText, upstream.url);

  return new Response(bodyText, {
    status: upstream.status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "access-control-allow-origin": "*",
    },
  });
}
