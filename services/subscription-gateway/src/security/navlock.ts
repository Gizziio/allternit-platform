// §A6.5 — navigation lock. The worker enforces this at the context-route
// level; this module is the pure predicate + typed error it calls.

export class NavigationDenied extends Error {
  override readonly name = "NavigationDenied";
  constructor(
    readonly url: string,
    reason: string
  ) {
    super(`navigation denied for ${url}: ${reason}`);
  }
}

function isLocalhostHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

// Origin entries may be full origins ("https://app.example.com") or bare
// hosts ("app.example.com"); compare hostnames only, exact, no subdomains.
function originHost(entry: string): string | null {
  try {
    return new URL(entry.includes("://") ? entry : `https://${entry}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isOriginAllowed(
  url: string,
  manifestOrigins: string[],
  extraAllowed: string[] = []
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  // localhost exception: loopback (CDP/devtools endpoints) is always allowed,
  // over plain http too; it cannot egress to a provider.
  if (isLocalhostHost(host)) {
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  }
  if (parsed.protocol !== "https:") return false;
  const allowed = new Set(
    [...manifestOrigins, ...extraAllowed]
      .map(originHost)
      .filter((h): h is string => h !== null)
  );
  return allowed.has(host);
}

export function assertNavigationAllowed(
  url: string,
  manifestOrigins: string[],
  extraAllowed: string[] = []
): void {
  if (!isOriginAllowed(url, manifestOrigins, extraAllowed)) {
    throw new NavigationDenied(url, "host is not in the manifest origins allowlist");
  }
}
